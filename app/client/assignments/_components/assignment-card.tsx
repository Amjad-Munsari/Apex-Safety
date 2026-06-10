import { isOverdue, daysOverdue } from "@/lib/assignments/is-overdue";
import { OverduePill } from "@/app/_components/overdue-pill";

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

function StatusPill({ status }: { status: string }) {
  const label =
    status === "in_progress"
      ? "In progress"
      : status === "completed"
        ? "Completed"
        : "Pending";

  const colorClass =
    status === "in_progress"
      ? "text-[#8a6d24] bg-[#c0a66d]/10"
      : status === "completed"
        ? "text-teal bg-teal/10"
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
  const overdueDays = daysOverdue(assignment.due_date);

  return (
    <article className="bg-white border border-[#e5e1d8] rounded-sm p-6 flex flex-col gap-4 hover:border-[#1a1a1a]/30 transition-colors cursor-pointer">
      {/* Row 1: Template name */}
      <h3 className="font-serif text-[18px] text-[#1a1a1a] leading-tight">
        {getTemplateName(assignment.template)}
      </h3>

      {/* Row 2: Mono metadata + status pill */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`font-mono text-[9px] uppercase tracking-[0.2em] ${
            overdue ? "text-[#e55a3a]" : "text-[#6b6560]"
          }`}
        >
          DUE · {dueDateText}
        </span>
        {/* When overdue, the OVERDUE pill + "was due" text carry the status —
            suppress the redundant "Pending" pill, but keep a meaningful "In progress". */}
        {(!(variant === "active" && overdue) || assignment.status === "in_progress") && (
          <StatusPill status={assignment.status} />
        )}
        {variant === "active" && (
          <OverduePill
            daysOverdue={overdueDays}
            status={assignment.status}
          />
        )}
      </div>

      {/* Overdue detail line (active tab only) */}
      {variant === "active" && overdue && assignment.status !== "completed" && (
        <p className="text-xs text-[#a14a2a]">
          Was due {overdueDays} day{overdueDays === 1 ? "" : "s"} ago
        </p>
      )}

      {/* Row 3: Instructions clamp (active tab only) */}
      {variant === "active" && assignment.instructions && (
        <p className="text-sm font-sans text-[#6b6560] italic line-clamp-2 max-w-2xl before:content-['—_'] before:text-[#8a6d24]">
          {assignment.instructions}
        </p>
      )}

      {/* Completed tab: View submission link */}
      {variant === "completed" && (
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-teal">
          View submission →
        </span>
      )}
    </article>
  );
}
