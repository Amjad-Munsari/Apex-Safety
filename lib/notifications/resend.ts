import "server-only"

import { Resend } from "resend"

import type { BuiltEmail } from "./email-templates"
import { PLATFORM_NAME, PUBLIC_CONTACT } from "@/lib/public-identity"

// ─────────────────────────────────────────────────────────────────────────────
// The raw Resend transport: one HTTP call, no bookkeeping, no retry.
//
// It lives in its own module so both the inline dispatch path and the outbox's
// explicit re-send path can reach it without importing each other. Everything
// that decides *whether* to send — recording, claiming, classifying, retrying —
// is in ./outbox.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendAttempt {
  ok: boolean
  /** HTTP status when the provider gave one. */
  status?: number
  /** Provider message id on success — the receipt Matt can quote to support. */
  messageId?: string
  error?: string
  /** Provider error name, e.g. "validation_error". Feeds failure classification. */
  errorName?: string
}

export const DEFAULT_FROM = `${PLATFORM_NAME} <notifications@merlinsafetysystem.com>`

/**
 * Builds the From header. The address always comes from EMAIL_FROM (or
 * DEFAULT_FROM) — it must stay on the Resend-verified sending domain. Only the
 * display name is variable: a saved sender name from admin Settings replaces
 * the env value's display name; without one the env value is used verbatim.
 */
export function composeFrom(senderName?: string | null): string {
  const envFrom = process.env.EMAIL_FROM ?? DEFAULT_FROM
  const display = senderName?.replace(/[<>"\r\n]/g, "").trim()
  if (!display) return envFrom
  const address = envFrom.match(/<([^>]+)>/)?.[1] ?? envFrom
  return `${display} <${address}>`
}

export function resendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY
}

let resendClient: Resend | null = null
function getResend(apiKey: string): Resend {
  if (!resendClient) resendClient = new Resend(apiKey)
  return resendClient
}

/**
 * Reads the status code off a Resend error without trusting its shape. The SDK
 * exposes `statusCode` on some error paths and nothing on others, and the code
 * is what makes a confident transient/hard call, so it is worth digging for.
 */
function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as Record<string, unknown>
  for (const key of ["statusCode", "status", "code"]) {
    const value = record[key]
    if (typeof value === "number" && value >= 100 && value < 600) return value
    if (typeof value === "string" && /^\d{3}$/.test(value)) return Number(value)
  }
  return undefined
}

/** Sends one email. Never throws — a thrown transport error becomes ok:false. */
export async function sendViaResend(
  email: BuiltEmail,
  options: { idempotencyKey?: string; senderName?: string | null } = {}
): Promise<SendAttempt> {
  const apiKey = resendApiKey()
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const from = composeFrom(options.senderName)
  const replyTo = process.env.EMAIL_REPLY_TO ?? PUBLIC_CONTACT.email

  try {
    const { data, error } = await getResend(apiKey).emails.send(
      {
        from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        replyTo,
      },
      options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined
    )
    if (error) {
      return {
        ok: false,
        error: error.message,
        errorName: typeof error.name === "string" ? error.name : undefined,
        status: errorStatus(error),
      }
    }
    return {
      ok: true,
      status: 200,
      messageId:
        data && typeof data === "object" && typeof (data as { id?: unknown }).id === "string"
          ? (data as { id: string }).id
          : undefined,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : undefined,
      status: errorStatus(err),
    }
  }
}
