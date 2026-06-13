import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const TONE: Record<StatusTone, { ring: string; text: string; dot: string }> = {
  success: { ring: "border-teal/40", text: "text-teal", dot: "bg-teal" },
  warning: { ring: "border-gold/40", text: "text-gold", dot: "bg-gold" },
  danger: { ring: "border-danger/40", text: "text-danger", dot: "bg-danger" },
  info: { ring: "border-[#4f6d8f]/40", text: "text-[#4f6d8f]", dot: "bg-[#4f6d8f]" },
  neutral: { ring: "border-muted-foreground/40", text: "text-muted-foreground", dot: "bg-muted-foreground" },
}

/**
 * The single status pill for the client portal. One shape (rounded-full), one
 * size/tracking, one dot, one palette — so a CURRENT / EXPIRED / SIGNED / etc.
 * badge looks identical wherever it appears.
 */
export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: StatusTone
  label: string
  className?: string
}) {
  const t = TONE[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border font-mono text-[9px] uppercase tracking-[0.2em] font-bold leading-none whitespace-nowrap",
        t.ring,
        t.text,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", t.dot)} />
      {label}
    </span>
  )
}
