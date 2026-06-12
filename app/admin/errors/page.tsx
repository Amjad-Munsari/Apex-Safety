import { getWorkflowErrors } from "@/lib/supabase/dashboard"
import { describeWorkflowError } from "@/lib/workflow-errors"
import { Card } from "@/components/ui/card"
import { AlertCircle, Terminal } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ErrorsPage() {
  const errors = await getWorkflowErrors(50)

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

      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="bg-muted px-6 py-4 flex items-center gap-3 border-b border-border">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">System Output</span>
        </div>
        <div className="divide-y divide-border">
          {errors.map((error) => {
            const friendly = describeWorkflowError(error.workflow_name)
            return (
              <div key={error.id} className="p-8 flex flex-col gap-4 group">
                <div className="flex gap-5 items-start">
                  <div className="mt-0.5">
                    <AlertCircle className="w-5 h-5 text-danger/60" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-sans font-medium text-sm text-foreground">{friendly.title}</h3>
                      <span className="text-[10px] font-mono text-danger border border-danger/20 px-2 py-0.5 rounded-[2px] bg-danger/5">FAILED</span>
                    </div>
                    <p className="text-sm text-foreground/70 font-sans leading-relaxed mb-5 max-w-xl">
                      {friendly.message}
                    </p>
                    {error.details.length > 0 && (
                      <div className="flex flex-wrap gap-x-12 gap-y-2 mb-5">
                        {error.details.map((d) => (
                          <div key={d.label} className="flex items-baseline gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{d.label}</span>
                            <span className="text-xs font-sans text-foreground/85">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {new Date(error.created_at).toLocaleString('en-GB')}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {errors.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center">
              <Terminal className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">No operational errors detected</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
