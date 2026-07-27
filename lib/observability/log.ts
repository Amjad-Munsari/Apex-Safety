import "server-only"

import { buildContext, safeString, LIMITS } from "./redact"

/**
 * The single entry point for recording a fault anywhere on the server.
 *
 * Design rules, in priority order:
 *
 *  1. **It can never throw.** Every call site is a catch block or an error
 *     handler; a logger that throws converts a handled failure into an
 *     unhandled one. Everything below is wrapped, including the wrapping.
 *  2. **It always writes to stdout first.** The database insert can fail — that
 *     is exactly the kind of outage worth logging — so the structured console
 *     line is emitted before the insert is attempted and never depends on it.
 *     Vercel's runtime logs stay the backstop; `app_error_log` is the durable,
 *     admin-visible copy.
 *  3. **It never blocks the user's request on the log write.** Callers that can
 *     afford to wait may await the returned promise; the fire-and-forget
 *     helpers below do not.
 *  4. **Nothing reaches the table unredacted.** See ./redact.
 */

export type ErrorSeverity = "error" | "warning" | "info"

export type ErrorSource =
  | "render"   // React Server Component / page render
  | "route"    // route handler
  | "action"   // server action
  | "proxy"    // middleware / proxy
  | "cron"     // scheduled job
  | "browser"  // reported by the client bundle
  | "job"      // background work triggered in-process
  | "external" // outbound provider call (PayPal, Resend, OpenRouter, n8n)

export type ActorType = "admin" | "client" | "anon" | "system"

export interface LogErrorInput {
  /** Dot-scoped logical area, e.g. "paypal.capture", "signing.redeem". */
  area: string
  /** Where the throw was captured. */
  source: ErrorSource
  /** The thrown value. Anything is accepted — it is narrowed here, not by callers. */
  error?: unknown
  /** Overrides the message derived from `error`. Required when `error` is absent. */
  message?: string
  severity?: ErrorSeverity
  routePath?: string
  requestPath?: string
  requestMethod?: string
  requestId?: string
  actorType?: ActorType
  actorId?: string | null
  clientId?: string | null
  digest?: string
  /** Structured detail. Redacted and size-capped before storage. */
  context?: unknown
}

interface NormalisedError {
  name: string | undefined
  message: string
  stack: string | undefined
  digest: string | undefined
}

/**
 * Narrows an unknown thrown value. Covers the cases that actually show up:
 * Error subclasses, Supabase's plain `{ message, code, details, hint }` objects,
 * strings, and values whose `toString` itself throws.
 */
function normaliseError(error: unknown): NormalisedError {
  if (error instanceof Error) {
    const digest =
      "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
        ? (error as { digest: string }).digest
        : undefined
    return {
      name: error.name,
      message: error.message || String(error),
      stack: error.stack,
      digest,
    }
  }

  if (typeof error === "string") {
    return { name: undefined, message: error, stack: undefined, digest: undefined }
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : safeStringify(record)
    return {
      name: typeof record.name === "string" ? record.name : typeof record.code === "string" ? record.code : undefined,
      message,
      stack: typeof record.stack === "string" ? record.stack : undefined,
      digest: typeof record.digest === "string" ? record.digest : undefined,
    }
  }

  return { name: undefined, message: safeStringify(error), stack: undefined, digest: undefined }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    try {
      return String(value)
    } catch {
      return "[unserialisable error value]"
    }
  }
}

/**
 * Strips the parts of a message that vary between occurrences of the same fault
 * so repeats share a fingerprint: ids, numbers, quoted values, timestamps and
 * paths with embedded ids.
 */
export function normaliseMessageForFingerprint(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, "<timestamp>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/"[^"]{0,200}"/g, '"<v>"')
    .replace(/'[^']{0,200}'/g, "'<v>'")
    .trim()
    .slice(0, 300)
}

/**
 * FNV-1a. Deliberately not a crypto hash: this is a grouping key, it must be
 * synchronous, and it must work identically in the Node and Edge runtimes
 * (Web Crypto's digest is async; node:crypto is not available on Edge).
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export function buildFingerprint(area: string, name: string | undefined, message: string): string {
  return `${area}:${name ?? "Error"}:${fnv1a(normaliseMessageForFingerprint(message))}`
}

function environmentName(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown"
}

function releaseName(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  return sha ? sha.slice(0, 12) : undefined
}

/**
 * The row shape written to `app_error_log`, after redaction. Exported so the
 * route handler and tests can assert on it without reaching into the module.
 */
export interface AppErrorRow {
  severity: ErrorSeverity
  source: ErrorSource
  area: string
  message: string
  error_name: string | null
  stack: string | null
  digest: string | null
  route_path: string | null
  request_path: string | null
  request_method: string | null
  request_id: string | null
  actor_type: ActorType | null
  actor_id: string | null
  client_id: string | null
  release: string | null
  environment: string
  fingerprint: string
  context: Record<string, unknown>
}

export function buildErrorRow(input: LogErrorInput): AppErrorRow {
  const normalised = normaliseError(input.error)
  const message = safeString(input.message ?? normalised.message ?? "Unknown error", LIMITS.message)
  const area = safeString(input.area || "unknown", 120)

  return {
    severity: input.severity ?? "error",
    source: input.source,
    area,
    message: message || "Unknown error",
    error_name: normalised.name ? safeString(normalised.name, 200) : null,
    stack: normalised.stack ? safeString(normalised.stack, LIMITS.stack) : null,
    digest: (input.digest ?? normalised.digest) ? safeString((input.digest ?? normalised.digest)!, 200) : null,
    route_path: input.routePath ? safeString(input.routePath, 500) : null,
    request_path: input.requestPath ? safeString(input.requestPath, 1000) : null,
    request_method: input.requestMethod ? safeString(input.requestMethod, 10) : null,
    request_id: input.requestId ? safeString(input.requestId, 200) : null,
    actor_type: input.actorType ?? null,
    actor_id: input.actorId ?? null,
    client_id: input.clientId ?? null,
    release: releaseName() ?? null,
    environment: environmentName(),
    fingerprint: buildFingerprint(area, normalised.name, message),
    context: buildContext(input.context),
  }
}

/** Structured single-line console output — parseable in Vercel's log viewer. */
function emitConsole(row: AppErrorRow): void {
  try {
    const line = {
      tag: "app-error",
      severity: row.severity,
      area: row.area,
      source: row.source,
      message: row.message,
      errorName: row.error_name,
      routePath: row.route_path,
      requestPath: row.request_path,
      requestId: row.request_id,
      fingerprint: row.fingerprint,
      digest: row.digest,
      actorType: row.actor_type,
      clientId: row.client_id,
      release: row.release,
      context: row.context,
    }
    const serialised = safeStringify(line)
    if (row.severity === "error") console.error(serialised)
    else if (row.severity === "warning") console.warn(serialised)
    else console.log(serialised)

    // The stack goes on its own line so the structured line stays parseable.
    if (row.stack) console.error(`[app-error:stack] ${row.fingerprint}\n${row.stack}`)
  } catch {
    // Console output failed. There is nowhere left to report that.
  }
}

/**
 * Persists the row. Uses the service-role client because `app_error_log` denies
 * writes to every browser role.
 *
 * The client is imported lazily and deliberately. `lib/supabase/admin` builds
 * its client at module scope and throws when the URL or service key is absent,
 * so a static import here would make merely *importing* the logger fail in any
 * context without those variables — and the logger is imported by almost
 * everything. Lazy import keeps that failure inside a catch block where it
 * belongs.
 *
 * The cost is two microtask turns before the insert lands, which matters only
 * to callers that abandon the promise (see the `after()` handling in the
 * scheduler specs).
 */
async function persist(row: AppErrorRow): Promise<void> {
  try {
    const { adminClient } = await import("@/lib/supabase/admin")
    const { error } = await adminClient.from("app_error_log").insert(row)
    if (error) {
      // Do not recurse into logAppError — a broken log table would loop.
      console.error(`[app-error] insert failed: ${error.message} (fingerprint ${row.fingerprint})`)
    }
  } catch (err) {
    console.error(
      `[app-error] insert threw: ${err instanceof Error ? err.message : String(err)} (fingerprint ${row.fingerprint})`
    )
  }
}

/**
 * Records an error. Awaiting is optional but preferred in route handlers and
 * cron jobs, where the runtime may freeze the process the moment the response
 * is returned and drop an unawaited insert.
 */
export async function logAppError(input: LogErrorInput): Promise<void> {
  let row: AppErrorRow
  try {
    row = buildErrorRow(input)
  } catch (err) {
    // Building the row is the last thing that should ever fail, but if it does
    // the original error must still reach the logs.
    console.error("[app-error] failed to build row", err, input?.area, input?.message)
    return
  }
  emitConsole(row)
  await persist(row)
}

/**
 * Fire-and-forget variant for render paths, where awaiting a log write would
 * delay the user's page. The rejection handler is attached inline so a failure
 * can never surface as an unhandled rejection.
 */
export function logAppErrorAsync(input: LogErrorInput): void {
  void logAppError(input).catch(() => {
    /* already reported to console inside logAppError */
  })
}

/** Convenience wrapper for a degraded-but-recovered path. */
export async function logAppWarning(input: Omit<LogErrorInput, "severity">): Promise<void> {
  await logAppError({ ...input, severity: "warning" })
}

/**
 * Records a business-workflow failure in **both** places: `workflow_errors`
 * (Matt's operational triage view, with its friendly copy) and `app_error_log`
 * (the engineering record, with the stack).
 *
 * Existing call sites wrote only the former, which meant Matt could see that an
 * email failed but nobody could see *why* once the Vercel logs rolled over.
 */
export async function logWorkflowFailure(input: {
  workflowName: string
  error: unknown
  payload?: Record<string, unknown>
  area?: string
  source?: ErrorSource
  clientId?: string | null
  requestId?: string
  /** Downgrade to "warning" for unproven failures (e.g. an unconfirmed
   *  delivery timeout) so Diagnostics doesn't count them as faults. */
  severity?: ErrorSeverity
}): Promise<void> {
  const { workflowName, error, payload, clientId, requestId } = input
  const area = input.area ?? `workflow.${workflowName}`

  await logAppError({
    area,
    source: input.source ?? "job",
    severity: input.severity,
    error,
    clientId: clientId ?? null,
    requestId,
    context: { workflowName, ...(payload ?? {}) },
  })

  // No environment precondition here: this insert must behave exactly like the
  // direct `adminClient.from("workflow_errors").insert(...)` calls it replaced.
  // Gating it on env vars would silently drop Matt's operational record in any
  // context where they are configured differently.
  try {
    const { adminClient } = await import("@/lib/supabase/admin")
    const { error: insertError } = await adminClient.from("workflow_errors").insert({
      workflow_name: workflowName,
      error_message: safeString(
        error instanceof Error ? error.message : String(error),
        LIMITS.message
      ),
      // `client_id` stays inside the payload as well as on the log row: the
      // existing workflow_errors rows carry it there, and anything reading that
      // history should not have to know which shape it came from.
      payload: buildContext({ ...(payload ?? {}), ...(clientId ? { client_id: clientId } : {}) }),
    })
    if (insertError) {
      console.error(`[app-error] workflow_errors insert failed: ${insertError.message}`)
    }
  } catch (err) {
    console.error(
      `[app-error] workflow_errors insert threw: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Wraps an operation so a throw is logged with context and then rethrown.
 * For best-effort work that must not fail the caller, use `runLogged` instead.
 */
export async function withLogging<T>(
  input: Omit<LogErrorInput, "error">,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    await logAppError({ ...input, error: err })
    throw err
  }
}

/**
 * Runs best-effort work: logs a throw and returns `fallback` instead of
 * propagating. This replaces the `try { … } catch { /* ignore *​/ }` pattern,
 * which is where failures went to die.
 */
export async function runLogged<T>(
  input: Omit<LogErrorInput, "error">,
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    await logAppError({ severity: "warning", ...input, error: err })
    return fallback
  }
}
