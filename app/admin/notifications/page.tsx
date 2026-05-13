import Link from "next/link"
import { ArrowLeft, Bell } from "lucide-react"
import { Card } from "@/components/ui/card"
import { adminClient } from "@/lib/supabase/admin"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

function formatType(raw: string | null): string {
  if (!raw) return "Reminder"
  // Convert snake_case / dash_case to Title Case
  return raw
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatWindow(days: number | null): string {
  if (days === null || days === undefined) return "—"
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return "Today"
  return `${days}d before`
}

export default async function NotificationsPage() {
  // Reminder log is the notifications_sent dedup ledger written by the cron
  // route after each successful expiry dispatch (Phase 1, Module 2). Joined
  // with client + document for readable rows.
  const { data: rows } = await adminClient
    .from("notifications_sent")
    .select(`
      id,
      notification_type,
      alert_window,
      sent_at,
      client:clients(name, contact_email),
      document:documents(filename, document_category, expiry_date)
    `)
    .order("sent_at", { ascending: false })
    .limit(200)

  const entries = (rows ?? []).map((row: any) => {
    const clientRow = Array.isArray(row.client) ? row.client[0] : row.client
    const docRow = Array.isArray(row.document) ? row.document[0] : row.document
    return {
      id: row.id as string,
      sentAt: row.sent_at as string,
      clientName: clientRow?.name ?? "Unknown client",
      clientEmail: clientRow?.contact_email ?? null,
      documentName: docRow?.filename ?? null,
      documentCategory: docRow?.document_category ?? null,
      type: row.notification_type as string | null,
      window: row.alert_window as number | null,
    }
  })

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-white font-semibold">09</span>
            REMINDER LOG
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">Notifications.</h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            Every expiry reminder the cron job has dispatched on Matt&apos;s behalf — newest first.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#666]">
          <span>Total Sent</span>
          <span className="font-serif text-[28px] leading-none text-[#3b8273]">{entries.length}</span>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden p-0">
        {entries.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <Bell className="w-8 h-8 text-white/20 mb-4" />
            <p className="text-white/60 text-base font-serif">No reminders sent yet.</p>
            <p className="text-white/30 text-xs mt-2 max-w-md">
              When the daily cron job dispatches an expiry reminder, it logs the send here so we
              don&apos;t double-notify on the same document and window.
            </p>
          </div>
        ) : (
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-[#151515]">
              <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                <th className="font-normal px-6 py-4 border-b border-white/5">Sent</th>
                <th className="font-normal px-4 py-4 border-b border-white/5">Client</th>
                <th className="font-normal px-4 py-4 border-b border-white/5">Document</th>
                <th className="font-normal px-4 py-4 border-b border-white/5">Type</th>
                <th className="font-normal px-6 py-4 border-b border-white/5 text-right">Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs text-white/80">
                      {new Date(e.sentAt).toLocaleString("en-GB", DATE_FMT)}
                    </div>
                    <div className="font-mono text-[10px] text-[#555] uppercase tracking-[0.2em] mt-0.5">
                      {e.id.slice(0, 8).toUpperCase()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-white text-sm">{e.clientName}</div>
                    <div className="text-[#888] text-xs mt-0.5">{e.clientEmail ?? "—"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-white/80 text-sm">{e.documentName ?? "—"}</div>
                    <div className="text-[#888] text-xs mt-0.5">{e.documentCategory ?? ""}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-2 border border-white/10 rounded-sm px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-white/70">
                      {formatType(e.type)}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-right font-mono text-xs",
                    e.window !== null && e.window < 0 ? "text-[#e06050]" :
                    e.window !== null && e.window <= 7 ? "text-amber-500" :
                    "text-white/70"
                  )}>
                    {formatWindow(e.window)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
