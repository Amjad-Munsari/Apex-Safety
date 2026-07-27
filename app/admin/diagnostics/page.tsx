import Link from "next/link"
import { Terminal, ShieldAlert } from "lucide-react"

import { Card } from "@/components/ui/card"
import { getAppErrorGroups, getAppErrorSummary, type AppErrorFilters } from "@/lib/observability/query"
import { FaultList } from "./fault-list"
import { ProbeButton } from "./probe-button"

export const dynamic = "force-dynamic"

/**
 * Engineering diagnostics: every captured fault, with stack, route, actor and
 * release.
 *
 * Kept separate from /admin/errors on purpose. That page is Matt's operational
 * view — "did an email or a report fail for a client?" — written in plain
 * language, one row per business workflow. This page is the raw record, and
 * mixing the two would make the operational page unreadable and this one
 * useless.
 */

const SEVERITIES = ["error", "warning", "info"] as const
const SOURCES = ["render", "route", "action", "proxy", "cron", "browser", "job", "external"] as const

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="bg-card border-border rounded-sm p-5 flex flex-col gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-serif text-[28px] leading-none text-foreground">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Card>
  )
}

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; source?: string; all?: string; window?: string }>
}) {
  const params = await searchParams

  // Default view: unresolved faults from the last 7 days. Everything is stored;
  // the default is just the slice worth looking at first.
  const windowDays = params.window === "30" ? 30 : params.window === "1" ? 1 : 7
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const filters: AppErrorFilters = {
    severity: SEVERITIES.includes(params.severity as (typeof SEVERITIES)[number])
      ? params.severity
      : undefined,
    source: SOURCES.includes(params.source as (typeof SOURCES)[number]) ? params.source : undefined,
    unresolvedOnly: params.all !== "1",
    since,
  }

  const [{ groups, totalRows, degraded }, summary] = await Promise.all([
    getAppErrorGroups(filters),
    getAppErrorSummary(),
  ])

  function filterHref(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams()
    const current: Record<string, string | undefined> = {
      severity: params.severity,
      source: params.source,
      all: params.all,
      window: params.window,
      ...next,
    }
    for (const [key, value] of Object.entries(current)) {
      if (value) merged.set(key, value)
    }
    const query = merged.toString()
    return query ? `/admin/diagnostics?${query}` : "/admin/diagnostics"
  }

  const chipBase =
    "px-3 h-7 inline-flex items-center rounded-sm font-mono text-[10px] uppercase tracking-widest transition-colors border"
  const chipOn = "bg-gold text-gold-foreground border-gold"
  const chipOff = "text-muted-foreground border-border hover:text-foreground hover:bg-muted"

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          <span className="text-danger font-semibold">06</span>
          DIAGNOSTICS
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-foreground">Error Log</h2>
        <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-2xl">
          Every fault the platform captures — server renders, route handlers, server actions,
          scheduled jobs, outbound providers, and browser sessions — grouped by cause with the full
          stack and request context. For plain-language delivery and automation failures, see{" "}
          <Link href="/admin/errors" className="underline underline-offset-4 hover:text-foreground">
            Workflow Errors
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Last 24 hours" value={summary.last24h} />
        <StatTile label="Last 7 days" value={summary.last7d} />
        <StatTile label="Unresolved" value={summary.unresolved} />
        <StatTile
          label="Distinct faults"
          value={summary.distinctFaults}
          hint={`${summary.browserShare}% from browsers`}
        />
      </div>

      {degraded && (
        <Card className="bg-danger/5 border-danger/30 rounded-sm p-5 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80">
            The error log could not be read, so this page is empty for a reason unrelated to how
            many faults exist. Treat an empty list here as unknown, not as all-clear.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={filterHref({ severity: undefined })} className={`${chipBase} ${!params.severity ? chipOn : chipOff}`}>
          All severities
        </Link>
        {SEVERITIES.map((severity) => (
          <Link
            key={severity}
            href={filterHref({ severity })}
            className={`${chipBase} ${params.severity === severity ? chipOn : chipOff}`}
          >
            {severity}
          </Link>
        ))}

        <span className="w-px h-5 bg-border mx-1" />

        <Link href={filterHref({ source: undefined })} className={`${chipBase} ${!params.source ? chipOn : chipOff}`}>
          All sources
        </Link>
        {SOURCES.map((source) => (
          <Link
            key={source}
            href={filterHref({ source })}
            className={`${chipBase} ${params.source === source ? chipOn : chipOff}`}
          >
            {source}
          </Link>
        ))}

        <span className="w-px h-5 bg-border mx-1" />

        {(["1", "7", "30"] as const).map((days) => (
          <Link
            key={days}
            href={filterHref({ window: days })}
            className={`${chipBase} ${String(windowDays) === days ? chipOn : chipOff}`}
          >
            {days}d
          </Link>
        ))}

        <Link
          href={filterHref({ all: params.all === "1" ? undefined : "1" })}
          className={`${chipBase} ${params.all === "1" ? chipOn : chipOff}`}
        >
          Include resolved
        </Link>

        <span className="flex-1" />
        <ProbeButton />
      </div>

      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="bg-muted px-6 py-4 flex items-center gap-3 border-b border-border">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {groups.length} fault{groups.length === 1 ? "" : "s"} · {totalRows} occurrence
            {totalRows === 1 ? "" : "s"} · last {windowDays}d
          </span>
        </div>
        <FaultList groups={groups} />
      </Card>
    </div>
  )
}
