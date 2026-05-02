import { getReportsAwaitingReview } from "@/lib/supabase/dashboard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, ClipboardCheck, Clock, FileEdit } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ReviewQueuePage() {
  const reviews = await getReportsAwaitingReview(50)

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-[#3b8273] font-semibold">03</span>
            QUALITY ASSURANCE
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">
            Reports Review Queue
          </h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            Review AI-generated report drafts before they are delivered to clients.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reviews.map((item) => (
          <Card key={item.id} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 group hover:border-white/10 transition-all">
            <div className="flex justify-between items-start">
              <div className="flex gap-6">
                <div className="w-12 h-12 bg-white/5 rounded-sm flex items-center justify-center text-white/20 group-hover:text-white/40 transition-colors">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-medium text-white">{(item.client as any)?.name}</h3>
                    <Badge variant="outline" className="border-[#3b8273]/40 text-[#3b8273] font-mono text-[9px] uppercase tracking-widest">
                      Ready for Review
                    </Badge>
                  </div>
                  <p className="text-sm text-[#888] font-sans mb-4">
                    {(item.template as any)?.form_template?.name}
                  </p>
                  <div className="flex gap-6 text-[10px] font-mono uppercase tracking-widest text-[#555]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      Submitted {new Date(item.created_at).toLocaleDateString('en-GB')}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileEdit className="w-3.5 h-3.5" />
                      AI Draft Generated
                    </div>
                  </div>
                </div>
              </div>
              <Link href={`/admin/assessments/${item.id}/review`}>
                <Button className="bg-white hover:bg-white/90 text-black rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none flex gap-2">
                  Begin Review &rarr;
                </Button>
              </Link>
            </div>
          </Card>
        ))}
        {reviews.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-sm bg-white/[0.01]">
            <ClipboardCheck className="w-12 h-12 text-[#333] mb-4" />
            <p className="text-[#555] font-mono text-xs uppercase tracking-widest">Your review queue is empty</p>
          </div>
        )}
      </div>
    </div>
  )
}
