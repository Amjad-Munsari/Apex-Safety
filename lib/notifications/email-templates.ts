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
  "expiry_admin_digest",
  "document_uploaded",
  "assignment_reminder",
  "report_ready",
  "proposal_signature_request",
  "proposal_signed",
  "contract_issued",
  "client_portal_invite",
  "password_reset",
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

// ── brand palette (from app/globals.css) ────────────────────────────────────
const C = {
  teal: "#3b8273",     // brand primary
  tealDark: "#2f6b5e", // header depth
  gold: "#d97706",     // brand secondary / accent rule
  ink: "#1a1a1a",      // foreground, primary CTA fill
  body: "#4b453f",     // body copy
  muted: "#8a837b",    // footer / secondary
  cream: "#f4f1ea",    // page canvas
  card: "#ffffff",
  border: "#e5e1d8",   // hairline
  linkBox: "#faf9f6",  // raw-link chip bg
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// ── layout ───────────────────────────────────────────────────────────────────

/** Wrap body content in the shared shell: brand header, card, optional CTA,
 *  footer. `bodyHtml` is trusted (built here); dynamic values are escaped by
 *  the callers below before interpolation. `preheader` seeds the inbox preview
 *  snippet (hidden in-body); defaults to the heading. */
function layout(opts: {
  heading: string
  bodyHtml: string
  cta?: { label: string; url: string }
  footerNote?: string
  preheader?: string
}): string {
  const { heading, bodyHtml, cta, footerNote, preheader } = opts

  const button = cta
    ? `<tr><td style="padding:20px 0 6px;">
         <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${cta.url}" style="height:46px;v-text-anchor:middle;width:280px;" arcsize="14%" fillcolor="${C.ink}" strokecolor="${C.ink}"><w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;">${escapeHtml(cta.label)}</center></v:roundrect><![endif]-->
         <!--[if !mso]><!-- --><a href="${cta.url}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1;padding:15px 26px;border-radius:8px;">${escapeHtml(cta.label)}</a><!--<![endif]-->
       </td></tr>
       <tr><td style="padding:6px 0 0;">
         <div style="color:${C.muted};font-size:12px;line-height:1.5;margin-bottom:6px;">Or paste this link into your browser:</div>
         <div style="background:${C.linkBox};border:1px solid ${C.border};border-radius:6px;padding:10px 12px;color:${C.teal};font-size:12px;word-break:break-all;">${cta.url}</div>
       </td></tr>`
    : ""

  const preview = escapeHtml(preheader ?? heading)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
</head>
<body style="margin:0;padding:0;background:${C.cream};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream};font-size:1px;line-height:1px;">${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.card};border:1px solid ${C.border};border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(26,26,26,0.05);">
        <!-- header -->
        <tr><td style="background:${C.teal};background-image:linear-gradient(135deg,${C.teal},${C.tealDark});padding:26px 32px;">
          <div style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:0.2px;">${escapeHtml(BRAND)}</div>
          <div style="color:rgba(255,255,255,0.72);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;">Fire Safety &amp; Compliance</div>
        </td></tr>
        <!-- gold accent rule -->
        <tr><td style="height:3px;background:${C.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
        <!-- body -->
        <tr><td style="padding:32px 32px 12px;">
          <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:${C.ink};font-weight:700;">${escapeHtml(heading)}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="color:${C.body};font-size:15px;line-height:1.65;">
            <tr><td>${bodyHtml}</td></tr>
            ${button}
          </table>
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:22px 32px 28px;border-top:1px solid ${C.border};color:${C.muted};font-size:12px;line-height:1.6;">
          ${footerNote ? `${escapeHtml(footerNote)}<br/><br/>` : ""}This is an automated message from <span style="color:${C.body};font-weight:600;">${escapeHtml(BRAND)}</span>. Replying to this email reaches our team.
        </td></tr>
      </table>
      <div style="max-width:600px;color:${C.muted};font-size:11px;line-height:1.5;padding:16px 8px 0;">${escapeHtml(BRAND)} · Fire safety &amp; compliance management</div>
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

    case "expiry_admin_digest": {
      const rows = payload.items
        .map((item) => {
          const days = item.days_until_expiry
          const when = formatDate(item.expiry_date)
          // days can be <= 0 now that the cron also alerts on already-expired
          // documents — "expires in -3 days" would be nonsense.
          const state =
            days <= 0
              ? `has expired (${when})`
              : `expires in ${days} day${days === 1 ? "" : "s"} (${when})`
          return `<li><strong>${escapeHtml(item.client_name)}</strong> — ${escapeHtml(item.document_name)} ${state}</li>`
        })
        .join("")
      const count = payload.items.length
      return {
        to: payload.admin_email,
        subject: `Expiry alerts sent today: ${count} document${count === 1 ? "" : "s"}`,
        html: layout({
          heading: "Expiry alerts went out to clients today",
          bodyHtml: `${p(`The daily expiry check emailed clients about ${count} document${count === 1 ? "" : "s"}:`)}<ul>${rows}</ul>`,
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

    case "password_reset": {
      return {
        to: payload.recipient_email,
        subject: `Reset your password — ${BRAND}`,
        html: layout({
          heading: "Reset your password",
          bodyHtml: `${p("We received a request to reset the password for this email address. Click below to choose a new one.")}<br/><br/>${p("If you didn't request this, you can safely ignore this email — your password is unchanged.")}`,
          cta: { label: "Choose a new password", url: payload.reset_url },
          footerNote: "This link is single-use and expires. You can request another from the sign-in page.",
          preheader: "Choose a new password for your portal account",
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
