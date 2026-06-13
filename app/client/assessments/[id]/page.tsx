import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Calendar, Clock, FileText, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getClientContext } from "@/lib/auth-helpers"
import { ReportActions } from "./report-actions"
import { statusForSubmission, type AssessmentStatus } from "../status"

export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  completed: "Completed",
  submitted: "Submitted",
  in_progress: "In Progress",
  scheduled: "Scheduled",
}

const STATUS_PILL: Record<AssessmentStatus, { border: string; text: string; dot: string }> = {
  completed: { border: "border-teal", text: "text-teal", dot: "bg-teal" },
  submitted: { border: "border-[#4f6d8f]", text: "text-[#4f6d8f]", dot: "bg-[#4f6d8f]" },
  in_progress: { border: "border-gold", text: "text-gold", dot: "bg-gold" },
  scheduled: { border: "border-border", text: "text-muted-foreground", dot: "bg-muted-foreground" },
}

// Supabase nests the template join as either an object or a single-element
// array depending on cardinality inference; normalise to a name string.
type TemplateJoin =
  | { form_templates?: { name?: string } | { name?: string }[] | null }
  | { form_templates?: { name?: string } | { name?: string }[] | null }[]
  | null

function templateName(join: TemplateJoin): string {
  const tv = Array.isArray(join) ? join[0] : join
  const tpl = Array.isArray(tv?.form_templates) ? tv?.form_templates[0] : tv?.form_templates
  return tpl?.name ?? "Assessment"
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientAssessmentDetailPage({ params }: Props) {
  const { id } = await params

  if (!UUID_RE.test(id)) {
    notFound()
  }

  const supabase = await createClient()
  const ctx = await getClientContext()

  // RLS-scoped fetch of the single submission. Defense-in-depth: verify the
  // row belongs to the authenticated client's org in addition to RLS.
  const { data: submission } = await supabase
    .from("form_submissions")
    .select(`
      id,
      client_id,
      status,
      assignment_id,
      created_at,
      submitted_at,
      deleted_at,
      template:template_versions(form_templates(name))
    `)
    .eq("id", id)
    .maybeSingle()

  if (!submission || submission.deleted_at !== null) {
    notFound()
  }

  if (ctx && submission.client_id !== ctx.client_id) {
    notFound()
  }

  const name = templateName(submission.template as TemplateJoin)
  const status = statusForSubmission(submission.status, submission.assignment_id)
  const when = submission.submitted_at ?? submission.created_at
  const date = new Date(when).toLocaleDateString("en-GB", DATE_FMT)
  const pill = STATUS_PILL[status]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Back link */}
      <Link
        href="/client/assessments"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
          Back to Assessments
        </span>
      </Link>

      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="space-y-2">
            <h2 className="font-serif text-[32px] text-foreground font-medium tracking-tight leading-[1.05]">
              {name}.
            </h2>
            <div className="flex items-center gap-4 font-mono text-[9px] tracking-[0.25em] uppercase font-bold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {date}
              </span>
              <span className="text-border">·</span>
              <span
                className={cn(
                  "px-2.5 py-1 border rounded-full leading-none flex items-center gap-1.5 text-[8px] tracking-[0.16em]",
                  pill.border,
                  pill.text
                )}
              >
                <span className={cn("w-0.5 h-0.5 rounded-full", pill.dot)} />
                {STATUS_LABEL[status].toUpperCase().split("").join(" ")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Body — status-specific */}
      <section className="bg-card border border-border rounded-sm p-8 shadow-sm">
        {status === "completed" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-5">
              <div className="w-10 h-10 rounded-sm bg-success/10 text-success flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-serif text-[18px] text-foreground font-medium leading-tight">
                  Report delivered
                </h4>
                <p className="text-muted-foreground text-[13px] font-sans tracking-tight max-w-xl">
                  Matt's signed-off report is ready. Download the PDF for your records, or open it in
                  a new tab.
                </p>
              </div>
            </div>
            <ReportActions documentId={submission.id} />
          </div>
        )}

        {status === "submitted" && (
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-sm bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-xl">
              <h4 className="font-serif text-[18px] text-foreground font-medium leading-tight">
                Assessment submitted.
              </h4>
              <p className="text-muted-foreground text-[13px] font-sans tracking-tight">
                Your responses have been recorded and saved to your records. Your consultant has
                been notified and can view this submission.
              </p>
            </div>
          </div>
        )}

        {status === "in_progress" && (
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-sm bg-gold/10 text-gold flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-xl">
              <h4 className="font-serif text-[18px] text-foreground font-medium leading-tight">
                Matt is currently working on this assessment.
              </h4>
              <p className="text-muted-foreground text-[13px] font-sans tracking-tight">
                You'll be notified by email as soon as the report is ready. No action is required
                from you — site visits, evidence capture and write-up all happen on Matt's side.
              </p>
            </div>
          </div>
        )}

        {status === "scheduled" && (
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-sm bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-xl">
              <h4 className="font-serif text-[18px] text-foreground font-medium leading-tight">
                Scheduled for {date}.
              </h4>
              <p className="text-muted-foreground text-[13px] font-sans tracking-tight">
                Matt will visit on the scheduled date to carry out this assessment on-site. If you
                need to reschedule, message him directly.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
