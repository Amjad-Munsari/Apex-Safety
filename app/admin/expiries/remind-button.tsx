"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { sendManualExpiryReminder } from "@/app/admin/compliance/actions"

export function RemindButton({ docId, clientName }: { docId: string; clientName: string }) {
  const [pending, startTransition] = useTransition()

  function handleRemind() {
    startTransition(async () => {
      const res = await sendManualExpiryReminder(docId)
      if (res.ok) {
        toast.success(`Reminder sent to ${clientName}`)
      } else {
        toast.error(res.error || "Could not send the reminder.")
      }
    })
  }

  return (
    <Button
      variant="ghost"
      onClick={handleRemind}
      disabled={pending}
      className="h-8 text-[10px] font-mono uppercase tracking-widest text-[#666] hover:text-white disabled:opacity-50"
    >
      {pending ? "Sending…" : "Remind"}
    </Button>
  )
}
