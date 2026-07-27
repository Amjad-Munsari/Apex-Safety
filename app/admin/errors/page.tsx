import Link from "next/link"
import { Terminal } from "lucide-react"

import { getWorkflowErrors } from "@/lib/supabase/dashboard"
import { Card } from "@/components/ui/card"
import { ErrorList } from "./error-list"

export const dynamic = "force-dynamic"

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>
}) {
  const params = await searchParams
  // Default view is the work still outstanding; resolved rows are kept forever
  // and reachable through the filter, never deleted.
  const includeResolved = params.all === "1"
  const errors = await getWorkflowErrors(50, { includeResolved })

  const chipBase =
    "px-3 h-7 inline-flex items-center rounded-sm font-mono text-[10px] uppercase tracking-widest transition-colors border"
  const chipOn = "bg-gold text-gold-foreground border-gold"
  const chipOff = "text-muted-foreground border-border hover:text-foreground hover:bg-muted"

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-danger font-semibold">05</span>
            OPERATIONAL LOGS
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">
            Workflow Errors
          </h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            Monitor and triage failures in background automations, AI generations, and notification deliveries.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/errors"
          className={`${chipBase} ${!includeResolved ? chipOn : chipOff}`}
        >
          Outstanding
        </Link>
        <Link
          href="/admin/errors?all=1"
          className={`${chipBase} ${includeResolved ? chipOn : chipOff}`}
        >
          Include resolved
        </Link>
      </div>

      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="bg-muted px-6 py-4 flex items-center gap-3 border-b border-border">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            System Output
          </span>
        </div>
        <ErrorList errors={errors} />
      </Card>
    </div>
  )
}
