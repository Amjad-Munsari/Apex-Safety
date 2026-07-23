import "server-only"

import { Resend } from "resend"

import { buildEmail, EMAIL_TYPES } from "./email-templates"

// ─────────────────────────────────────────────────────────────────────────────
// Notification dispatch.
//
// Eight of the payload variants are customer emails — these are rendered from
// templates and sent via Resend (from the verified send.888safetyandtraining.com
// domain). The three client_form_* variants are NOT emails: they are events for
// a partner (Finley) n8n Switch, keyed on client_id, and still POST to the n8n
// webhook. dispatchNotification is the single entry point for both; call sites
// never need to know which transport runs.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationPayload =
  | {
      type: "expiry_alert"
      client_email: string
      client_name: string
      document_name: string
      expiry_date: string
      days_until_expiry: number
    }
  | {
      type: "document_uploaded"
      client_email: string
      client_name: string
      document_name: string
      document_category: string
      expiry_date: string | null
    }
  | {
      type: "assignment_reminder"
      cadence: "7d" | "1d" | "overdue"
      client_email: string
      client_name: string
      template_name: string
      due_date: string           // ISO date yyyy-mm-dd
      assignment_url: string     // absolute URL to /client/assignments/[id]
      instructions: string | null
    }
  | {
      type: "report_ready"
      client_email: string
      client_name: string
      report_url: string         // 7-day signed URL
      assessment_date: string    // en-GB formatted, matches PDF header
      report_storage_path: string // for logging / dedup
    }
  | {
      type: "proposal_signature_request"
      client_name: string
      client_email: string
      proposal_title: string
      signing_url: string        // absolute public URL: ${siteUrl}/sign/${rawToken}
      expiry_date: string        // ISO date the signing link expires
    }
  | {
      type: "proposal_signed"
      client_name: string
      client_email: string
      proposal_title: string
      signed_at: string          // ISO timestamp the client completed signing
    }
  | {
      type: "contract_issued"
      client_name: string
      client_email: string
      proposal_title: string
      contract_url: string       // 7-day signed URL to the service-agreement PDF
      issued_at: string          // ISO timestamp the contract was issued
    }
  | {
      // Portal access invite — sent when an admin grants a contact portal access
      // (new-client onboarding or the client access tab). Carries the single-use
      // action link the invitee clicks to set a password and sign in.
      type: "client_portal_invite"
      client_name: string        // org name the user is being invited into
      recipient_name: string
      recipient_email: string
      invite_url: string         // single-use set-password/sign-in action link
      status: "invited" | "resent"
    }
  // ── Two-way form builder: client-surface events (for Finley's n8n Switch) ──
  // Keyed on client_id (the org UUID) rather than client_email/name — the client
  // surface fires them from RLS-scoped server actions where the org id is always
  // in context. n8n resolves name/email from client_id when composing downstream.
  | {
      type: "client_form_created"
      client_id: string          // org UUID (form_templates.owner_id)
      template_id: string
      template_name: string
      template_type: string
      created_at: string         // ISO timestamp
    }
  | {
      type: "client_form_submitted"
      client_id: string          // org UUID (form_submissions.client_id)
      submission_id: string
      assignment_id: string | null // null = customer-built self-fill (no assignment)
      submitted_at: string       // ISO timestamp
    }
  | {
      type: "client_template_cloned"
      client_id: string          // org UUID that now owns the fork
      template_id: string        // the new forked template
      template_name: string
      parent_template_id: string // the master template it was cloned from
      cloned_at: string          // ISO timestamp
    }

export interface DispatchResult {
  ok: boolean
  status?: number
  error?: string
}

const DEFAULT_FROM = "Merlin Safety System <notifications@send.888safetyandtraining.com>"

function isProd(): boolean {
  return process.env.NODE_ENV === "production"
}

function redactSigningUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}/sign/[REDACTED]`
  } catch {
    return "[REDACTED]"
  }
}

/** Structured, secret-safe log line — never emits full signing/invite/contract
 *  URLs (they grant access). Applies to both transports. */
function logDispatch(payload: NotificationPayload): void {
  const safePayload = {
    ...payload,
    ...("signing_url" in payload
      ? { signing_url: redactSigningUrl(payload.signing_url) }
      : {}),
    ...("invite_url" in payload ? { invite_url: "[REDACTED]" } : {}),
    ...("contract_url" in payload ? { contract_url: "[REDACTED]" } : {}),
    ...("report_url" in payload ? { report_url: "[REDACTED]" } : {}),
  }
  console.log(
    "[dispatch]",
    JSON.stringify({ type: payload.type, payload: safePayload })
  )
}

let resendClient: Resend | null = null
function getResend(apiKey: string): Resend {
  if (!resendClient) resendClient = new Resend(apiKey)
  return resendClient
}

/** Send an email-shaped payload via Resend. */
async function sendEmail(payload: NotificationPayload): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    if (isProd()) {
      return { ok: false, error: "RESEND_API_KEY not configured" }
    }
    console.warn(
      `[dispatch] RESEND_API_KEY missing — email skipped (type: ${payload.type}). Set RESEND_API_KEY to enable in dev.`
    )
    return { ok: true, status: 0 }
  }

  const email = buildEmail(payload)
  if (!email) {
    return { ok: false, error: `no email template for type ${payload.type}` }
  }
  if (!email.to || !email.to.includes("@")) {
    return { ok: false, error: `missing/invalid recipient for ${payload.type}` }
  }

  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM
  const replyTo = process.env.EMAIL_REPLY_TO

  try {
    const { error } = await getResend(apiKey).emails.send({
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      ...(replyTo ? { replyTo } : {}),
    })
    if (error) {
      return { ok: false, error: error.message }
    }
    return { ok: true, status: 200 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** POST a client-surface event to the partner n8n webhook. */
async function dispatchToN8n(
  payload: NotificationPayload
): Promise<DispatchResult> {
  const url = process.env.N8N_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET

  if (!url || !secret) {
    if (isProd()) {
      return {
        ok: false,
        error: "N8N_WEBHOOK_URL / N8N_WEBHOOK_SECRET not configured",
      }
    }
    console.warn(
      `[dispatch] n8n webhook not configured — event skipped (type: ${payload.type}).`
    )
    return { ok: true, status: 0 }
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": secret,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { ok: false, status: res.status, error: `webhook returned ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Single dispatch entry point. Routes email-shaped payloads to Resend and the
 * client_form_* events to the n8n webhook. Never throws — always resolves a
 * DispatchResult so callers can log to workflow_errors and fall back.
 */
export async function dispatchNotification(
  payload: NotificationPayload
): Promise<DispatchResult> {
  logDispatch(payload)

  if (EMAIL_TYPES.has(payload.type)) {
    return sendEmail(payload)
  }
  return dispatchToN8n(payload)
}
