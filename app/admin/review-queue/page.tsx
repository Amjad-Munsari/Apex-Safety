import { getReportsAwaitingReview, getCompletedReports } from "@/lib/supabase/dashboard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ClipboardCheck, Clock, FileEdit, CheckCircle2 } from "lucide-react"

export const dynamic = "force-dynamic"

type TabKey = "awaiting" | "completed"

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const active: TabKey = sp.tab === "completed" ? "completed" : "awaiting"

  // Fetch both so the tab counts are accurate regardless of which is active.
  const [awaiting, completed] = await Promise.all([
    getReportsAwaitingReview(50),
    getCompletedReports(50),
  ])

  const items = active === "completed" ? completed : awaiting

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "awaiting", label: "Awaiting Review", count: awaiting.length },
    { key: "completed", label: "Completed", count: completed.length },
  ]

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-teal font-semibold">03</span>
            QUALITY ASSURANCE
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">
            Reports Review Queue
          </h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            Review report drafts before they are delivered to clients.
          </p>
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div className="flex items-center gap-6 border-b border-border">
        {TABS.map((tab) => {
          const isActive = active === tab.key
          const href = tab.key === "awaiting" ? "/admin/review-queue" : `/admin/review-queue?tab=${tab.key}`
          return (
            <Link
              key={tab.key}
              href={href}
              className={`group relative flex items-center gap-2 pb-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] ${isActive ? "text-foreground/70" : "text-muted-foreground"}`}>{tab.count}</span>
              {isActive && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-gold" />}
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => {
          const isCompleted = active === "completed"
          return (
            <Card key={item.id} className="bg-card border-border rounded-sm p-6 group hover:border-border/60 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-muted rounded-sm flex items-center justify-center text-muted-foreground group-hover:text-foreground/40 transition-colors">
                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <ClipboardCheck className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-medium text-foreground">{(item.client as { name?: string } | null)?.name}</h3>
                      {isCompleted ? (
                        <Badge variant="outline" className="border-border text-muted-foreground font-mono text-[9px] uppercase tracking-widest">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-teal/40 text-teal font-mono text-[9px] uppercase tracking-widest">
                          Ready for Review
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-sans mb-4">
                      {(item.template as { form_template?: { name?: string } | null } | null)?.form_template?.name}
                    </p>
                    <div className="flex gap-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        {isCompleted ? "Delivered" : "Submitted"} {new Date(item.created_at).toLocaleDateString('en-GB')}
                      </div>
                      <div className="flex items-center gap-2">
                        <FileEdit className="w-3.5 h-3.5" />
                        {isCompleted ? "Report Finalised" : "AI Draft Generated"}
                      </div>
                    </div>
                  </div>
                </div>
                <Link href={`/admin/assessments/${item.id}/review`}>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none flex gap-2">
                    {isCompleted ? "View Report →" : "Begin Review →"}
                  </Button>
                </Link>
              </div>
            </Card>
          )
        })}
        {items.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-sm bg-muted/10">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
              {active === "completed" ? "No completed reports yet" : "Your review queue is empty"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
