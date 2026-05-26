const DAY_MS = 86_400_000;

/**
 * "today at local midnight" anchor used by the client AssignmentCard
 * (extracted from app/client/assignments/_components/assignment-card.tsx:41)
 * and the admin Assigned Forms tab (Plan 17-03), plus the cron handler
 * (Plan 17-04 — server runs on UTC, accepting the BST 1h drift per
 * RESEARCH §Q6).
 */
function todayMidnight(): Date {
  return new Date(new Date().toDateString());
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < todayMidnight();
}

export function daysOverdue(dateStr: string | null): number {
  if (!dateStr) return 0;
  const due = new Date(dateStr).getTime();
  const today = todayMidnight().getTime();
  if (due >= today) return 0;
  return Math.max(0, Math.floor((today - due) / DAY_MS));
}
