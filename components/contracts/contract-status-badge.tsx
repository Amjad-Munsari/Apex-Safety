import { cn } from "@/lib/utils"
import type { ContractStatus } from "@/lib/mock-contracts"

const statusConfig: Record<ContractStatus, { color: string; dot: string }> = {
  Draft:               { color: "border-white/15 text-white/60",       dot: "bg-white/40" },
  "Sent for Signing":  { color: "border-amber-500/40 text-amber-500",  dot: "bg-amber-500" },
  "Client Signed":     { color: "border-[#3b8273]/40 text-[#3b8273]",  dot: "bg-[#3b8273]" },
  "Counter-Signed":    { color: "border-[#3b8273]/40 text-[#3b8273]",  dot: "bg-[#3b8273]" },
  Completed:           { color: "border-[#3b8273]/40 text-[#3b8273]",  dot: "bg-[#3b8273]" },
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const cfg = statusConfig[status]
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 border rounded-sm text-[10px] font-mono uppercase tracking-[0.2em] leading-none",
        cfg.color,
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {status}
    </div>
  )
}
