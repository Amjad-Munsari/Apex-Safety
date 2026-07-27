"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/observability/report-client-error"

/**
 * Last-resort boundary: catches errors thrown in the root layout itself, which
 * no nested `error.tsx` can reach. Because it replaces the root layout, it must
 * render its own <html> and <body>.
 *
 * Styling is inline on purpose — if the failure happened while the root layout
 * was rendering, the app's stylesheet and font providers may never have loaded,
 * and a Tailwind-classed fallback would render as unstyled text.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error:", error)
    reportClientError(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e0f11",
          color: "#e8e6e3",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500, margin: "0 0 0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#9a9691", lineHeight: 1.6, margin: "0 0 1.75rem" }}>
            The application failed to load. The fault has been recorded. Try again, and if it keeps
            happening quote the reference below.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#c9a227",
              color: "#161512",
              border: "none",
              borderRadius: "2px",
              padding: "0.6rem 1.4rem",
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "2rem",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "0.7rem",
                color: "#6f6b66",
                letterSpacing: "0.05em",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
