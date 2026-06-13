import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { AssessmentsList } from "./assessments-list";
import { statusForSubmission, type AssessmentRow } from "./status";

export const dynamic = "force-dynamic";

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

// Supabase nests the template join as either an object or a single-element
// array depending on cardinality inference; normalise to a name string.
type TemplateJoin =
  | { form_templates?: { name?: string } | { name?: string }[] | null }
  | { form_templates?: { name?: string } | { name?: string }[] | null }[]
  | null;

function templateName(join: TemplateJoin): string {
  const tv = Array.isArray(join) ? join[0] : join;
  const tpl = Array.isArray(tv?.form_templates) ? tv?.form_templates[0] : tv?.form_templates;
  return tpl?.name ?? "Assessment";
}

export default async function AssessmentListPage() {
  const ctx = await getClientContext();

  if (!ctx) {
    return (
      <AssessmentsListShell>
        <AssessmentsEmpty
          headline="Sign in to view your assessments."
          body="Once your account is linked to a client, your fire-safety assessments will appear here."
        />
      </AssessmentsListShell>
    );
  }

  const supabase = await createClient();

  // RLS-scoped client. Defense-in-depth: also filter by client_id explicitly.
  const { data: submissions } = await supabase
    .from("form_submissions")
    .select(`
      id,
      status,
      assignment_id,
      created_at,
      submitted_at,
      template:template_versions(form_templates(name))
    `)
    .eq("client_id", ctx.client_id)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows: AssessmentRow[] = (submissions ?? []).map((row) => {
    const when = row.submitted_at ?? row.created_at;
    return {
      id: row.id,
      name: templateName(row.template as TemplateJoin),
      date: new Date(when).toLocaleDateString("en-GB", DATE_FMT),
      status: statusForSubmission(row.status, row.assignment_id),
    };
  });

  return (
    <AssessmentsListShell>
      {rows.length === 0 ? (
        <AssessmentsEmpty
          headline="No assessments yet."
          body="When Matt carries out a fire-safety inspection on-site, the report will appear here for you to review and download."
        />
      ) : (
        <AssessmentsList rows={rows} />
      )}
    </AssessmentsListShell>
  );
}

function AssessmentsListShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            05 Assessments
          </span>
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-[32px] text-foreground font-medium tracking-tight leading-[1.1]">
            Assessments
          </h2>
          <p className="text-muted-foreground text-[13px] font-sans tracking-tight max-w-xl">
            Matt carries out your fire-safety inspections on-site and uploads the signed-off report
            here. Download a completed report, or check progress on a visit in flight.
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}

function AssessmentsEmpty({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
      <p className="font-serif text-[20px] text-foreground mb-3">{headline}</p>
      <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
