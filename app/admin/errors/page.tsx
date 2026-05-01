import { getWorkflowErrors } from "@/lib/supabase/dashboard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, AlertCircle, RefreshCw, Terminal } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ErrorsPage() {
  const errors = await getWorkflowErrors()

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-danger font-semibold">07</span>
            OPERATIONAL LOGS
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">
            Workflow Errors
          </h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            Monitor and triage failures in background automations, AI generations, and notification deliveries.
          </p>
        </div>
      </div>

      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <div className="bg-[#151515] px-6 py-4 flex items-center gap-3 border-b border-white/5">
          <Terminal className="w-4 h-4 text-[#555]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">System Output</span>
        </div>
        <div className="divide-y divide-white/5">
          {errors.map((error) => (
            <div key={error.id} className="p-6 flex flex-col gap-4 group">
              <div className="flex justify-between items-start">
                <div className="flex gap-4 items-start">
                  <div className="mt-1">
                    <AlertCircle className="w-5 h-5 text-danger/60" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-mono text-sm text-white">{error.workflow_name}</h3>
                      <span className="text-[10px] font-mono text-danger border border-danger/20 px-2 py-0.5 rounded-[2px] bg-danger/5">FAILURE</span>
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#555] mb-3">
                      {new Date(error.created_at).toLocaleString('en-GB')}
                    </div>
                    <div className="bg-black/40 border border-white/5 p-4 rounded-sm">
                      <pre className="text-xs font-mono text-danger/80 whitespace-pre-wrap">
                        {error.error_message}
                      </pre>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="border-white/5 hover:bg-white/5 h-9 gap-2 text-xs font-mono uppercase tracking-widest" disabled>
                  <RefreshCw className="w-3.5 h-3.5" />
                  RETRY
                </Button>
              </div>
              {error.payload && (
                <div className="ml-9">
                  <details className="cursor-pointer group/details">
                    <summary className="text-[10px] font-mono uppercase tracking-widest text-[#444] hover:text-[#666] transition-colors">
                      View Payload
                    </summary>
                    <div className="mt-2 bg-black/20 p-3 rounded-sm border border-white/5">
                      <pre className="text-[10px] font-mono text-[#666]">
                        {JSON.stringify(error.payload, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              )}
            </div>
          ))}
          {errors.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center">
              <Terminal className="w-12 h-12 text-[#333] mb-4" />
              <p className="text-[#555] font-mono text-xs uppercase tracking-widest">No operational errors detected</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
