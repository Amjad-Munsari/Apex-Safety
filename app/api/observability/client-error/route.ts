import { NextResponse } from "next/server"

import { getUser, isAdmin, getClientContext } from "@/lib/auth-helpers"
import { clientIpFrom, consumeRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { logAppError, type ActorType } from "@/lib/observability/log"

/**
 * Receives errors from the browser bundle so a fault the user hits is visible
 * to us even though it never touched a server handler — hydration mismatches,
 * a client component throwing mid-interaction, a rejected fetch inside an
 * onClick. Those are invisible to `onRequestError`, which only sees the server.
 *
 * Threat model: this is an unauthenticated write path into a log table, so it
 * is treated as hostile input.
 *  - The **actor is re-derived server-side** from the session. The body's
 *    opinion about who it is, or which org it belongs to, is discarded — a
 *    forged report cannot attribute itself to Matt or to another client.
 *  - **Rate limited per IP**, so it cannot be used to flood the table. The
 *    limiter fails open by design (see lib/rate-limit), which is acceptable
 *    here because the write is size-capped and non-destructive.
 *  - **Every field is capped and redacted** by the logger before storage.
 *  - Reports are stored at `warning`, not `error`: browser noise (extensions,
 *    aborted navigations) is real but shouldn't outrank a server fault in
 *    triage.
 */

export const runtime = "nodejs"

/** Generous enough for a genuinely broken page, tight enough to bound abuse. */
const MAX_REPORTS_PER_IP = 30
const WINDOW_SECONDS = 60

/** Browser noise that says nothing about our code. Dropped before storage. */
const IGNORED_MESSAGE_PATTERNS: readonly RegExp[] = [
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
  /^Script error\.?$/i,                       // cross-origin, no detail available
  /Non-Error promise rejection captured/i,
  /The (play\(\) request|operation) was (interrupted|aborted)/i,
  /Failed to fetch dynamically imported module/i, // user on a stale deploy
  /Load failed$/i,
  /NetworkError when attempting to fetch resource/i,
  /extension context invalidated/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
]

function isIgnorable(message: string): boolean {
  return IGNORED_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
}

interface ClientErrorReport {
  message?: unknown
  name?: unknown
  stack?: unknown
  digest?: unknown
  kind?: unknown
  url?: unknown
  componentStack?: unknown
  release?: unknown
  userAgent?: unknown
}

function asString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFrom(request.headers)
    const limit = await consumeRateLimit(
      rateLimitKey("client_error", ip),
      MAX_REPORTS_PER_IP,
      WINDOW_SECONDS
    )
    // 204 rather than 429: the browser has nothing useful to do with a refusal,
    // and telling a flooder it hit a limit only helps it tune.
    if (!limit.allowed) return new NextResponse(null, { status: 204 })

    let body: ClientErrorReport
    try {
      body = (await request.json()) as ClientErrorReport
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    }

    const message = asString(body.message, 4000)
    if (!message) return NextResponse.json({ ok: false, error: "message_required" }, { status: 400 })
    if (isIgnorable(message)) return new NextResponse(null, { status: 204 })

    // Identity comes from the session cookie, never from the payload.
    const user = await getUser()
    let actorType: ActorType = user ? "client" : "anon"
    let clientId: string | null = null
    if (user) {
      if (await isAdmin()) {
        actorType = "admin"
      } else {
        const ctx = await getClientContext()
        clientId = ctx?.client_id ?? null
      }
    }

    await logAppError({
      area: `browser.${asString(body.kind, 40) ?? "error"}`,
      source: "browser",
      severity: "warning",
      message,
      context: {
        errorName: asString(body.name, 200),
        stack: asString(body.stack, 20000),
        componentStack: asString(body.componentStack, 8000),
        pageUrl: asString(body.url, 1000),
        userAgent: asString(body.userAgent, 400) ?? request.headers.get("user-agent") ?? undefined,
        reportedRelease: asString(body.release, 100),
      },
      digest: asString(body.digest, 200),
      requestPath: asString(body.url, 1000),
      requestId: request.headers.get("x-vercel-id") ?? undefined,
      actorType,
      actorId: user?.id ?? null,
      clientId,
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    // Reporting must never become the thing that errors. Swallow, note it, move on.
    console.error("[client-error] failed to record report", err)
    return new NextResponse(null, { status: 204 })
  }
}
