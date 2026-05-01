"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Admin Dashboard Error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-danger" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-serif text-white">Something went wrong</h2>
        <p className="text-muted-foreground font-mono text-sm max-w-md">
          The admin dashboard encountered an unexpected error. This has been logged and we're looking into it.
        </p>
      </div>
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => window.location.href = "/admin"}
          className="border-white/10 hover:bg-white/5 font-mono text-xs uppercase tracking-widest"
        >
          Return to Dashboard
        </Button>
        <Button
          onClick={() => reset()}
          className="bg-white text-black hover:bg-white/90 font-mono text-xs uppercase tracking-widest"
        >
          Try again
        </Button>
      </div>
      {error.digest && (
        <div className="mt-8 pt-8 border-t border-white/5 w-full max-w-xs">
          <div className="font-mono text-[10px] text-[#444] uppercase tracking-tighter">
            Error ID: {error.digest}
          </div>
        </div>
      )}
    </div>
  )
}
