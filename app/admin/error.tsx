"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { reportClientError } from "@/lib/observability/report-client-error"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The copy below promises the user this was logged, so it has to actually
    // reach the durable log — console.error alone only ever reached this
    // browser's devtools.
    console.error("Admin Dashboard Error:", error)
    reportClientError(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-danger" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-serif text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground font-mono text-sm max-w-md">
          The admin dashboard encountered an unexpected error. This has been logged and we&apos;re looking into it.
        </p>
      </div>
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => window.location.href = "/admin"}
          className="border-border hover:bg-muted font-mono text-xs uppercase tracking-widest"
        >
          Return to Dashboard
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
            Error ID: {error.digest}
          </div>
        </div>
      )}
    </div>
  )
}
