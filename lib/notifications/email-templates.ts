import "server-only"

import type { NotificationPayload } from "./dispatch"

// ─────────────────────────────────────────────────────────────────────────────
// Transactional email templates (Resend).
//
// Each of the eight email-shaped NotificationPayload variants maps to a
// { to, subject, html } here. The three client-surface event variants
// (client_form_*) are NOT emails — they stay on the n8n webhook and never reach
// this module (buildEmail returns null for them as a safety net).
//
// HTML is hand-written with inline styles because email clients strip <style>
// blocks and don't run external CSS. Keep it simple, single-column, and legible
// in both light and dark mail clients (no dark-mode media queries — inline
// colours with sufficient contrast render acceptably everywhere).
// ─────────────────────────────────────────────────────────────────────────────

const BRAND = process.env.EMAIL_BRAND_NAME ?? "Merlin Safety System"

/** Types that become an email. Everything else routes to n8n. */
export const EMAIL_TYPES = new Set<NotificationPayload["type"]>([
  "expiry_alert",
  "document_uploaded",
  "assignment_reminder",
  "report_ready",
  "proposal_signature_request",
  "proposal_signed",
  "contract_issued",
  "client_portal_invite",
])

export interface BuiltEmail {
  to: string
  subject: string
  html: string
}

// ── formatting helpers ───────────────────────────────────────────────────────

/** Format an ISO date/timestamp (or yyyy-mm-dd) as "5 August 2026" (en-GB).
 *  Returns the input untouched if it can't be parsed — some payloads carry
 *  already-formatted strings (e.g. report_ready.assessment_date). */
function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ── layout ───────────────────────────────────────────────────────────────────

/** Wrap body content in the shared shell: brand header, card, optional CTA,
 *  footer. `bodyHtml` is trusted (built here); dynamic values are escaped by
 *  the callers below before interpolation. */
function layout(opts: {
  heading: string
  bodyHtml: string
  cta?: { label: string; url: string }
  footerNote?: string
}): string {
  const { heading, bodyHtml, cta, footerNote } = opts
  const button = cta
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${cta.url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:6px;">${escapeHtml(cta.label)}</a>
       </td></tr>
       <tr><td style="padding:4px 0 0;color:#64748b;font-size:12px;word-break:break-all;">Or paste this link into your browser:<br/>${cta.url}</td></tr>`
    : ""
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <tr><td style="background:#0f172a;padding:20px 28px;">
          <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.2px;">${escapeHtml(BRAND)}</span>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(heading)}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="color:#334155;font-size:15px;line-height:1.6;">
            <tr><td style="padding:0 0 8px;">${bodyHtml}</td></tr>
            ${button}
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px 26px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;line-height:1.5;">
          ${footerNote ? `${escapeHtml(footerNote)}<br/><br/>` : ""}This is an automated message from ${escapeHtml(BRAND)}. Replying to this email reaches our team.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function p(text: string): string {
  return `<span>${escapeHtml(text)}</span>`
}

// ── per-type builders ────────────────────────────────────────────────────────

/** Returns the email to send for an email-shaped payload, or null for the
 *  n8n-only event types (a safety net — dispatch already routes those away). */
export function buildEmail(payload: NotificationPayload): BuiltEmail | null {
  switch (payload.type) {
    case "expiry_alert": {
      const when = formatDate(payload.expiry_date)
      const days = payload.days_until_expiry
      const urgency =
        days <= 0
          ? "has expired"
          : `expires in ${days} day${days === 1 ? "" : "s"} (${when})`
      return {
        to: payload.client_email,
        subject: `Action needed: ${payload.document_name} ${days <= 0 ? "has expired" : `expires in ${days} day${days === 1 ? "" : "s"}`}`,
        html: layout({
          heading: "A compliance document needs attention",
          bodyHtml: `${p(`Hi ${payload.client_name},`)}<br/><br/>${p(`Your document `)}<strong>${escapeHtml(payload.document_name)}</strong> ${p(urgency)}. ${p("Please arrange a renewal to stay compliant.")}`,
        }),
      }
    }

    case "document_uploaded": {
      const expiry = payload.expiry_date
        ? ` It expires on ${formatDate(payload.expiry_date)}.`
        : ""
      return {
        to: payload.client_email,
        subject: `New document added: ${payload.document_name}`,
        html: layout({
          heading: "A new document was added to your account",
          bodyHtml: `${p(`Hi ${payload.client_name},`)}<br/><br/>${p(`We've added `)}<strong>${escapeHtml(payload.document_name)}</strong> ${p(`(${payload.document_category}) to your compliance records.`)}${p(expiry)}`,
        }),
      }
    }

    case "assignment_reminder": {
      const due = formatDate(payload.due_date)
      const lead =
        payload.cadence === "overdue"
          ? `This assessment is now overdue (was due ${due}).`
          : payload.cadence === "1d"
            ? `This assessment is due tomorrow, ${due}.`
            : `This assessment is due on ${due}.`
      const instructions = payload.instructions
        ? `<br/><br/><em>${escapeHtml(payload.instructions)}</em>`
        : ""
      return {
        to: payload.client_email,
        subject:
          payload.cadence === "overdue"
            ? `Overdue: ${payload.template_name}`
            : `Reminder: ${payload.template_name} due ${due}`,
        html: layout({
          heading: payload.cadence === "overdue" ? "An assessment is overdue" : "Assessment reminder",
          bodyHtml: `${p(`Hi ${payload.client_name},`)}<br/><br/>${p(lead)} ${p(`Please complete `)}<strong>${escapeHtml(payload.template_name)}</strong>.${instructions}`,
          cta: { label: "Open assessment", url: payload.assignment_url },
        }),
      }
    }

    case "report_ready": {
      return {
        to: payload.client_email,
        subject: `Your compliance report is ready (${payload.assessment_date})`,
        html: layout({
          heading: "Your report is ready",
          bodyHtml: `${p(`Hi ${payload.client_name},`)}<br/><br/>${p(`Your compliance report for the assessment on ${payload.assessment_date} is ready to view.`)}`,
          cta: { label: "View report", url: payload.report_url },
          footerNote: "This report link is valid for 7 days.",
        }),
      }
    }

    case "proposal_signature_request": {
      return {
        to: payload.client_email,
        subject: `Please review and sign: ${payload.proposal_title}`,
        html: layout({
          heading: "A proposal is ready for your signature",
          bodyHtml: `${p(`Hi ${payload.client_name},`)}<br/><br/>${p(`Your proposal `)}<strong>${escapeHtml(payload.proposal_title)}</strong> ${p("is ready to review and sign.")}`,
          cta: { label: "Review & sign", url: payload.signing_url },
          footerNote: `This signing link expires on ${formatDate(payload.expiry_date)}.`,
        }),
      }
    }

    case "proposal_signed": {
      return {
        to: payload.client_email,
        subject: `Signed: ${payload.proposal_title}`,
        html: layout({
          heading: "Thanks — your proposal is signed",
          bodyHtml: `${p(`Hi ${payload.client_name},`)}<br/><br/>${p(`We've recorded your signature on `)}<strong>${escapeHtml(payload.proposal_title)}</strong> ${p(`on ${formatDate(payload.signed_at)}. Your service agreement will follow shortly.`)}`,
        }),
      }
    }

    case "contract_issued": {
      return {
        to: payload.client_email,
        subject: `Your service agreement: ${payload.proposal_title}`,
        html: layout({
          heading: "Your service agreement is ready",
          bodyHtml: `${p(`Hi ${payload.client_name},`)}<br/><br/>${p(`Your signed service agreement for `)}<strong>${escapeHtml(payload.proposal_title)}</strong> ${p(`was issued on ${formatDate(payload.issued_at)}. You can download it below.`)}`,
          cta: { label: "Download agreement", url: payload.contract_url },
          footerNote: "This download link is valid for 7 days.",
        }),
      }
    }

    case "client_portal_invite": {
      const verb = payload.status === "resent" ? "Here's your new" : "You've been given"
      return {
        to: payload.recipient_email,
        subject: `${payload.status === "resent" ? "Your new sign-in link" : "You've been invited"} — ${payload.client_name} portal`,
        html: layout({
          heading: `${verb} portal access`,
          bodyHtml: `${p(`Hi ${payload.recipient_name},`)}<br/><br/>${p(`You have portal access for `)}<strong>${escapeHtml(payload.client_name)}</strong>. ${p("Click below to set your password and sign in.")}`,
          cta: { label: "Set password & sign in", url: payload.invite_url },
          footerNote: "This link is single-use and expires. If it lapses, ask your administrator to resend it.",
        }),
      }
    }

    // n8n-only event types — never emailed.
    case "client_form_created":
    case "client_form_submitted":
    case "client_template_cloned":
      return null
  }
}
