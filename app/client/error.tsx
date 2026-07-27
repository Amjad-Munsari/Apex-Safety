"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { reportClientError } from "@/lib/observability/report-client-error"

/**
 * Client-portal error boundary. Without one, a throw anywhere under /client
 * fell through to Next's default error page — which shows a customer of Matt's
 * a bare stack-trace shell in development and an unbranded message in
 * production, and reported nothing.
 */
export default function ClientPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Client portal error:", error)
    reportClientError(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-danger/10 ring-1 ring-danger/30 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-danger" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-serif text-foreground">This page couldn&apos;t be loaded</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Something went wrong on our side. Your data is safe and nothing you submitted has been
          lost. Try again, and if it keeps happening contact your consultant with the reference
          below.
        </p>
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => { window.location.href = "/client" }}
          className="border-border hover:bg-muted font-mono text-xs uppercase tracking-widest"
        >
          Back to portal
        </Button>
        <Button
          onClick={() => reset()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs uppercase tracking-widest"
        >
          Try again
        </Button>
      </div>
      {error.digest && (
        <div className="mt-8 pt-8 border-t border-border w-full max-w-xs">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-tighter">
            Reference: {error.digest}
          </div>
        </div>
      )}
    </div>
  )
}
