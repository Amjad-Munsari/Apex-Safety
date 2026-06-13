import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { FillAsIsButton } from "./fill-as-is-button";
import { CustomiseFirstButton } from "./customise-first-button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "no due date";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssignmentLandingPage({ params }: Props) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const ctx = await getClientContext();

  // Step 1: Fetch the assignment row with joined template name.
  // Defense-in-depth: also filter by client_id in addition to RLS (T-16-01).
  const query = supabase
    .from("form_assignments")
    .select(
      "id, client_id, template_id, template_version_id, due_date, status, instructions, deleted_at, template:form_templates(name)"
    )
    .eq("id", id)
    .maybeSingle();

  const { data: assignment } = await query;

  if (!assignment || assignment.deleted_at !== null) {
    notFound();
  }

  // Additional defense-in-depth: verify the assignment belongs to this org.
  // Hard-fail when there is no client context — never fall through to an
  // unscoped render (audit M-1).
  if (!ctx || assignment.client_id !== ctx.client_id) {
    notFound();
  }

  // Already-completed: render a card (future plan will have a proper submission viewer)
  if (assignment.status === "completed") {
    return (
      <div className="max-w-xl mx-auto py-12 px-6">
        <Link
          href="/client/assignments"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Assessments
        </Link>
        <div className="mt-8 space-y-4">
          <h2 className="font-serif text-[28px] text-foreground font-medium leading-[1.1]">
            {(() => {
              type TemplateJoin = { name?: string } | { name?: string }[] | null;
              const t = assignment.template as TemplateJoin;
              return Array.isArray(t) ? (t[0]?.name ?? "Untitled form") : (t?.name ?? "Untitled form");
            })()}
          </h2>
          <div className="bg-muted rounded-sm p-4 border-l-2 border-teal">
            <p className="text-sm font-sans text-foreground">
              This form has already been submitted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Supabase join may return array or object depending on cardinality inference
  type TemplateJoin = { name?: string } | { name?: string }[] | null;
  const rawTemplate = assignment.template as TemplateJoin;
  const templateName: string = Array.isArray(rawTemplate)
    ? (rawTemplate[0]?.name ?? "Untitled form")
    : (rawTemplate?.name ?? "Untitled form");
  const overdue = isOverdue(assignment.due_date);
  const dueDateText = formatDate(assignment.due_date);

  return (
    <div className="max-w-xl mx-auto py-12 px-6 space-y-8">
      {/* Back link */}
      <Link
        href="/client/assignments"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Assessments
      </Link>

      {/* Top section */}
      <div className="space-y-4">
        {/* Template name */}
        <h2 className="font-serif text-[28px] text-foreground font-medium leading-[1.1]">
          {templateName}
        </h2>

        {/* Due date */}
        {assignment.due_date && (
          <p
            className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
              overdue ? "text-danger" : "text-muted-foreground"
            }`}
          >
            DUE · {dueDateText}
          </p>
        )}

        {/* Instructions block */}
        {assignment.instructions && (
          <div className="bg-muted rounded-sm p-4 border-l-2 border-gold space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-gold" />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                From your assessor
              </span>
            </div>
            <p className="text-sm font-sans text-foreground leading-relaxed">
              {assignment.instructions}
            </p>
          </div>
        )}
      </div>

      {/* CTA row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Fill as-is — primary black fill */}
        <FillAsIsButton assignmentId={id} />

        {/* Customise first — fork the pinned template into a customer-owned copy */}
        <CustomiseFirstButton assignmentId={id} />
      </div>
    </div>
  );
}
