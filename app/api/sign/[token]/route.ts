import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { hashToken } from "@/lib/signing"
import { signedPdfPathFor } from "@/lib/signing-paths"
import { validateSigningInput } from "@/lib/signing-input"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"
import { embedSignatureInPdf } from "@/lib/pdf/embed-signature"
import { issueContractCore } from "@/lib/proposals/issue-contract"

// ── Types ─────────────────────────────────────────────────────────────────────

/** Manual context type — RouteContext<> is generated during `next build`/`next typegen`
 *  and would fail tsc for a newly created route that hasn't been built yet. */
interface SignTokenCtx {
  params: Promise<{ token: string }>
}

interface ProposalRow {
  id: string
  client_id: string
  status: string
  services_json: unknown
  total_price: number | null
  proposal_pdf_path: string | null
  signing_token_used: boolean
  signing_token_expires_at: string
  created_at: string
  sent_at: string | null
}

interface ServiceItem {
  service?: { name?: string }
  name?: string
  quantity?: number | string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveTitle(services: ServiceItem[]): string {
  return services.length === 1
    ? services[0]?.service?.name ?? services[0]?.name ?? "Compliance Services"
    : "Compliance & Training Programme"
}

function parseServices(servicesJson: unknown): ServiceItem[] {
  return Array.isArray(servicesJson) ? (servicesJson as ServiceItem[]) : []
}

// ── GET /api/sign/[token] ─────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  ctx: SignTokenCtx
) {
  const { token } = await ctx.params
  const hash = hashToken(token)

  const { data: row } = await adminClient
    .from("proposals")
    .select(
      "id, client_id, status, services_json, total_price, proposal_pdf_path, signing_token_used, signing_token_expires_at, created_at, sent_at"
    )
    .eq("signing_token", hash)
    .maybeSingle<ProposalRow>()

  // Anti-enumeration: treat not-found identically to expired
  if (row === null || new Date(row.signing_token_expires_at) <= new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 })
  }

  if (row.signing_token_used === true) {
    return NextResponse.json({ error: "already_signed" }, { status: 409 })
  }

  // Load client details
  const { data: client } = await adminClient
    .from("clients")
    .select("name, contact_name, contact_email")
    .eq("id", row.client_id)
    .single<{ name: string | null; contact_name: string | null; contact_email: string | null }>()

  // Generate a signed PDF URL (1 hour) if path exists
  let pdfUrl: string | null = null
  if (row.proposal_pdf_path) {
    const { data: signed } = await adminClient.storage
      .from("proposals")
      .createSignedUrl(row.proposal_pdf_path, 3600)
    pdfUrl = signed?.signedUrl ?? null
  }

  // Derive display fields
  const services = parseServices(row.services_json)
  const reference = `PRO-${row.id.slice(0, 6).toUpperCase()}`
  const title = deriveTitle(services)
  const total =
    Number(row.total_price) || calculateProposalTotal(row.services_json)

  return NextResponse.json({
    proposal: {
      reference,
      title,
      clientName: client?.name ?? "",
      contactName: client?.contact_name ?? null,
      contactEmail: client?.contact_email ?? null,
      total,
      serviceCount: services.length,
      services: services.map((s) => ({
        name: s?.service?.name ?? s?.name ?? "Service",
        quantity: Number(s?.quantity) || 1,
      })),
      createdDate: row.sent_at ?? row.created_at,
      pdfUrl,
    },
  })
}

// ── POST /api/sign/[token] ────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  ctx: SignTokenCtx
) {
  const { token } = await ctx.params

  // 1. Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  // 2. Validate fields
  const validated = validateSigningInput(body)
  if (!validated.ok) {
    return NextResponse.json(
      { error: "validation", message: validated.message },
      { status: 400 }
    )
  }
  const signerName = validated.value.signer_name
  const signerEmail = validated.value.signer_email
  const signatureImage = validated.value.signature_image

  // 3. Hash + look up the proposal
  const hash = hashToken(token)

  const { data: row } = await adminClient
    .from("proposals")
    .select(
      "id, client_id, status, services_json, total_price, proposal_pdf_path, signing_token_used, signing_token_expires_at, signing_document_hash, created_at, sent_at"
    )
    .eq("signing_token", hash)
    .maybeSingle<
      ProposalRow & { signing_document_hash: string | null }
    >()

  if (row === null || new Date(row.signing_token_expires_at) <= new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 })
  }

  if (row.signing_token_used === true) {
    return NextResponse.json({ error: "already_signed" }, { status: 409 })
  }

  // 4. The signer must accept the exact PDF that was hashed when the link was
  // sent. Prepare the stamped, content-addressed artefact before changing any
  // lifecycle state; a download, hash, stamp, or upload failure leaves the token
  // unused and no contract can be issued.
  const now = new Date().toISOString()
  if (!row.signing_document_hash || !row.proposal_pdf_path) {
    console.error("[sign/[token]] Proposal has incomplete signing evidence", {
      proposalId: row.id,
    })
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }

  let stampedBytes: Uint8Array
  let signedDocumentHash: string
  let signedPath: string
  try {
    const { data: pdfBlob, error: downloadError } = await adminClient.storage
      .from("proposals")
      .download(row.proposal_pdf_path)

    if (downloadError || !pdfBlob) {
      throw new Error(downloadError?.message ?? "download returned null blob")
    }

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
    const currentDocumentHash = createHash("sha256")
      .update(pdfBytes)
      .digest("hex")

    if (currentDocumentHash !== row.signing_document_hash) {
      await adminClient.from("workflow_errors").insert({
        workflow_name: "proposal_signing_document_changed",
        error_message:
          "The proposal PDF no longer matches the document sent for signature.",
        payload: { proposalId: row.id },
      })
      return NextResponse.json(
        { error: "document_changed" },
        { status: 409 }
      )
    }

    stampedBytes = await embedSignatureInPdf(pdfBytes, signatureImage, {
      signerName,
      signedAt: now,
    })
    signedDocumentHash = createHash("sha256")
      .update(stampedBytes)
      .digest("hex")
    signedPath = signedPdfPathFor(
      row.proposal_pdf_path,
      signedDocumentHash
    )

    const { error: stampUploadError } = await adminClient.storage
      .from("proposals")
      .upload(signedPath, stampedBytes, {
        contentType: "application/pdf",
        // The key contains the content hash. Replacing that same key is safe:
        // identical keys represent identical bytes, while concurrent signatures
        // produce different keys and cannot overwrite one another.
        upsert: true,
      })

    if (stampUploadError) {
      throw new Error(stampUploadError.message)
    }
  } catch (err) {
    console.error(
      `[sign] proposal evidence preparation failed for ${row.id}:`,
      err
    )
    return NextResponse.json(
      { error: "evidence_unavailable" },
      { status: 503 }
    )
  }

  // 5. Capture IP + UA
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0"
  const ua = req.headers.get("user-agent") ?? null

  // 6. This RPC is the database commit point: it consumes the token, advances
  // the proposal, links the stamped artefact, and inserts the signature audit
  // row in one transaction. It also guards the original path/hash values so an
  // admin edit racing this request cannot be signed accidentally.
  const { data: redeemedRows, error: redeemError } = await adminClient.rpc(
    "redeem_proposal_signature",
    {
      p_token_hash: hash,
      p_expected_document_hash: row.signing_document_hash,
      p_expected_pdf_path: row.proposal_pdf_path,
      p_signer_name: signerName,
      p_signer_email: signerEmail,
      p_signature_image: signatureImage,
      p_ip_address: ip,
      p_user_agent: ua,
      p_signed_pdf_path: signedPath,
      p_signed_document_hash: signedDocumentHash,
      p_signed_at: now,
    }
  )
  const redeemed = Array.isArray(redeemedRows) ? redeemedRows[0] : null

  if (redeemError || !redeemed) {
    // The generated object is ours and no database row points at it when the
    // transaction fails or loses the single-use race, so remove that orphan.
    const { error: cleanupError } = await adminClient.storage
      .from("proposals")
      .remove([signedPath])
    if (cleanupError) {
      console.error("[sign/[token]] failed to remove uncommitted artefact", {
        proposalId: row.id,
        signedPath,
        cleanupError,
      })
    }

    if (redeemError) {
      console.error("[sign/[token]] atomic evidence commit failed", redeemError)
      await adminClient.from("workflow_errors").insert({
        workflow_name: "proposal_signature_commit",
        error_message: redeemError.message ?? "unknown database error",
        payload: { proposalId: row.id },
      })
      return NextResponse.json(
        { error: "signature_persist_failed" },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: "already_signed" },
      { status: 409 }
    )
  }

  const consumed = redeemed as {
    proposal_id: string
    client_id: string
    services_json: unknown
    proposal_pdf_path: string
    signing_document_hash: string
  }

  // The remaining work is downstream delivery. The signing evidence and
  // artefact are already committed together at this point.
  const proposalId = consumed.proposal_id

  // 7. Load client + dispatch notification
  try {
    const { data: clientRow } = await adminClient
      .from("clients")
      .select("name, contact_email")
      .eq("id", consumed.client_id)
      .single<{ name: string | null; contact_email: string | null }>()

    const services = parseServices(consumed.services_json)
    const title = deriveTitle(services)

    const notified = await dispatchNotification({
      type: "proposal_signed",
      client_name: clientRow?.name ?? "",
      client_email: clientRow?.contact_email ?? "",
      proposal_title: title,
      signed_at: now,
    })
    if (!notified.ok) {
      await adminClient.from("workflow_errors").insert({
        workflow_name: "proposal_signed_email",
        error_message: notified.error ?? "unknown dispatch failure",
        payload: { proposalId, client_id: consumed.client_id },
      })
    }
  } catch (err) {
    console.error("[sign/[token]] Notification dispatch failed:", err)
  }

  // 8. Auto-issue the Service Agreement now that the proposal is "Signed".
  //     Best-effort: the signature row is already persisted and the single-use
  //     token consumed, so a contract failure must NEVER roll that back or 500
  //     the request. Failures are logged to workflow_errors (surfaced on the
  //     admin dashboard) and Matt can fall back to the manual "Issue contract"
  //     button. issueContractCore is the admin action's logic WITHOUT the
  //     requireAdmin() gate — there is no admin session on this public route, and
  //     the client proved authority by redeeming the single-use signing token.
  try {
    const issued = await issueContractCore(proposalId)
    if (!issued.ok) {
      await adminClient.from("workflow_errors").insert({
        workflow_name: "auto_issue_contract",
        error_message: issued.error,
        payload: { proposalId, client_id: consumed.client_id },
      })
    }
  } catch (err) {
    console.error(
      `[sign/[token]] Auto-issue contract failed for proposal ${proposalId}:`,
      err
    )
    try {
      await adminClient.from("workflow_errors").insert({
        workflow_name: "auto_issue_contract",
        error_message: err instanceof Error ? err.message : String(err),
        payload: { proposalId, client_id: consumed.client_id },
      })
    } catch (logErr) {
      console.error("[sign/[token]] Failed to log auto-issue error:", logErr)
    }
  }

  // 11. Revalidate admin Kanban
  revalidatePath("/admin/proposals")

  // 12. Return success
  return NextResponse.json({ success: true })
}
