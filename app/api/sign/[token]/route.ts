import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { hashToken } from "@/lib/signing"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"

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

interface SignBody {
  signer_name: string
  signer_email: string
  signature_image: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(
  req: NextRequest,
  ctx: SignTokenCtx
) {
  const { token } = await ctx.params

  // 1. Parse body
  let body: SignBody
  try {
    body = (await req.json()) as SignBody
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  // 2. Validate fields
  const signerName =
    typeof body.signer_name === "string" ? body.signer_name.trim() : ""
  const signerEmail =
    typeof body.signer_email === "string" ? body.signer_email.trim() : ""
  const signatureImage = body.signature_image ?? ""

  if (!signerName) {
    return NextResponse.json(
      { error: "validation", message: "signer_name is required" },
      { status: 400 }
    )
  }

  if (!EMAIL_REGEX.test(signerEmail)) {
    return NextResponse.json(
      { error: "validation", message: "signer_email is invalid" },
      { status: 400 }
    )
  }

  if (
    typeof signatureImage !== "string" ||
    !signatureImage.startsWith("data:image/png;base64,")
  ) {
    return NextResponse.json(
      {
        error: "validation",
        message: "signature_image must be a PNG data URL",
      },
      { status: 400 }
    )
  }

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

  // 4. Atomic single-use consume — guarded on not-yet-used
  const now = new Date().toISOString()

  const { data: consumed, error: consumeError } = await adminClient
    .from("proposals")
    .update({
      signing_token_used: true,
      status: "Signed",
      signed_at: now,
    })
    .eq("signing_token", hash)
    .eq("signing_token_used", false)
    .select("id, client_id, signing_document_hash, services_json")
    .maybeSingle<{
      id: string
      client_id: string
      signing_document_hash: string | null
      services_json: unknown
    }>()

  if (consumeError) {
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }

  if (!consumed) {
    // Lost the race — another request already consumed the token
    return NextResponse.json({ error: "already_signed" }, { status: 409 })
  }

  // 5. Capture IP + UA
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0"
  const ua = req.headers.get("user-agent") ?? null

  // 6. Insert signature record
  const { error: insertError } = await adminClient
    .from("proposal_signatures")
    .insert({
      proposal_id: consumed.id,
      signer_name: signerName,
      signer_email: signerEmail,
      signature_image: signatureImage,
      ip_address: ip,
      user_agent: ua,
      document_hash: consumed.signing_document_hash ?? "",
      signed_at: now,
    })

  if (insertError) {
    console.error(
      "[sign/[token]] Failed to insert proposal_signatures row:",
      insertError
    )
    // Do not 500 — proposal is already marked Signed. Log for manual recovery.
  }

  // 7. Load client + dispatch notification
  try {
    const { data: clientRow } = await adminClient
      .from("clients")
      .select("name, contact_email")
      .eq("id", consumed.client_id)
      .single<{ name: string | null; contact_email: string | null }>()

    const services = parseServices(consumed.services_json)
    const title = deriveTitle(services)

    await dispatchNotification({
      type: "proposal_signed",
      client_name: clientRow?.name ?? "",
      client_email: clientRow?.contact_email ?? "",
      proposal_title: title,
      signed_at: now,
    })
  } catch (err) {
    console.error("[sign/[token]] Notification dispatch failed:", err)
  }

  // 8. Revalidate admin Kanban
  revalidatePath("/admin/proposals")

  // 9. Return success
  return NextResponse.json({ success: true })
}
