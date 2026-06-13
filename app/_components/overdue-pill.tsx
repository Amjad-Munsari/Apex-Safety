// Shared OverduePill component — Phase 17 Plan 03
//
// Purely presentational. No hooks, no state, no effects — intentionally
// server-compatible (no client directive). Hover-tip wrapping is the
// caller's responsibility (admin only, per UI-SPEC BLOCKING #4).
//
// The daysOverdue value is passed in by the caller (which is responsible for
// calling daysOverdue(assignment.due_date) from @/lib/assignments/is-overdue).
// This keeps the component free of date-math and trivially unit-testable.

export function OverduePill({
  daysOverdue,
  status,
}: {
  daysOverdue: number;
  status?: string;
}) {
  // State Matrix: completed never shows overdue; daysOverdue <= 0 means not yet overdue.
  if (daysOverdue <= 0 || status === "completed") return null;

  const ariaLabel =
    daysOverdue === 0
      ? "Overdue — was due today"
      : `Overdue — was due ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago`;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] text-danger bg-danger/10"
      aria-label={ariaLabel}
    >
      OVERDUE
    </span>
  );
}
