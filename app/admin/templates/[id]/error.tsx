"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { reportClientError } from "@/lib/observability/report-client-error"

export default function TemplateEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Template editor error:", error)
    reportClientError(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-danger/10 ring-1 ring-danger/30 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-danger" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-serif text-foreground">Template editor unavailable</h2>
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
          This template&apos;s schema couldn&apos;t be loaded into the builder.
        </p>
        <p className="text-muted-foreground text-sm pt-2">
          The schema may be in an older format. The published version is still safe — open it directly or return to the templates list.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/admin/templates">
          <Button
            variant="outline"
            className="border-border hover:bg-muted font-mono text-xs uppercase tracking-widest"
          >
            Back to templates
          </Button>
        </Link>
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
