"use client"

import { useState } from "react"
import { ChevronDown, Download, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FileDownloadMenuProps {
  /** Trigger label, e.g. "Download report", "Download document". */
  label?: string
  /** Download the file (force-save). Async handlers show a "Preparing…" state. */
  onDownload: () => void | Promise<void>
  /** Open the file in a new tab. Omit to render a download-only menu. */
  onView?: () => void | Promise<void>
  /** Disable the control (e.g. no file available yet). */
  disabled?: boolean
  /** "md" (default, h-12) for list rows; "sm" (h-9) for dense rows like the dashboard. */
  size?: "sm" | "md"
}

/**
 * The single, canonical "download a file" control for the client portal. Every
 * file row/card (reports, compliance docs, contracts, assessment reports,
 * dashboard attention docs) uses this so the affordance looks identical across
 * pages. Surfaces supply the actual download/view logic via callbacks (signed
 * URLs are resolved server-side per surface).
 */
export function FileDownloadMenu({
  label = "Download",
  onDownload,
  onView,
  disabled,
  size = "md",
}: FileDownloadMenuProps) {
  const [pending, setPending] = useState(false)
  const sm = size === "sm"

  const run = (fn: () => void | Promise<void>) => async () => {
    setPending(true)
    try {
      await fn()
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || pending}
        className={`flex items-center border border-border rounded-sm group/btn cursor-pointer bg-card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all p-0 disabled:opacity-50 disabled:cursor-not-allowed ${sm ? "h-9" : "h-12"}`}
      >
        <div className={`h-full flex items-center justify-center border-r border-border group-hover/btn:bg-muted transition-colors ${sm ? "w-7" : "w-8"}`}>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover/btn:text-foreground transition-colors" />
        </div>
        <div className={`h-full flex items-center justify-center group-hover/btn:bg-muted transition-colors ${sm ? "px-3.5 min-w-[110px]" : "px-5 min-w-[140px]"}`}>
          <span className={`font-sans font-bold tracking-tight text-foreground ${sm ? "text-[11px]" : "text-[12px]"}`}>
            {pending ? "Preparing…" : label}
          </span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-sm border-border p-1 shadow-md bg-card">
        <DropdownMenuItem
          onClick={run(onDownload)}
          className="text-[10px] font-mono font-bold uppercase tracking-widest p-3 cursor-pointer h-10 flex items-center gap-3 text-foreground hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </DropdownMenuItem>
        {onView && (
          <DropdownMenuItem
            onClick={run(onView)}
            className="text-[10px] font-mono font-bold uppercase tracking-widest p-3 cursor-pointer h-10 flex items-center gap-3 text-foreground hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View Online
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
