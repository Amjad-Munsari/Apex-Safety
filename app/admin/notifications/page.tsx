import Link from "next/link"
import { ArrowLeft, Mail, MessageSquare } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type Channel = "Email" | "SMS"
type Status = "Delivered" | "Failed" | "Pending"

type Entry = {
  id: string
  date: string
  recipient: string
  recipientEmail: string
  channel: Channel
  subject: string
  status: Status
  kind: "Expiry" | "Upload" | "Proposal" | "Contract"
}

const entries: Entry[] = [
  { id: "NTF-2188", date: "02 May 2026 · 09:14", recipient: "Sarah Whitfield", recipientEmail: "sarah@hallamhouse.co.uk", channel: "Email", subject: "Fire Risk Assessment expires in 30 days",        status: "Delivered", kind: "Expiry" },
  { id: "NTF-2187", date: "02 May 2026 · 09:14", recipient: "Sarah Whitfield", recipientEmail: "07700 900 412",         channel: "SMS",   subject: "Document expiring — review by 1 Jun",            status: "Delivered", kind: "Expiry" },
  { id: "NTF-2185", date: "01 May 2026 · 17:42", recipient: "Helena Marsh",    recipientEmail: "helena@yellowbroom.co.uk", channel: "Email", subject: "Your proposal from Dineen Fire & Safety",       status: "Delivered", kind: "Proposal" },
  { id: "NTF-2184", date: "01 May 2026 · 17:42", recipient: "Helena Marsh",    recipientEmail: "07700 900 188",         channel: "SMS",   subject: "Proposal sent — please review",                  status: "Pending",   kind: "Proposal" },
  { id: "NTF-2180", date: "30 Apr 2026 · 11:08", recipient: "Owen Greaves",    recipientEmail: "owen@northgatemills.com", channel: "Email", subject: "Contract counter-signed — copy attached",       status: "Delivered", kind: "Contract" },
  { id: "NTF-2179", date: "30 Apr 2026 · 11:07", recipient: "Owen Greaves",    recipientEmail: "owen@northgatemills.com", channel: "Email", subject: "PAT Testing Certificate uploaded to your portal", status: "Delivered", kind: "Upload" },
  { id: "NTF-2174", date: "29 Apr 2026 · 16:33", recipient: "Sarah Whitfield", recipientEmail: "sarah@hallamhouse.co.uk", channel: "Email", subject: "EICR 2024 has expired — action required",       status: "Delivered", kind: "Expiry" },
  { id: "NTF-2168", date: "28 Apr 2026 · 14:22", recipient: "Helena Marsh",    recipientEmail: "helena@yellowbroom.co.uk", channel: "Email", subject: "Contract sent for signature",                   status: "Delivered", kind: "Contract" },
  { id: "NTF-2160", date: "27 Apr 2026 · 09:00", recipient: "Lewis Mahoney",   recipientEmail: "lewis@bramleycarehomes.co.uk", channel: "Email", subject: "Legionella Risk Assessment — 30 day reminder", status: "Failed",  kind: "Expiry" },
  { id: "NTF-2155", date: "26 Apr 2026 · 13:15", recipient: "Sarah Whitfield", recipientEmail: "sarah@hallamhouse.co.uk", channel: "Email", subject: "Fire Warden Training certificate uploaded",     status: "Delivered", kind: "Upload" },
]

export default function NotificationsPage() {
  const counts = {
    delivered: entries.filter((e) => e.status === "Delivered").length,
    pending: entries.filter((e) => e.status === "Pending").length,
    failed: entries.filter((e) => e.status === "Failed").length,
  }

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
            COMMS LOG
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">Notifications.</h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            Every email and SMS the platform has sent on Matt&apos;s behalf.
          </p>
        </div>

        <div className="flex gap-8 font-mono text-[10px] uppercase tracking-[0.25em] text-[#666]">
          <Stat label="Delivered" value={counts.delivered} tone="success" />
          <Stat label="Pending" value={counts.pending} tone="gold" />
          <Stat label="Failed" value={counts.failed} tone="danger" />
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden p-0">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-[#151515]">
            <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
              <th className="font-normal px-6 py-4 border-b border-white/5">Date</th>
              <th className="font-normal px-4 py-4 border-b border-white/5">Recipient</th>
              <th className="font-normal px-4 py-4 border-b border-white/5">Channel</th>
              <th className="font-normal px-4 py-4 border-b border-white/5">Subject</th>
              <th className="font-normal px-6 py-4 border-b border-white/5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="font-mono text-xs text-white/80">{e.date}</div>
                  <div className="font-mono text-[10px] text-[#555] uppercase tracking-[0.2em] mt-0.5">
                    {e.id}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-white text-sm">{e.recipient}</div>
                  <div className="text-[#888] text-xs mt-0.5">{e.recipientEmail}</div>
                </td>
                <td className="px-4 py-4">
                  <ChannelChip channel={e.channel} />
                </td>
                <td className="px-4 py-4 text-white/80 text-sm">
                  <div className="flex items-center gap-3">
                    <KindTag kind={e.kind} />
                    <span>{e.subject}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <StatusChip status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "gold" | "danger" }) {
  const color = tone === "success" ? "text-[#3b8273]" : tone === "gold" ? "text-amber-500" : "text-[#e06050]"
  return (
    <div className="flex flex-col items-end gap-1">
      <span>{label}</span>
      <span className={cn("font-serif text-[28px] leading-none", color)}>{value}</span>
    </div>
  )
}

function ChannelChip({ channel }: { channel: Channel }) {
  const Icon = channel === "Email" ? Mail : MessageSquare
  return (
    <div className="inline-flex items-center gap-2 border border-white/10 rounded-sm px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-white/70">
      <Icon className="w-3 h-3 opacity-70" />
      {channel}
    </div>
  )
}

function StatusChip({ status }: { status: Status }) {
  const cfg = {
    Delivered: { color: "border-[#3b8273]/40 text-[#3b8273]", dot: "bg-[#3b8273]" },
    Pending:   { color: "border-amber-500/40 text-amber-500", dot: "bg-amber-500" },
    Failed:    { color: "border-[#e06050]/40 text-[#e06050]", dot: "bg-[#e06050]" },
  }[status]
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-[10px] font-mono uppercase tracking-[0.2em] leading-none", cfg.color)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {status}
    </div>
  )
}

function KindTag({ kind }: { kind: Entry["kind"] }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#555] w-[68px] shrink-0">
      {kind}
    </span>
  )
}
