import Link from "next/link"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { SettingsForm } from "@/components/admin/settings-form"
import { Card } from "@/components/ui/card"
import { getDashboardStats } from "@/lib/supabase/dashboard"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const stats = await getDashboardStats()
  const errorCount = stats.errorCount ?? 0

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
          <span className="text-white font-semibold">10</span>
          PRACTICE SETTINGS
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-white">Settings.</h2>
        <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
          Branding, notifications, and the defaults that show up on every document the platform sends.
        </p>
      </div>

      <SettingsForm />

      {/* System diagnostics */}
      <div className="flex flex-col gap-4 pt-6 border-t border-white/5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">System Diagnostics</span>

        <Link href="/admin/errors" className="block">
          <Card className="bg-[#1c1c1c] border-white/5 hover:bg-[#222] transition-colors rounded-sm px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${errorCount > 0 ? "bg-danger/10 text-danger" : "bg-white/5 text-white/40"}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-sans text-sm text-white tracking-wide">Workflow Errors</div>
                <div className="font-mono text-[11px] text-white/50">
                  Failed automations and integration errors from the last 24 hours.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full leading-none ${
                errorCount > 0 ? "text-danger bg-danger/10" : "text-success bg-success/10"
              }`}>
                {errorCount > 0 ? `${errorCount} ${errorCount === 1 ? "failing" : "failing"}` : "All clear"}
              </span>
              <span className="font-mono text-white/30">&rarr;</span>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
