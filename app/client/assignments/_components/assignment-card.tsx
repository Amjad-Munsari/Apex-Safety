interface Assignment {
  id: string;
  // Supabase join returns array or object depending on cardinality inference.
  // We normalise to a name string in getTemplateName() below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: any;
  due_date: string | null;
  status: string;
  instructions: string | null;
}

interface AssignmentCardProps {
  assignment: Assignment;
  variant: "active" | "completed";
}

/**
 * Extract template name from the supabase join result, which may be typed as
 * an array (many-side) or object (one-side) depending on the PostgREST inference.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTemplateName(template: any): string {
  if (!template) return "Untitled form";
  if (Array.isArray(template)) {
    return template[0]?.name ?? "Untitled form";
  }
  return template.name ?? "Untitled form";
}

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

function StatusPill({ status }: { status: string }) {
  const label =
    status === "in_progress"
      ? "In progress"
      : status === "completed"
        ? "Completed"
        : "Pending";

  const colorClass =
    status === "in_progress"
      ? "text-[#c0a66d] bg-[#c0a66d]/10"
      : status === "completed"
        ? "text-[#3b8273] bg-[#3b8273]/10"
        : "text-[#666] bg-[#555]/10";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] ${colorClass}`}
    >
      {label}
    </span>
  );
}

export function AssignmentCard({ assignment, variant }: AssignmentCardProps) {
  const dueDateText = formatDate(assignment.due_date);
  const overdue = isOverdue(assignment.due_date);

  return (
    <article className="bg-white border border-[#e5e1d8] rounded-sm p-5 flex flex-col gap-4 hover:border-[#1a1a1a]/30 transition-colors cursor-pointer">
      {/* Row 1: Template name */}
      <h4 className="font-serif text-[18px] text-[#1a1a1a] leading-tight">
        {getTemplateName(assignment.template)}
      </h4>

      {/* Row 2: Mono metadata + status pill */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`font-mono text-[9px] uppercase tracking-[0.2em] ${
            overdue ? "text-[#e55a3a]" : "text-[#8a857f]"
          }`}
        >
          DUE · {dueDateText}
        </span>
        <StatusPill status={assignment.status} />
      </div>

      {/* Row 3: Instructions clamp (active tab only) */}
      {variant === "active" && assignment.instructions && (
        <p className="text-sm font-sans text-[#6b6560] italic line-clamp-2 before:content-['—_'] before:text-[#c0a66d]">
          {assignment.instructions}
        </p>
      )}

      {/* Completed tab: View submission link */}
      {variant === "completed" && (
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#3b8273]">
          View submission →
        </span>
      )}
    </article>
  );
}
