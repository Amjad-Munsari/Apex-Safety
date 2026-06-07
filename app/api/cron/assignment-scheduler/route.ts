import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { generateNextOccurrence } from "@/lib/scheduler/generate-next-occurrence"
import { sendAssignmentReminder } from "@/lib/scheduler/send-reminder"

export async function GET(request: Request) {
  // Simple cron secret protection (Header or Query Param for manual testing)
  // Authorization: Bearer ${CRON_SECRET} header (or ?secret= query param for manual curl)
  const authHeader = request.headers.get("Authorization")
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get("secret")

  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
    }
    // dev/preview without a secret: allow unauthenticated curl for manual testing
  } else if (
    authHeader !== `Bearer ${cronSecret}` &&
    // Query-param secret is accepted for manual testing in non-prod only — in
    // production it would leak the secret into access logs / Referer.
    !(process.env.NODE_ENV !== "production" && querySecret === cronSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Date math constants — UTC, zero-padded ISO strings for direct string comparison
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const day7 = new Date(today)
  day7.setUTCDate(day7.getUTCDate() + 7)

  const day1 = new Date(today)
  day1.setUTCDate(day1.getUTCDate() + 1)

  let remindersSent = 0
  let recurrencesGenerated = 0

  // ── PASS A: Send reminder notifications ─────────────────────────────────────
  // Three required filters (Pitfall 5): deleted_at, status, due_date
  const { data: active, error: activeError } = await supabase
    .from("form_assignments")
    .select("id, client_id, due_date, status, instructions, last_reminder_sent, template:form_templates(name)")
    .is("deleted_at", null)
    .neq("status", "completed")
    .not("due_date", "is", null)

  if (activeError) {
    console.error("[cron/assignment-scheduler] PASS A fetch error:", activeError)
  }

  for (const row of active ?? []) {
    // Cadence decision ladder — monotonic state machine
    let cadence: "7d" | "1d" | "overdue" | null = null

    if (row.due_date === iso(day7) && row.last_reminder_sent === null) {
      cadence = "7d"
    } else if (
      row.due_date === iso(day1) &&
      row.last_reminder_sent !== "1d" &&
      row.last_reminder_sent !== "overdue"
    ) {
      cadence = "1d"
    } else if (row.due_date < iso(today) && row.last_reminder_sent !== "overdue") {
      cadence = "overdue"
    }

    if (!cadence) continue

    // Fetch client contact (mirror Phase 5 lines 87-100)
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("name, email")
      .eq("client_id", row.client_id)
      .limit(1)

    const contact = clientUsers?.[0]
    const contactEmail = contact?.email

    if (!contactEmail) {
      console.warn(
        `[cron/assignment-scheduler] no contact email for client ${row.client_id}, skipping assignment ${row.id}`
      )
      continue
    }

    // Resolve template name — PostgREST may return array or object
    const templateName: string = Array.isArray(row.template)
      ? (row.template[0]?.name ?? "Untitled form")
      : ((row.template as { name?: string } | null)?.name ?? "Untitled form")

    const result = await sendAssignmentReminder({
      cadence,
      client_email: contactEmail,
      client_name: contact.name ?? "there",
      template_name: templateName,
      due_date: row.due_date as string,
      assignmentId: row.id,
      instructions: row.instructions ?? null,
    })

    if (!result.ok) {
      // Failure path: insert workflow_errors and skip dedup write so next tick retries
      console.error(
        `[cron/assignment-scheduler] dispatch failed for assignment ${row.id}: ${result.error}`
      )
      await supabase.from("workflow_errors").insert({
        workflow_name: "assignment_reminder",
        error_message: result.error ?? "unknown dispatch failure",
        payload: { assignment_id: row.id, cadence },
      })
      continue
    }

    // Success path: update dedup column ONLY after ok:true (Pattern 4 idempotency)
    await supabase
      .from("form_assignments")
      .update({ last_reminder_sent: cadence })
      .eq("id", row.id)

    remindersSent++
  }

  // ── PASS B: Generate next recurrence for completed recurring assignments ─────
  // Four-filter chain: completed + not-deleted + has-recurrence-rule + not-yet-generated
  const { data: completedRecurring, error: recurringError } = await supabase
    .from("form_assignments")
    .select(
      "id, client_id, template_id, assigned_by, instructions, due_date, recurrence_rule, recurrence_generated_at"
    )
    .eq("status", "completed")
    .is("deleted_at", null)
    .not("recurrence_rule", "is", null)
    .is("recurrence_generated_at", null)

  if (recurringError) {
    console.error("[cron/assignment-scheduler] PASS B fetch error:", recurringError)
  }

  for (const completed of completedRecurring ?? []) {
    const res = await generateNextOccurrence(supabase, completed)

    if (res.ok) {
      // Set idempotency guard so next tick skips this row
      await supabase
        .from("form_assignments")
        .update({ recurrence_generated_at: new Date().toISOString() })
        .eq("id", completed.id)

      recurrencesGenerated++
    } else {
      // Log only — row remains eligible for next tick (safety net pattern)
      console.error(
        `[cron/assignment-scheduler] recurrence generation failed for ${completed.id}: ${res.reason}`
      )
    }
  }

  return NextResponse.json({
    success: true,
    remindersSent,
    recurrencesGenerated,
    remindersProcessed: active?.length ?? 0,
    recurrencesProcessed: completedRecurring?.length ?? 0,
  })
}
