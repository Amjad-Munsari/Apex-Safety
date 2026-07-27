/**
 * Browser-side error capture. Runs after the document loads and before React
 * hydrates, so it is already listening when the first hydration error fires —
 * which is the single most common client fault and the one users report as
 * "the page just went blank".
 *
 * Kept deliberately small: this file blocks interactivity, and Next warns above
 * 16ms of init. No dependencies, no framework, one listener each.
 *
 * Delivery uses `sendBeacon` when available so a report survives the user
 * navigating away or closing the tab mid-failure — a plain `fetch` is cancelled
 * on unload, which loses exactly the errors that caused the user to leave.
 */

const ENDPOINT = "/api/observability/client-error"

/**
 * Per-page-load cap. A render loop can throw thousands of times a second; an
 * uncapped reporter turns a UI bug into a self-inflicted request flood.
 */
const MAX_REPORTS_PER_PAGE = 10
let reportsSent = 0

/** Collapses identical repeats within a page load. */
const seen = new Set<string>()

interface ReportInput {
  kind: "error" | "unhandledrejection" | "react"
  message: string
  name?: string
  stack?: string
  digest?: string
  componentStack?: string
}

function report(input: ReportInput): void {
  try {
    if (reportsSent >= MAX_REPORTS_PER_PAGE) return

    const dedupeKey = `${input.kind}:${input.name ?? ""}:${input.message}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    reportsSent += 1

    const body = JSON.stringify({
      ...input,
      url: window.location.href,
      userAgent: navigator.userAgent,
    })

    // Beacon first: survives unload. Falls back to keepalive fetch where the
    // payload exceeds the beacon size limit or the API is unavailable.
    if (typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))
      if (queued) return
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* reporting is best-effort — never surface a failure to report */
    })
  } catch {
    /* never let the reporter throw inside an error handler */
  }
}

/** Exposed so React error boundaries can report with their component stack. */
declare global {
  interface Window {
    __merlinReportClientError?: (input: ReportInput) => void
  }
}

try {
  window.__merlinReportClientError = report

  window.addEventListener("error", (event: ErrorEvent) => {
    report({
      kind: "error",
      message: event.message || String(event.error ?? "Unknown error"),
      name: event.error instanceof Error ? event.error.name : undefined,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    })
  })

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason
    report({
      kind: "unhandledrejection",
      message:
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection",
      name: reason instanceof Error ? reason.name : undefined,
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
} catch {
  /* an environment without window/addEventListener needs no reporting */
}

export function onRouterTransitionStart(url: string): void {
  // A fresh route gets a fresh budget: the caps above exist to stop a single
  // broken render looping, not to stop reporting for the rest of the session.
  reportsSent = 0
  seen.clear()
  void url
}
