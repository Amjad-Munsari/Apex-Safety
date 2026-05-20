"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Building2, Download, Eye, FileText, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getComplianceDocSignedUrl, sendManualExpiryReminder } from "./actions"

export interface ComplianceDocRow {
  id: string
  filename: string
  document_category: string | null
  expiry_date: string | null
  client: { id: string; name: string } | null
}

interface Props {
  doc: ComplianceDocRow
  color: string
  daysLeft: number | null
  expDateLabel: string
  showReminder: boolean
}

export function ComplianceDocRowItem({ doc, color, daysLeft, expDateLabel, showReminder }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [viewPending, setViewPending] = useState(false)
  const [reminderPending, setReminderPending] = useState(false)
  const clientId = doc.client?.id

  const goToClient = () => {
    if (clientId) router.push(`/admin/clients/${clientId}`)
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    startTransition(async () => {
      const { url, filename } = await getComplianceDocSignedUrl(doc.id, { mode: "download" })
      if (!url) {
        toast.error(`Could not prepare ${doc.filename} for download.`)
        return
      }
      const link = document.createElement("a")
      link.href = url
      link.download = filename ?? doc.filename
      link.rel = "noopener noreferrer"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  const handleView = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewPending(true)
    try {
      const { url } = await getComplianceDocSignedUrl(doc.id, { mode: "view" })
      if (!url) {
        toast.error(`Could not open ${doc.filename}.`)
        return
      }
      window.open(url, "_blank", "noopener,noreferrer")
    } finally {
      setViewPending(false)
    }
  }

  const handleReminder = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setReminderPending(true)
    try {
      const result = await sendManualExpiryReminder(doc.id)
      if (result.ok) {
        toast.success(`Reminder sent to ${doc.client?.name ?? "client"}`, {
          description: `Email dispatched re: ${doc.filename}.`,
        })
      } else {
        toast.error(`Reminder failed: ${result.error ?? "unknown error"}`)
      }
    } finally {
      setReminderPending(false)
    }
  }

  return (
    <tr
      onClick={goToClient}
      className={`hover:bg-white/[0.04] transition-colors group ${clientId ? "cursor-pointer" : ""}`}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
          <div>
            <div className="font-medium text-white">{doc.filename}</div>
            <div className="text-[10px] text-[#666] font-mono uppercase tracking-widest">{doc.document_category}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 text-white/70">
          <Building2 className="w-3.5 h-3.5" />
          {doc.client?.name}
        </div>
      </td>
      <td className="px-4 py-4 font-mono text-white/50 text-sm">{expDateLabel}</td>
      <td className="px-4 py-4">
        {daysLeft !== null && (
          <Badge variant="outline" className={`border-${color}/40 text-${color} bg-${color}/5 font-mono text-[10px] uppercase tracking-widest`}>
            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </Badge>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-end gap-1.5">
          {showReminder && (
            <button
              type="button"
              onClick={handleReminder}
              disabled={reminderPending}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm ring-1 ring-${color}/30 text-${color} hover:bg-${color}/10 disabled:opacity-50 disabled:cursor-progress transition-colors font-mono text-[10px] uppercase tracking-widest`}
              aria-label="Send reminder"
            >
              <Send className="w-3 h-3" />
              {reminderPending ? "Sending…" : "Send reminder"}
            </button>
          )}
          <button
            type="button"
            onClick={handleView}
            disabled={viewPending}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm ring-1 ring-white/10 text-white/70 hover:text-white hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-progress transition-colors font-mono text-[10px] uppercase tracking-widest"
            aria-label="View PDF"
          >
            <Eye className="w-3 h-3" />
            {viewPending ? "…" : "View"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm ring-1 ring-white/10 text-white/70 hover:text-white hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-progress transition-colors font-mono text-[10px] uppercase tracking-widest"
            aria-label="Download PDF"
          >
            <Download className="w-3 h-3" />
            {pending ? "…" : "PDF"}
          </button>
        </div>
      </td>
    </tr>
  )
}
