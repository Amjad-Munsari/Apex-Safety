import "server-only"

import type { NotificationPayload } from "./dispatch"
import { buildEmail, EMAIL_TYPES, type BuiltEmail, type EmailBranding } from "./email-templates"
import { sendViaResend, resendApiKey, type SendAttempt } from "./resend"
import { logAppError, logAppWarning } from "@/lib/observability/log"

// ─────────────────────────────────────────────────────────────────────────────
// The email outbox: a durable record of every send attempt, plus bounded retry.
//
// Three problems this solves, in the order they hurt:
//
//  1. **Nothing recorded a success.** A failure wrote workflow_errors; a
//     delivered email wrote nothing, so "was the confirmation ever sent?" had no
//     answer. Every email now gets a row, whatever the outcome.
//  2. **Nothing retried.** A blip in Resend or a network reset lost the email
//     permanently. Transient failures now get a bounded immediate retry, and
//     every row keeps the payload so `retryOutboxEntry` can re-send later.
//  3. **Retrying could double-send.** Each row is claimed before the attempt
//     (status 'sending') and carries an idempotency key that Resend honours, so
//     neither a concurrent dispatch nor an admin pressing "re-send" twice can
//     produce two emails.
//
// Hard rejections are never retried automatically. An invalid recipient, a
// rejected API key or an unverified sending domain fails identically on every
// attempt; retrying only delays the caller and hides the real problem.
// ─────────────────────────────────────────────────────────────────────────────

export type OutboxStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "abandoned"
  | "skipped"

export type FailureKind = "transient" | "hard"

/** Total attempts per dispatch, first one included. */
export const DEFAULT_MAX_ATTEMPTS = 3

/**
 * Waits between inline attempts. Deliberately short: dispatch is awaited on
 * user-facing paths (a customer sitting on the signing page), so the whole retry
 * budget has to fit inside a request without the page feeling stalled.
 */
export const DEFAULT_BACKOFF_MS = [400, 1_600]

/**
 * Emails whose body carries a single-use action link. The attempt is still
 * recorded, but `retryOutboxEntry` refuses them: the stored link may already be
 * spent or expired, and mailing a dead link is worse than mailing nothing. These
 * go back through the admin flow that mints a fresh one (resend invite, request
 * a new reset).
 */
const SINGLE_USE_LINK_TYPES = new Set<NotificationPayload["type"]>([
  "client_portal_invite",
  "password_reset",
  // These payloads contain a signing token or a short-lived storage URL. A
  // saved copy can be invalid by the time an operator sees the failure, so the
  // originating workflow must mint a fresh link instead of re-sending it.
  "proposal_signature_request",
  "report_ready",
  "contract_issued",
])

/**
 * How long a claim is trusted. A process killed mid-attempt leaves its row in
 * 'sending' forever; after this window another attempt may take it over. Longer
 * than any plausible send, short enough that recovery is same-day.
 */
const CLAIM_STALE_AFTER_MS = 5 * 60 * 1_000

// ── Failure classification ───────────────────────────────────────────────────

/**
 * Status codes that mean "this request was wrong" rather than "this request was
 * unlucky". 408 and 429 are 4xx but explicitly retryable.
 */
function classifyByStatus(status: number): FailureKind | null {
  if (status === 408 || status === 429) return "transient"
  if (status >= 400 && status < 500) return "hard"
  if (status >= 500) return "transient"
  return null
}

/** Permanent conditions. Retrying any of these produces the same rejection. */
const HARD_PATTERNS: RegExp[] = [
  // Resend quotes the offending field in backticks: "Invalid `to` field".
  /invalid[\s_-]*[`"']?(recipient|parameter|to|from|email|address)/i,
  /missing\/invalid recipient/i,
  /no email template/i,
  /not a valid email/i,
  /validation[_\s-]?error/i,
  /unprocessable/i,
  /api[_\s-]?key/i,          // missing, invalid, restricted or wrong-mode key
  /unauthori[sz]ed/i,
  /forbidden/i,
  /domain is not verified|domain not verified/i,
  /you can only send testing emails/i,
  /(suppress|blocklist|blocked|bounce)/i,
  /recipient .*does not exist/i,
  /not configured/i,
]

/** Conditions that are worth another attempt in a few hundred milliseconds. */
const TRANSIENT_PATTERNS: RegExp[] = [
  /rate[_\s-]?limit|too many requests/i,
  /timed? ?out|timeout|ETIMEDOUT/i,
  /ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up/i,
  /fetch failed|network|temporarily|try again/i,
  /internal server error|bad gateway|service unavailable|gateway timeout/i,
  /\b5\d{2}\b/,
]

/**
 * Decides whether a failed send is worth retrying. The provider's status code
 * wins when we have one; otherwise the message is matched, hard patterns first,
 * because "invalid API key" and "rate limit exceeded" can both mention numbers
 * and only the intent matters.
 *
 * An unrecognised failure is treated as transient. The retry budget is small and
 * idempotency-protected, so guessing wrong costs a few hundred milliseconds —
 * whereas guessing "hard" on a genuine blip silently loses the email.
 */
export function classifyEmailFailure(input: {
  message?: string
  status?: number
  name?: string
}): FailureKind {
  if (typeof input.status === "number") {
    const byStatus = classifyByStatus(input.status)
    if (byStatus) return byStatus
  }

  const text = `${input.name ?? ""} ${input.message ?? ""}`.trim()
  if (!text) return "transient"

  if (HARD_PATTERNS.some((pattern) => pattern.test(text))) return "hard"
  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(text))) return "transient"
  return "transient"
}

// ── Table access ─────────────────────────────────────────────────────────────
//
// The admin client is imported lazily for the same reason as in
// lib/observability/log.ts: it builds at module scope and throws when the
// service key is absent, and merely importing the dispatcher must never fail.
// Every helper below swallows its own errors — losing the bookkeeping is bad,
// losing the email because the bookkeeping failed is worse.

// Memoised so concurrent attempts share one import instead of each issuing their
// own; the module is stateless once built.
let adminModule: Promise<typeof import("@/lib/supabase/admin")> | null = null

async function outboxTable() {
  if (!adminModule) {
    adminModule = import("@/lib/supabase/admin")
    // A rejected memo would be replayed for the rest of the process, so the
    // failure is recorded and the next caller gets a fresh attempt.
    adminModule.catch(() => {
      adminModule = null
    })
  }
  const { adminClient } = await adminModule
  return adminClient.from("email_outbox")
}

async function reportBookkeepingFailure(
  stage: string,
  error: unknown,
  context: Record<string, unknown>
): Promise<void> {
  await logAppWarning({
    area: "notifications.outbox",
    source: "job",
    error,
    message: `email outbox ${stage} failed`,
    context: { stage, ...context },
  })
}

/** PostgREST surfaces the Postgres SQLSTATE; 23505 is unique_violation. */
function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  return String((error as { code?: unknown }).code) === "23505"
}

interface ClaimResult {
  /** Null when the row could not be written — the send still goes ahead. */
  id: string | null
  /** An equivalent email was already accepted by the provider. Do not send. */
  alreadySent: boolean
  /** Another attempt holds the claim. Do not send. */
  inFlight: boolean
  /** Attempts already made against this row, before this one. */
  priorAttempts: number
}

export interface OutboxEntryInput {
  payload: NotificationPayload
  recipient: string | null
  subject: string | null
  idempotencyKey?: string
  clientId?: string | null
  relatedType?: string | null
  relatedId?: string | null
  maxAttempts?: number
}

/**
 * Creates the row and claims it in one insert: the row lands as 'sending', so
 * the claim is the insert and no separate lock is needed. A duplicate
 * idempotency key trips the unique index, at which point the existing row
 * decides what happens — that is where double-sends are stopped.
 */
async function claimOutboxEntry(input: OutboxEntryInput): Promise<ClaimResult> {
  const nothingClaimed: ClaimResult = {
    id: null,
    alreadySent: false,
    inFlight: false,
    priorAttempts: 0,
  }
  const now = new Date().toISOString()

  try {
    const table = await outboxTable()
    const { data, error } = await table
      .insert({
        notification_type: input.payload.type,
        recipient: input.recipient,
        subject: input.subject,
        status: "sending",
        attempt_count: 0,
        max_attempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        first_attempt_at: now,
        last_attempt_at: now,
        idempotency_key: input.idempotencyKey ?? null,
        payload: input.payload,
        resend_allowed: !SINGLE_USE_LINK_TYPES.has(input.payload.type),
        client_id: input.clientId ?? null,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
      })
      .select("id")
      .single<{ id: string }>()

    if (!error && data) {
      return { id: data.id, alreadySent: false, inFlight: false, priorAttempts: 0 }
    }

    if (!input.idempotencyKey || !isUniqueViolation(error)) {
      await reportBookkeepingFailure("claim", error, { type: input.payload.type })
      return nothingClaimed
    }

    return await reclaimByIdempotencyKey(input.idempotencyKey, input.payload.type)
  } catch (err) {
    await reportBookkeepingFailure("claim", err, { type: input.payload.type })
    return nothingClaimed
  }
}

/**
 * A row already exists for this key. Whether it may be attempted again depends
 * entirely on its current status, and the take-over is a conditional update so
 * two callers racing here cannot both win.
 */
async function reclaimByIdempotencyKey(
  key: string,
  type: string
): Promise<ClaimResult> {
  const table = await outboxTable()
  const { data: existing, error } = await table
    .select("id, status, attempt_count, last_attempt_at")
    .eq("idempotency_key", key)
    .maybeSingle<{
      id: string
      status: OutboxStatus
      attempt_count: number
      last_attempt_at: string | null
    }>()

  if (error || !existing) {
    await reportBookkeepingFailure("reclaim-lookup", error ?? "row vanished", { type })
    return { id: null, alreadySent: false, inFlight: false, priorAttempts: 0 }
  }

  if (existing.status === "sent") {
    return {
      id: existing.id,
      alreadySent: true,
      inFlight: false,
      priorAttempts: existing.attempt_count,
    }
  }

  if (existing.status === "sending" && !claimIsStale(existing.last_attempt_at)) {
    return {
      id: existing.id,
      alreadySent: false,
      inFlight: true,
      priorAttempts: existing.attempt_count,
    }
  }

  const takenOver = await takeOverRow(
    existing.id,
    existing.status,
    existing.last_attempt_at
  )
  return {
    id: takenOver ? existing.id : null,
    alreadySent: false,
    inFlight: !takenOver,
    priorAttempts: existing.attempt_count,
  }
}

function claimIsStale(lastAttemptAt: string | null): boolean {
  if (!lastAttemptAt) return true
  const started = new Date(lastAttemptAt).getTime()
  if (Number.isNaN(started)) return true
  return Date.now() - started > CLAIM_STALE_AFTER_MS
}

/**
 * Moves a row into 'sending', but only from the status it was observed in. The
 * `.eq("status", …)` guard is the whole point: it is a compare-and-swap, so the
 * loser of a race gets zero rows back and must not send.
 */
async function takeOverRow(
  id: string,
  fromStatus: OutboxStatus,
  expectedLastAttemptAt: string | null
): Promise<boolean> {
  try {
    const table = await outboxTable()
    let query = table
      .update({ status: "sending", last_attempt_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", fromStatus)

    // Status alone is not a compare-and-swap when the old and new values are
    // both "sending": two stale workers can otherwise each match and send.
    // The timestamp observed during the lookup is the claim version.
    query = expectedLastAttemptAt === null
      ? query.is("last_attempt_at", null)
      : query.eq("last_attempt_at", expectedLastAttemptAt)

    const { data, error } = await query
      .select("id")

    if (error) {
      await reportBookkeepingFailure("take-over", error, { outboxId: id })
      return false
    }
    return Array.isArray(data) && data.length === 1
  } catch (err) {
    await reportBookkeepingFailure("take-over", err, { outboxId: id })
    return false
  }
}

interface FinaliseInput {
  status: Exclude<OutboxStatus, "pending" | "sending">
  attemptCount: number
  error?: string
  errorKind?: FailureKind
  messageId?: string
}

async function finaliseOutboxEntry(
  id: string | null,
  outcome: FinaliseInput
): Promise<void> {
  if (!id) return
  try {
    const table = await outboxTable()
    const now = new Date().toISOString()
    const { error } = await table
      .update({
        status: outcome.status,
        attempt_count: outcome.attemptCount,
        last_attempt_at: now,
        sent_at: outcome.status === "sent" ? now : null,
        last_error: outcome.error ? outcome.error.slice(0, 4_000) : null,
        last_error_kind: outcome.errorKind ?? null,
        provider_message_id: outcome.messageId ?? null,
      })
      .eq("id", id)
    if (error) {
      await reportBookkeepingFailure("finalise", error, { outboxId: id, status: outcome.status })
    }
  } catch (err) {
    await reportBookkeepingFailure("finalise", err, { outboxId: id })
  }
}

/**
 * Records a failure the loop is about to retry. The row stays 'sending' so it
 * keeps its claim between attempts; only the error and the count move. If the
 * process dies here the row is left claimed and the staleness window recovers
 * it, which is exactly the behaviour we want — better a row that looks busy for
 * five minutes than one that looks finished when it isn't.
 */
async function recordInterimFailure(
  id: string | null,
  attemptCount: number,
  attempt: SendAttempt,
  kind: FailureKind
): Promise<void> {
  if (!id) return
  try {
    const table = await outboxTable()
    await table
      .update({
        attempt_count: attemptCount,
        last_attempt_at: new Date().toISOString(),
        last_error: (attempt.error ?? "unknown send failure").slice(0, 4_000),
        last_error_kind: kind,
      })
      .eq("id", id)
  } catch (err) {
    await reportBookkeepingFailure("interim", err, { outboxId: id })
  }
}

/** Writes a terminal row for something that never reached the provider. */
async function recordUnsentEntry(
  input: OutboxEntryInput,
  status: "abandoned" | "skipped",
  message: string,
  errorKind?: FailureKind
): Promise<string | null> {
  try {
    const table = await outboxTable()
    const { data, error } = await table
      .insert({
        notification_type: input.payload.type,
        recipient: input.recipient,
        subject: input.subject,
        status,
        attempt_count: 0,
        max_attempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        last_error: status === "abandoned" ? message.slice(0, 4_000) : null,
        last_error_kind: errorKind ?? null,
        idempotency_key: input.idempotencyKey ?? null,
        payload: input.payload,
        resend_allowed: !SINGLE_USE_LINK_TYPES.has(input.payload.type),
        client_id: input.clientId ?? null,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
      })
      .select("id")
      .single<{ id: string }>()

    if (error || !data) {
      await reportBookkeepingFailure("record-unsent", error, {
        type: input.payload.type,
        status,
      })
      return null
    }
    return data.id
  } catch (err) {
    await reportBookkeepingFailure("record-unsent", err, { type: input.payload.type })
    return null
  }
}

// ── The send path ────────────────────────────────────────────────────────────

export interface OutboxSendOptions {
  /** Stable key: makes the send safe to repeat, at Resend and in this table. */
  idempotencyKey?: string
  clientId?: string | null
  /** What the email is about, e.g. "proposal" — for the admin outbox view. */
  relatedType?: string | null
  relatedId?: string | null
  maxAttempts?: number
  /** Overridable so tests don't sit through real backoff. */
  backoffMs?: number[]
}

export interface OutboxSendResult {
  ok: boolean
  status?: number
  error?: string
  errorKind?: FailureKind
  outboxId?: string
  /** Attempts actually made against the provider in this call. */
  attempts: number
  /** True when an equivalent send was already accepted or is in flight. */
  suppressed?: boolean
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production"
}

/**
 * The saved sender / sign-off names from admin Settings, applied to every
 * outgoing email. Lazy import for the same reason as the logger's persist():
 * app-settings pulls in the admin client, whose module throws without env —
 * and a missing setting must never block a send, so failures degrade to the
 * env/default branding rather than surfacing.
 */
async function emailBranding(): Promise<EmailBranding> {
  try {
    const { getAppSettings } = await import("@/lib/settings/app-settings")
    const settings = await getAppSettings()
    return { senderName: settings.senderName, signOffName: settings.signOffName }
  } catch {
    return { senderName: null, signOffName: null }
  }
}

/**
 * Sends one email through the outbox: record, claim, attempt, retry transient
 * failures within a bounded budget, finalise. Never throws.
 */
export async function sendEmailThroughOutbox(
  payload: NotificationPayload,
  options: OutboxSendOptions = {}
): Promise<OutboxSendResult> {
  const branding = await emailBranding()
  const built = buildEmail(payload, branding)

  const entryInput: OutboxEntryInput = {
    payload,
    // `|| null`, not `?? null`: an empty address is no address, and storing ""
    // would read as "we had one" in the admin view.
    recipient: built?.to || null,
    subject: built?.subject || null,
    idempotencyKey: options.idempotencyKey,
    clientId: options.clientId ?? null,
    relatedType: options.relatedType ?? null,
    relatedId: options.relatedId ?? null,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  }

  // ── Conditions that must never be retried, recorded before anything is sent.
  if (!built) {
    const message = `no email template for type ${payload.type}`
    const outboxId = await recordUnsentEntry(entryInput, "abandoned", message, "hard")
    return { ok: false, error: message, errorKind: "hard", attempts: 0, outboxId: outboxId ?? undefined }
  }

  if (!built.to || !built.to.includes("@")) {
    const message = `missing/invalid recipient for ${payload.type}`
    const outboxId = await recordUnsentEntry(entryInput, "abandoned", message, "hard")
    // A client with no email address is a data problem someone has to fix, so
    // it gets an error row of its own rather than only a delivery record.
    await logAppError({
      area: "notifications.missing_recipient",
      source: "job",
      message,
      clientId: options.clientId ?? null,
      context: { notificationType: payload.type, outboxId },
    })
    return { ok: false, error: message, errorKind: "hard", attempts: 0, outboxId: outboxId ?? undefined }
  }

  if (!resendApiKey()) {
    if (isProd()) {
      const message = "RESEND_API_KEY not configured"
      const outboxId = await recordUnsentEntry(entryInput, "abandoned", message, "hard")
      return { ok: false, error: message, errorKind: "hard", attempts: 0, outboxId: outboxId ?? undefined }
    }
    // Dev/test: no provider, so nothing was sent and nothing failed. Recorded as
    // 'skipped' so the outbox stays a complete history rather than a partial one.
    const outboxId = await recordUnsentEntry(
      entryInput,
      "skipped",
      "no provider configured outside production"
    )
    return { ok: true, status: 0, attempts: 0, outboxId: outboxId ?? undefined }
  }

  const claim = await claimOutboxEntry(entryInput)

  if (claim.alreadySent) {
    // The provider already accepted this exact email. Returning ok without
    // sending is the whole point of the idempotency key.
    return {
      ok: true,
      status: 200,
      attempts: 0,
      suppressed: true,
      outboxId: claim.id ?? undefined,
    }
  }

  if (claim.inFlight) {
    // Another attempt owns this row. From the caller's point of view nothing has
    // failed — the email is someone else's problem now — so this reports ok with
    // status 0, the same shape as a deliberate no-op.
    return {
      ok: true,
      status: 0,
      attempts: 0,
      suppressed: true,
      outboxId: claim.id ?? undefined,
    }
  }

  return await attemptWithBackoff(built, claim, entryInput, options, branding.senderName)
}

async function attemptWithBackoff(
  built: BuiltEmail,
  claim: ClaimResult,
  entryInput: OutboxEntryInput,
  options: OutboxSendOptions,
  senderName: string | null = null
): Promise<OutboxSendResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS
  // Falls back to the row id so a retry is idempotent even when the caller
  // supplied no key of its own.
  const idempotencyKey =
    entryInput.idempotencyKey ?? (claim.id ? `outbox:${claim.id}` : undefined)

  let attempt: SendAttempt = { ok: false, error: "no attempt made" }
  let attemptNumber = 0

  while (attemptNumber < maxAttempts) {
    attemptNumber += 1
    attempt = await sendViaResend(built, { idempotencyKey, senderName })

    if (attempt.ok) {
      await finaliseOutboxEntry(claim.id, {
        status: "sent",
        attemptCount: claim.priorAttempts + attemptNumber,
        messageId: attempt.messageId,
      })
      return {
        ok: true,
        status: attempt.status ?? 200,
        attempts: attemptNumber,
        outboxId: claim.id ?? undefined,
      }
    }

    const kind = classifyEmailFailure({
      message: attempt.error,
      status: attempt.status,
      name: attempt.errorName,
    })

    if (kind === "hard") {
      await finaliseOutboxEntry(claim.id, {
        status: "abandoned",
        attemptCount: claim.priorAttempts + attemptNumber,
        error: attempt.error,
        errorKind: "hard",
      })
      return {
        ok: false,
        status: attempt.status,
        error: attempt.error,
        errorKind: "hard",
        attempts: attemptNumber,
        outboxId: claim.id ?? undefined,
      }
    }

    if (attemptNumber >= maxAttempts) break

    await recordInterimFailure(
      claim.id,
      claim.priorAttempts + attemptNumber,
      attempt,
      "transient"
    )
    await sleep(backoff[attemptNumber - 1] ?? backoff[backoff.length - 1] ?? 0)
  }

  // Budget spent on a failure that may yet succeed: 'failed', not 'abandoned',
  // so an explicit re-send is still offered.
  await finaliseOutboxEntry(claim.id, {
    status: "failed",
    attemptCount: claim.priorAttempts + attemptNumber,
    error: attempt.error,
    errorKind: "transient",
  })
  return {
    ok: false,
    status: attempt.status,
    error: attempt.error,
    errorKind: "transient",
    attempts: attemptNumber,
    outboxId: claim.id ?? undefined,
  }
}

// ── Explicit re-send ─────────────────────────────────────────────────────────

export type RetryRefusal =
  | "not_found"
  | "already_sent"
  | "in_progress"
  | "resend_not_allowed"
  | "payload_unavailable"
  | "not_retryable"

export interface RetryOutboxResult {
  ok: boolean
  outboxId: string
  /** Set when nothing was sent. `already_sent` is a success, not a fault. */
  refusal?: RetryRefusal
  error?: string
  errorKind?: FailureKind
}

const EXPLICITLY_RETRYABLE: OutboxStatus[] = ["pending", "failed", "abandoned"]

interface OutboxRetryRow {
  id: string
  status: OutboxStatus
  attempt_count: number
  max_attempts: number
  last_attempt_at: string | null
  idempotency_key: string | null
  resend_allowed: boolean
  payload: unknown
  client_id: string | null
}

/**
 * Re-sends one outbox row. This is the entry point the admin errors UI calls,
 * so its guarantees matter more than its convenience:
 *
 *  - A row that was already accepted is never sent again — it reports ok with
 *    refusal 'already_sent'.
 *  - A row another attempt is working on is refused, not queued behind it.
 *  - The claim is a compare-and-swap on status, so two operators pressing
 *    "re-send" at the same moment produce one email.
 *  - Single-use-link emails are refused outright; see SINGLE_USE_LINK_TYPES.
 *
 * Unlike the inline path this makes a single attempt, including for rows that
 * failed hard. Automatic retry still never touches a hard rejection, but an
 * operator who has just fixed the API key or the address is entitled to ask
 * again, and a human pressing a button is its own backoff.
 */
export async function retryOutboxEntry(id: string): Promise<RetryOutboxResult> {
  let row: OutboxRetryRow | null = null

  try {
    const table = await outboxTable()
    const { data, error } = await table
      .select(
        "id, status, attempt_count, max_attempts, last_attempt_at, idempotency_key, resend_allowed, payload, client_id"
      )
      .eq("id", id)
      .maybeSingle<OutboxRetryRow>()
    if (error) {
      await reportBookkeepingFailure("retry-lookup", error, { outboxId: id })
      return { ok: false, outboxId: id, refusal: "not_found", error: error.message }
    }
    row = data
  } catch (err) {
    await reportBookkeepingFailure("retry-lookup", err, { outboxId: id })
    return {
      ok: false,
      outboxId: id,
      refusal: "not_found",
      error: err instanceof Error ? err.message : String(err),
    }
  }

  if (!row) return { ok: false, outboxId: id, refusal: "not_found" }

  if (row.status === "sent") {
    return { ok: true, outboxId: id, refusal: "already_sent" }
  }
  if (row.status === "sending" && !claimIsStale(row.last_attempt_at)) {
    return { ok: false, outboxId: id, refusal: "in_progress" }
  }
  if (row.status !== "sending" && !EXPLICITLY_RETRYABLE.includes(row.status)) {
    return { ok: false, outboxId: id, refusal: "not_retryable" }
  }
  if (!row.resend_allowed) {
    return { ok: false, outboxId: id, refusal: "resend_not_allowed" }
  }

  const payload = asNotificationPayload(row.payload)
  if (!payload) {
    return { ok: false, outboxId: id, refusal: "payload_unavailable" }
  }

  const branding = await emailBranding()
  const built = buildEmail(payload, branding)
  if (!built || !built.to || !built.to.includes("@")) {
    await finaliseOutboxEntry(id, {
      status: "abandoned",
      attemptCount: row.attempt_count,
      error: `cannot rebuild email for ${payload.type}`,
      errorKind: "hard",
    })
    return { ok: false, outboxId: id, refusal: "payload_unavailable" }
  }

  if (!(await takeOverRow(id, row.status, row.last_attempt_at))) {
    return { ok: false, outboxId: id, refusal: "in_progress" }
  }

  const attemptCount = row.attempt_count + 1
  const attempt = await sendViaResend(built, {
    idempotencyKey: row.idempotency_key ?? `outbox:${id}`,
    senderName: branding.senderName,
  })

  if (attempt.ok) {
    await finaliseOutboxEntry(id, {
      status: "sent",
      attemptCount,
      messageId: attempt.messageId,
    })
    return { ok: true, outboxId: id }
  }

  const kind = classifyEmailFailure({
    message: attempt.error,
    status: attempt.status,
    name: attempt.errorName,
  })
  await finaliseOutboxEntry(id, {
    status: kind === "hard" ? "abandoned" : "failed",
    attemptCount,
    error: attempt.error,
    errorKind: kind,
  })
  await logAppWarning({
    area: "notifications.outbox_retry",
    source: "action",
    message: `explicit re-send failed: ${attempt.error ?? "unknown"}`,
    clientId: row.client_id,
    context: { outboxId: id, notificationType: payload.type, errorKind: kind },
  })
  return { ok: false, outboxId: id, error: attempt.error, errorKind: kind }
}

/**
 * The stored payload is JSON we wrote ourselves, but it round-tripped through
 * the database and retention may have blanked it, so it is checked rather than
 * cast blindly.
 */
function asNotificationPayload(value: unknown): NotificationPayload | null {
  if (!value || typeof value !== "object") return null
  const type = (value as { type?: unknown }).type
  if (typeof type !== "string") return null
  if (!EMAIL_TYPES.has(type as NotificationPayload["type"])) return null
  return value as NotificationPayload
}
