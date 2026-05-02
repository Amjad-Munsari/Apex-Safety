"use client"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function RemindButton({ clientName }: { clientName: string }) {
  return (
    <Button
      variant="ghost"
      onClick={() => toast.success(`Reminder sent to ${clientName}`)}
      className="h-8 text-[10px] font-mono uppercase tracking-widest text-[#666] hover:text-white"
    >
      Remind
    </Button>
  )
}
