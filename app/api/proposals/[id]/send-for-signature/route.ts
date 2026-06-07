import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth-helpers"
import { adminClient } from "@/lib/supabase/admin"
import { generateSigningToken, hashDocument } from "@/lib/signing"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"

// ── Types ────────────────────────────────────────────────────────────────────

type RouteContext = {
  params: Promise<{ id: string }>
}

interface ProposalRow {
  id: string
  client_id: string
  status: string
  proposal_pdf_path: string | null
  services_json: unknown
}

interface ClientRow {
  name: string | null
  contact_name: string | null
  contact_email: string | null
}

interface ServiceItem {
  service?: { name?: string }
  name?: string
}

// ── Site URL resolver (mirrors lib/scheduler/send-reminder.ts lines 12-16) ──

function getSiteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://fire-safety-platform.vercel.app"
  )
}

// ── Proposal title derivation (mirrors client proposal page) ─────────────────

function deriveProposalTitle(servicesJson: unknown): string {
  const services: ServiceItem[] = Array.isArray(servicesJson) ? servicesJson : []
  if (services.length === 1) {
    return services[0]?.service?.name ?? services[0]?.name ?? "Compliance Services"
  }
  return "Compliance & Training Programme"
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  // 1. Auth gate
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await ctx.params

  // 2. Load proposal
  const { data: proposalData, error: proposalError } = await adminClient
    .from("proposals")
    .select("id, client_id, status, proposal_pdf_path, services_json")
    .eq("id", id)
    .maybeSingle()

  if (proposalError || proposalData === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const proposal = proposalData as ProposalRow

  // 3. Guard: do not re-send a proposal that is already finalised
  if (proposal.status === "Signed" || proposal.status === "Contract Issued") {
    return NextResponse.json({ error: "already_finalised" }, { status: 409 })
  }

  // 4. PDF must exist before we can hash it
  if (proposal.proposal_pdf_path === null) {
    return NextResponse.json(
      { error: "no_pdf", message: "PDF must be generated before sending for signature." },
      { status: 400 }
    )
  }

  // 5. Load client contact
  const { data: clientData, error: clientError } = await adminClient
    .from("clients")
    .select("name, contact_name, contact_email")
    .eq("id", proposal.client_id)
    .single()

  if (clientError || clientData === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const client = clientData as ClientRow

  if (!client.contact_email) {
    return NextResponse.json({ error: "no_client_email" }, { status: 400 })
  }

  const clientEmail: string = client.contact_email

  // 6. Generate signing token
  const { raw, hash } = generateSigningToken()

  // 7. Hash the current PDF
  const documentHash = await hashDocument(proposal.proposal_pdf_path)

  // 8. Compute expiry — 30 days from now
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // 9. Persist signing fields + advance status
  const { error: updateError } = await adminClient
    .from("proposals")
    .update({
      signing_token: hash,
      signing_token_expires_at: expiresAt,
      signing_token_used: false,
      signing_document_hash: documentHash,
      status: "Sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (updateError) {
    console.error("[send-for-signature] DB update failed:", updateError)
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }

  // 10. Build signing URL using raw token (not hash)
  const base = getSiteBase()
  const signingUrl = `${base}/sign/${raw}`

  // 11. Derive proposal title from services_json
  const proposalTitle = deriveProposalTitle(proposal.services_json)

  // 12. Dispatch notification — non-fatal: still return success if n8n is down
  const dispatch = await dispatchNotification({
    type: "proposal_signature_request",
    client_name: client.name ?? client.contact_name ?? "Client",
    client_email: clientEmail,
    proposal_title: proposalTitle,
    signing_url: signingUrl,
    expiry_date: expiresAt,
  })

  if (!dispatch.ok) {
    console.error("[send-for-signature] n8n dispatch failed:", dispatch.error)
  }

  // 13. Revalidate admin kanban views
  revalidatePath("/admin/proposals")
  revalidatePath(`/admin/proposals/${id}`)

  return NextResponse.json({ success: true, signing_url: signingUrl })
}
