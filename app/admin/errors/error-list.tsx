"use client"

import * as React from "react"
import { toast } from "sonner"
import { AlertCircle, Check, CheckCircle2, RotateCcw, Terminal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { describeWorkflowError } from "@/lib/workflow-errors"
import type { WorkflowErrorWithDetails } from "@/lib/supabase/dashboard"
import { resolveWorkflowError, reopenWorkflowError } from "./actions"

/**
 * The operational error log, one row per failed workflow.
 *
 * Each row owns an action area at the bottom rather than a single hard-coded
 * button, because triage here will grow: Retry (re-dispatching the email that
 * failed) lands next to Resolve once the outbox exists.
 */
export function ErrorList({ errors }: { errors: WorkflowErrorWithDetails[] }) {
  // One pending id at a time is enough: the disabled button is what stops a
  // double-click from firing the action twice.
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  async function handleTriage(id: string, resolved: boolean) {
    if (pendingId) return
    setPendingId(id)
    try {
      const result = resolved ? await reopenWorkflowError(id) : await resolveWorkflowError(id)
      if (result.ok) {
        if (result.affected === 0) {
          toast.info(resolved ? "Already unresolved." : "Already resolved.")
        } else {
          toast.success(resolved ? "Error reopened" : "Marked as resolved")
        }
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Could not update. Try again.")
    } finally {
      setPendingId(null)
    }
  }

  if (errors.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Terminal className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
          No operational errors detected
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {errors.map((error) => {
        const friendly = describeWorkflowError(error.workflow_name)
        const isPending = pendingId === error.id

        return (
          <div key={error.id} className="p-8 flex flex-col gap-4 group">
            <div className="flex gap-5 items-start">
              <div className="mt-0.5">
                {error.resolved ? (
                  <CheckCircle2 className="w-5 h-5 text-success/70" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-danger/60" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-sans font-medium text-sm text-foreground">{friendly.title}</h3>
                  {error.resolved ? (
                    <span className="text-[10px] font-mono uppercase text-success border border-success/25 px-2 py-0.5 rounded-[2px] bg-success/5">
                      Resolved
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-danger border border-danger/20 px-2 py-0.5 rounded-[2px] bg-danger/5">
                      FAILED
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/70 font-sans leading-relaxed mb-5 max-w-xl">
                  {friendly.message}
                </p>
                {error.details.length > 0 && (
                  <div className="flex flex-wrap gap-x-12 gap-y-2 mb-5">
                    {error.details.map((d) => (
                      <div key={d.label} className="flex items-baseline gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          {d.label}
                        </span>
                        <span className="text-xs font-sans text-foreground/85">{d.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {new Date(error.created_at).toLocaleString("en-GB")}
                  </div>
                  {/* Per-row action area — Retry joins Resolve here. */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleTriage(error.id, error.resolved)}
                      className="rounded-sm font-mono text-[10px] uppercase tracking-widest h-8 gap-2"
                    >
                      {error.resolved ? <RotateCcw className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      {isPending ? "Updating…" : error.resolved ? "Reopen" : "Mark resolved"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
