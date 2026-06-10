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
    // Only true local development (NODE_ENV=development, i.e. `next dev`) may run
    // this unauthenticated for manual curl testing. Vercel sets NODE_ENV=production
    // for BOTH production and preview deploys, so both correctly 500 here when the
    // secret is missing. Any other env (CI runners, NODE_ENV unset/"test") must
    // supply CRON_SECRET — the handler mutates assignment state and emails every
    // tenant's contacts via the service-role client, so an open endpoint is a
    // cross-tenant spam/mutation vector.
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
    }
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

    // Fetch client contact — DETERMINISTIC recipient (was .limit(1) with no
    // ordering, which picked an arbitrary org member each tick). Prefer the
    // org owner, tie-break by oldest membership (created_at asc) so reminders
    // always land on the same, most-senior contact.
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("name, email, role, created_at")
      .eq("client_id", row.client_id)
      .order("created_at", { ascending: true })

    // role='owner' wins regardless of created_at; among same-priority rows the
    // created_at-asc order above (stable) decides the tie-break.
    const contact =
      clientUsers?.find((u) => u.role === "owner") ?? clientUsers?.[0]
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
    // CLAIM-FIRST (TOCTOU fix): the prior sequence read the row, generated, THEN
    // stamped recurrence_generated_at. The inline submit path (actions.ts) runs
    // the same logic, so a completion racing this tick could have both read NULL
    // and both generate a duplicate occurrence. We now atomically claim the row
    // by stamping under a still-NULL guard FIRST; only the writer whose UPDATE
    // matches a row owns the generate. If the claim matches nothing, someone else
    // (inline path or a concurrent tick) already owns it — skip.
    const { data: claimed } = await supabase
      .from("form_assignments")
      .update({ recurrence_generated_at: new Date().toISOString() })
      .eq("id", completed.id)
      .not("recurrence_rule", "is", null)
      .is("recurrence_generated_at", null)
      .select(
        "id, client_id, template_id, assigned_by, instructions, due_date, recurrence_rule"
      )
      .maybeSingle()

    if (!claimed) {
      // Lost the claim race — another writer is handling this row. Skip silently.
      continue
    }

    const res = await generateNextOccurrence(supabase, claimed)

    if (res.ok) {
      recurrencesGenerated++
    } else {
      // Clear the stamp so the row stays eligible for the next tick (safety net).
      await supabase
        .from("form_assignments")
        .update({ recurrence_generated_at: null })
        .eq("id", completed.id)

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
