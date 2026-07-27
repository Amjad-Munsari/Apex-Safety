import "server-only"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { logAppError, logWorkflowFailure } from "@/lib/observability/log"

const VAT_RATE = 0.2

/**
 * Core contract-issuance logic, WITHOUT the admin gate.
 *
 * Extracted from the admin `issueContract` server action (app/admin/proposals/
 * actions.ts) so the exact same logic can serve two callers with different trust
 * contexts:
 *   - Admin "Issue contract" button → `issueContract()`, which runs
 *     `requireAdmin()` and then delegates here.
 *   - Public signing route `POST /api/sign/[token]`, which auto-issues the
 *     contract the moment the client signs. That route has NO admin session, so
 *     it cannot call the admin-gated wrapper — but the caller has already proven
 *     authority by atomically redeeming a single-use signing token.
 *
 * `server-only` + this NOT being a "use server" module are load-bearing: they
 * keep the gate-free logic off the client bundle and prevent it from being
 * exposed as an unauthenticated server-action RPC. Each caller is responsible
 * for its own authorization before invoking.
 *
 * Builds a counter-signed Service Agreement PDF from the proposal's services,
 * uploads it to the `proposals` bucket, writes `contract_pdf_path`, flips status
 * to "Contract Issued", and emails the client a download link. Until this runs
 * the client's /client/contracts page has nothing to show (it filters on
 * status='Contract Issued' AND contract_pdf_path IS NOT NULL).
 *
 * Guard: only a Signed proposal can be issued.
 */
export async function issueContractCore(
  proposalId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Load proposal
  const { data: proposal, error: proposalError } = await adminClient
    .from("proposals")
    .select("id, client_id, status, services_json, total_price, signed_at")
    .eq("id", proposalId)
    .maybeSingle()

  if (proposalError || !proposal) {
    return { ok: false, error: "Proposal not found." }
  }

  if (proposal.status === "Contract Issued") {
    return { ok: false, error: "A contract has already been issued for this proposal." }
  }

  if (proposal.status !== "Signed") {
    return { ok: false, error: "The proposal must be signed before a contract can be issued." }
  }

  const servicesJson = Array.isArray(proposal.services_json) ? proposal.services_json : []
  if (servicesJson.length === 0) {
    return { ok: false, error: "This proposal has no services, so a contract cannot be generated." }
  }

  // 2. Load client details
  const { data: client } = await adminClient
    .from("clients")
    .select("name, site_address, contact_name, contact_email")
    .eq("id", proposal.client_id)
    .single()

  // 3. Signature details (who signed for the client, and when) — best-effort.
  const { data: signature } = await adminClient
    .from("proposal_signatures")
    .select("signer_name, signed_at")
    .eq("proposal_id", proposalId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // 4. Reconstruct line items — tolerate both the `{ service, quantity }` shape
  //    and any flattened items (mirrors regenerateProposalPdf).
  const pdfServices = (servicesJson as Record<string, unknown>[]).map((s) => {
    const svc = s.service as Record<string, unknown> | undefined
    return {
      name: (svc?.name ?? s.name ?? "Service") as string,
      description: (svc?.description ?? s.description ?? "") as string,
      quantity: Number(s.quantity) || 1,
      unit_price: Number(svc?.unit_price ?? s.unit_price ?? s.price) || 0,
    }
  })

  const subtotal = pdfServices.reduce((acc, s) => acc + s.quantity * s.unit_price, 0)
  const vat = subtotal * VAT_RATE
  const total = subtotal + vat

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null
  const issuedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  // 5. Generate the contract PDF
  let pdfBuffer: Buffer
  try {
    const { generateContractPdfBuffer } = await import("@/lib/pdf/generator")
    pdfBuffer = await generateContractPdfBuffer({
      clientName: client?.name || "Client",
      clientAddress: client?.site_address || "Address on file",
      contactName: client?.contact_name || "Contact on file",
      reference: `CON-${proposalId.slice(0, 6).toUpperCase()}`,
      services: pdfServices,
      subtotalAmount: subtotal,
      vatAmount: vat,
      totalAmount: total,
      signedDate: fmtDate(signature?.signed_at ?? proposal.signed_at),
      signedBy: signature?.signer_name ?? null,
      issuedDate,
    })
  } catch (err) {
    await logAppError({
      area: "contracts.pdf_generation",
      source: "action",
      error: err,
      clientId: proposal.client_id ?? null,
      context: { proposalId },
    })
    return { ok: false, error: "Failed to generate the contract PDF. Please try again." }
  }

  // 6. Upload to storage (proposals bucket — same bucket the client page reads)
  const fileName = `${proposal.client_id}/contract_${proposalId}.pdf`
  const { error: uploadError } = await adminClient.storage
    .from("proposals")
    .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true })

  if (uploadError) {
    await logAppError({
      area: "contracts.upload",
      source: "action",
      error: uploadError,
      clientId: proposal.client_id ?? null,
      context: { proposalId, fileName },
    })
    return { ok: false, error: "Failed to store the contract PDF. Please try again." }
  }

  // 7. Persist path + advance status (atomic-ish: both in one update)
  const { error: updateError } = await adminClient
    .from("proposals")
    .update({ contract_pdf_path: fileName, status: "Contract Issued" })
    .eq("id", proposalId)

  if (updateError) {
    // The PDF exists in storage but the proposal still reads as unissued — a
    // silent orphan unless it is recorded somewhere durable.
    await logWorkflowFailure({
      workflowName: "contract_link_failed",
      error: updateError,
      area: "contracts.link",
      source: "action",
      clientId: proposal.client_id ?? null,
      payload: { proposalId, fileName, note: "contract PDF stored but proposal not advanced" },
    })
    return { ok: false, error: "Contract generated but could not be linked to the proposal." }
  }

  // 8. Notify the client — non-fatal. Mint a 7-day signed URL for the email only.
  try {
    const { data: signed } = await adminClient.storage
      .from("proposals")
      .createSignedUrl(fileName, 60 * 60 * 24 * 7)

    const services: Array<{ service?: { name?: string }; name?: string }> = servicesJson as Array<{
      service?: { name?: string }
      name?: string
    }>
    const proposalTitle =
      services.length === 1
        ? services[0]?.service?.name ?? services[0]?.name ?? "Compliance Services"
        : "Compliance & Training Programme"

    if (client?.contact_email) {
      const dispatch = await dispatchNotification({
        type: "contract_issued",
        client_name: client?.name ?? "there",
        client_email: client.contact_email,
        proposal_title: proposalTitle,
        contract_url: signed?.signedUrl ?? "",
        issued_at: new Date().toISOString(),
      })
      if (!dispatch.ok) {
        await logWorkflowFailure({
          workflowName: "contract_issued_email",
          error: dispatch.error ?? "unknown dispatch failure",
          area: "notifications.contract_issued",
          source: "action",
          clientId: proposal.client_id ?? null,
          payload: { proposalId },
        })
      }
    }
  } catch (err) {
    await logWorkflowFailure({
      workflowName: "contract_issued_email",
      error: err,
      area: "notifications.contract_issued",
      source: "action",
      clientId: proposal.client_id ?? null,
      payload: { proposalId, reason: "dispatch threw" },
    })
  }

  revalidatePath("/admin/proposals")
  revalidatePath(`/admin/proposals/${proposalId}`)
  revalidatePath("/client/contracts")
  return { ok: true }
}
