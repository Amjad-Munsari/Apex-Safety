import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { SettingsForm } from "@/components/admin/settings-form"
import { Card } from "@/components/ui/card"
import { getDashboardStats } from "@/lib/supabase/dashboard"
import { getAppSettings } from "@/lib/settings/app-settings"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const stats = await getDashboardStats()
  const errorCount = stats.errorCount ?? 0
  const settings = await getAppSettings()

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          <span className="text-teal font-semibold">11</span>
          PRACTICE SETTINGS
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-foreground">Settings.</h2>
        <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
          Branding, notifications, and the defaults that show up on every document the platform sends.
        </p>
      </div>

      <SettingsForm
        initial={{
          signOffName: settings.signOffName,
          senderName: settings.senderName,
          expiryRemindersEnabled: settings.expiryRemindersEnabled,
          notifyOnUpload: settings.notifyOnUpload,
          logoUrl: settings.logoUrl,
        }}
      />

      {/* System diagnostics */}
      <div className="flex flex-col gap-4 pt-6 border-t border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">System Diagnostics</span>

        <Link href="/admin/errors" className="block">
          <Card className="bg-card border-border hover:bg-muted transition-colors rounded-sm px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${errorCount > 0 ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground"}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-sans text-sm text-foreground tracking-wide">Workflow Errors</div>
                <div className="font-mono text-[11px] text-muted-foreground">
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
              <span className="font-mono text-muted-foreground">&rarr;</span>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
