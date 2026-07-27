"use client"

/**
 * Reports an error from a React error boundary.
 *
 * Error boundaries are the only place a component stack exists, and that stack
 * is usually the difference between "something threw during render" and knowing
 * which component did. The window-level listeners in instrumentation-client
 * never see it, because React catches the throw before it reaches window.
 *
 * Prefers the reporter installed by instrumentation-client (shared per-page
 * caps and deduping) and falls back to posting directly, so a boundary still
 * reports if that module failed to initialise.
 */

const ENDPOINT = "/api/observability/client-error"

export function reportClientError(
  error: Error & { digest?: string },
  componentStack?: string
): void {
  try {
    const payload = {
      kind: "react" as const,
      message: error?.message || String(error),
      name: error?.name,
      stack: error?.stack,
      digest: error?.digest,
      componentStack,
    }

    const shared = typeof window !== "undefined" ? window.__merlinReportClientError : undefined
    if (shared) {
      shared(payload)
      return
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
      keepalive: true,
    }).catch(() => {
      /* best effort */
    })
  } catch {
    /* a failure to report must never mask the error being reported */
  }
}
