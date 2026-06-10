import type { SupabaseClient } from "@supabase/supabase-js";

export type Frequency = "weekly" | "monthly" | "quarterly" | "annually";

export interface RecurrenceRule {
  frequency: Frequency;
}

export interface SourceAssignment {
  id: string;
  client_id: string;
  template_id: string;
  assigned_by: string | null;
  instructions: string | null;
  due_date: string | null;
  recurrence_rule: unknown;
}

export type GenerateResult =
  | { ok: true; newAssignmentId: string }
  | { ok: false; reason: string };

const VALID_FREQUENCIES: Frequency[] = ["weekly", "monthly", "quarterly", "annually"];

// Add whole months in UTC with end-of-month clamping. A naive
// `d.setMonth(d.getMonth() + 1)` on a 31st rolls OVER a short month — Jan 31
// + 1 month yields Mar 3 (Feb has no 31st), silently SKIPPING February's
// occurrence. Clamping to the target month's last valid day keeps the cadence
// on the intended month (Jan 31 → Feb 28/29). Also used for annually (+12) so a
// Feb-29 due date lands on Feb 28 in common years instead of rolling to Mar 1.
function addMonthsClamped(d: Date, months: number): void {
  const day = d.getUTCDate();
  d.setUTCDate(1); // avoid mid-change overflow while we shift the month
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTargetMonth));
}

// All date math is UTC so the computed due_date does not drift by a day on a
// non-UTC host (matches the cron scheduler's UTC iso() helper).
function addFrequency(date: Date, freq: Frequency): Date {
  const d = new Date(date);
  switch (freq) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "monthly":
      addMonthsClamped(d, 1);
      break;
    case "quarterly":
      addMonthsClamped(d, 3);
      break;
    case "annually":
      addMonthsClamped(d, 12);
      break;
  }
  return d;
}

export async function generateNextOccurrence(
  supabase: SupabaseClient,
  src: SourceAssignment
): Promise<GenerateResult> {
  // 1. Validate recurrence_rule
  const rule = src.recurrence_rule as RecurrenceRule | null;
  if (!rule?.frequency || !VALID_FREQUENCIES.includes(rule.frequency)) {
    return { ok: false, reason: "no_recurrence_rule" };
  }

  // 2. Validate due_date
  if (!src.due_date) {
    return { ok: false, reason: "no_due_date" };
  }

  // 3. Re-pin to LATEST PUBLISHED version (matches app/client/templates/[id]/fill/page.tsx:52-59)
  const { data: latest } = await supabase
    .from("template_versions")
    .select("id")
    .eq("template_id", src.template_id)
    .not("published_at", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    return { ok: false, reason: "no_published_version" };
  }

  // 4. Compute new due_date from PRIOR due_date + frequency (NOT today)
  const newDue = addFrequency(new Date(src.due_date), rule.frequency)
    .toISOString()
    .slice(0, 10);

  // 5. Insert new occurrence
  const { data: created, error } = await supabase
    .from("form_assignments")
    .insert({
      client_id: src.client_id,          // server-side carryover (T-16-04)
      template_id: src.template_id,
      template_version_id: latest.id,
      assigned_by: src.assigned_by,
      due_date: newDue,
      instructions: src.instructions,
      status: "pending",
      recurrence_rule: rule,             // chain continues
      last_reminder_sent: null,
    })
    .select("id")
    .single();

  // 6. Handle insert failure
  if (error || !created) {
    return { ok: false, reason: error?.message ?? "insert_failed" };
  }

  // 7. Success
  return { ok: true, newAssignmentId: created.id };
}
