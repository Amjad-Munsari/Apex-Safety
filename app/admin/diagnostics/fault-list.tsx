"use client"

import * as React from "react"
import { toast } from "sonner"
import { AlertTriangle, AlertCircle, Info, ChevronDown, Check, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { resolveFault, reopenFault } from "./actions"
import type { AppErrorGroup } from "@/lib/observability/query"

/**
 * Renders faults grouped by fingerprint, collapsed by default with the full
 * technical detail one click away.
 *
 * The collapse matters: the whole point of this page is that everything is
 * captured, and "everything" is unreadable if each entry dumps a 60-line stack.
 * Summary answers "what is broken and how often"; expanding answers "why".
 */

function severityIcon(severity: string) {
  if (severity === "error") return <AlertCircle className="w-4 h-4 text-danger" />
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-gold" />
  return <Info className="w-4 h-4 text-muted-foreground" />
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0 w-32">
        {label}
      </span>
      <span className="text-xs text-foreground/85 break-all">{value}</span>
    </div>
  )
}

export function FaultList({ groups }: { groups: AppErrorGroup[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState<string | null>(null)

  async function handleTriage(fingerprint: string, resolved: boolean) {
    setPending(fingerprint)
    try {
      const result = resolved ? await reopenFault(fingerprint) : await resolveFault(fingerprint)
      if (result.ok) {
        toast.success(resolved ? "Fault reopened" : `Resolved ${result.affected} occurrence(s)`)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Could not update. Try again.")
    } finally {
      setPending(null)
    }
  }

  if (groups.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No faults recorded for this filter. That means nothing matched — not that logging is off;
          use the probe button above to confirm the pipeline end to end.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {groups.map((group) => {
        const isOpen = expanded === group.fingerprint
        const latest = group.latest
        const isResolved = group.unresolvedCount === 0

        return (
          <div key={group.fingerprint} className="px-6 py-5">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : group.fingerprint)}
              className="w-full flex items-start gap-4 text-left group"
              aria-expanded={isOpen}
            >
              <span className="mt-0.5">{severityIcon(latest.severity)}</span>

              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {latest.area}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    {latest.source}
                  </span>
                  {isResolved && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-success border border-success/25 bg-success/5 px-1.5 py-0.5 rounded-[2px]">
                      Resolved
                    </span>
                  )}
                  {group.count > 1 && (
                    <span className="text-[10px] font-mono text-foreground/70 border border-border px-1.5 py-0.5 rounded-[2px]">
                      ×{group.count}
                    </span>
                  )}
                  {group.affectedClients > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {group.affectedClients} org{group.affectedClients === 1 ? "" : "s"} affected
                    </span>
                  )}
                </span>

                <span className="block text-sm text-foreground font-sans leading-snug break-words">
                  {latest.error_name ? `${latest.error_name}: ` : ""}
                  {latest.message}
                </span>

                <span className="block mt-1.5 text-xs text-muted-foreground font-mono">
                  {relativeTime(group.lastSeen)}
                  {latest.route_path ? ` · ${latest.route_path}` : ""}
                  {latest.release ? ` · ${latest.release}` : ""}
                </span>
              </span>

              <ChevronDown
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="mt-5 ml-8 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <DetailRow label="Fingerprint" value={<code>{group.fingerprint}</code>} />
                  <DetailRow label="First seen" value={new Date(group.firstSeen).toLocaleString()} />
                  <DetailRow label="Last seen" value={new Date(group.lastSeen).toLocaleString()} />
                  <DetailRow label="Occurrences" value={String(group.count)} />
                  <DetailRow label="Severity" value={latest.severity} />
                  <DetailRow label="Environment" value={latest.environment} />
                  <DetailRow label="Release" value={latest.release} />
                  <DetailRow label="Route" value={latest.route_path} />
                  <DetailRow
                    label="Request"
                    value={
                      latest.request_path
                        ? `${latest.request_method ?? ""} ${latest.request_path}`.trim()
                        : null
                    }
                  />
                  <DetailRow label="Request ID" value={latest.request_id} />
                  <DetailRow
                    label="Actor"
                    value={latest.actor_type ? `${latest.actor_type}${latest.actor_id ? ` · ${latest.actor_id}` : ""}` : null}
                  />
                  <DetailRow label="Org" value={latest.client_id} />
                  {/* The digest is what a user can read off the error screen —
                      it is the only handle they have, so it must be searchable here. */}
                  <DetailRow label="Digest" value={latest.digest} />
                </div>

                {latest.stack && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Stack
                    </span>
                    <pre className="bg-muted/50 border border-border rounded-sm p-4 text-[11px] font-mono text-foreground/80 overflow-x-auto whitespace-pre max-h-80">
                      {latest.stack}
                    </pre>
                  </div>
                )}

                {latest.context && Object.keys(latest.context).length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Context
                    </span>
                    <pre className="bg-muted/50 border border-border rounded-sm p-4 text-[11px] font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap max-h-80">
                      {JSON.stringify(latest.context, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending === group.fingerprint}
                    onClick={() => handleTriage(group.fingerprint, isResolved)}
                    className="rounded-sm font-mono text-[10px] uppercase tracking-widest h-8 gap-2"
                  >
                    {isResolved ? <RotateCcw className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    {pending === group.fingerprint
                      ? "Updating…"
                      : isResolved
                        ? "Reopen"
                        : "Mark resolved"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
