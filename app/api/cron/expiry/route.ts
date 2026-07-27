import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { getAppSettings } from "@/lib/settings/app-settings"
import { daysUntilExpiry, selectExpiryAlertWindow } from "@/lib/notifications/expiry-window"
import {
  addDaysToIsoDate,
  todayIsoInTimeZone,
} from "@/lib/compliance/expiry-status"
import { logAppError, logWorkflowFailure } from "@/lib/observability/log"

export async function GET(request: Request) {
  // Simple cron secret protection (Header or Query Param for manual testing)
  const authHeader = request.headers.get("authorization")
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get("secret")
  
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    // Only true local development (NODE_ENV=development, i.e. `next dev`) may run
    // this unauthenticated for manual curl testing. Vercel sets NODE_ENV=production
    // for BOTH production and preview deploys, so both correctly 500 here when the
    // secret is missing. Any other env (CI runners, NODE_ENV unset/"test") must
    // supply CRON_SECRET — the handler reads every tenant's documents and fires
    // expiry notifications via the service-role client.
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

  // Retain uncredited checkouts for recovery; only credited checkout history
  // leaves after the conservative 90-day buffer. This runs before every early
  // exit so disabling reminders does not disable payment data housekeeping.
  const { error: paypalCleanupError } = await supabase.rpc("cleanup_paypal_runtime_records")
  if (
    paypalCleanupError &&
    paypalCleanupError.code !== "PGRST202" &&
    paypalCleanupError.code !== "42883"
  ) {
    await logAppError({
      area: "cron.paypal_cleanup",
      source: "cron",
      severity: "warning",
      error: paypalCleanupError,
    })
  }

  // Error-log retention. Piggy-backs on the existing daily tick rather than
  // adding a second schedule; missing a day is harmless because the function
  // deletes by age, not by what happened since the last run.
  const { error: errorLogCleanupError } = await supabase.rpc("cleanup_app_error_log", {})
  if (
    errorLogCleanupError &&
    errorLogCleanupError.code !== "PGRST202" &&
    errorLogCleanupError.code !== "42883"
  ) {
    await logAppError({
      area: "cron.error_log_cleanup",
      source: "cron",
      severity: "warning",
      error: errorLogCleanupError,
    })
  }

  // Email-outbox retention, on the same tick and for the same reasons. Delivered
  // mail is a receipt and goes early; the payloads (which can carry signing and
  // invite URLs) are blanked well before the rows themselves are dropped.
  const { error: outboxCleanupError } = await supabase.rpc("cleanup_email_outbox", {})
  if (
    outboxCleanupError &&
    outboxCleanupError.code !== "PGRST202" &&
    outboxCleanupError.code !== "42883"
  ) {
    await logAppError({
      area: "cron.email_outbox_cleanup",
      source: "cron",
      severity: "warning",
      error: outboxCleanupError,
    })
  }

  // Respect the admin "Send expiry reminders" toggle — when off, the cron is a
  // no-op (documents are untouched; nothing is emailed).
  const settings = await getAppSettings()
  if (!settings.expiryRemindersEnabled) {
    return NextResponse.json({ success: true, message: "Expiry reminders are disabled in settings." })
  }

  // The expiry date is a UK business calendar date. Build all bounds from that
  // date so a Vercel host in UTC cannot disagree with the portal around midnight.
  const todayIso = todayIsoInTimeZone()
  const day30 = addDaysToIsoDate(todayIso, 30)
  // Expired documents are alerted too, but only within a 30-day tail so a
  // historic import can't trigger a burst of notices for long-dead documents.
  const expiredFloor = addDaysToIsoDate(todayIso, -30)

  // 1. Fetch documents anywhere inside the alert range.
  //
  // This is a RANGE, not the three exact dates it used to be. Exact-date
  // matching (`.in("expiry_date", [day30, day14, day7])`) meant every alert was
  // a single-shot on one calendar day, so:
  //   - a document uploaded fewer than 7 days before expiry matched no window at
  //     all and was never alerted;
  //   - one missed run (crons are best-effort, a failed deploy, a function
  //     error) lost that window forever, since notifications_sent was only ever
  //     read to suppress duplicates, never to catch up;
  //   - turning the reminders toggle off dropped every window crossed while off;
  //   - nothing ever fired once a document was actually past its expiry date.
  // Matching a range and letting notifications_sent decide makes the job
  // self-healing: a late run still sends the window it missed, exactly once.
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select(`
      id,
      filename,
      document_category,
      expiry_date,
      client_id,
      clients ( name, contact_name, contact_email )
    `)
    .lte("expiry_date", day30)
    .gte("expiry_date", expiredFloor)
    .eq("active", true)
    // Exclude soft-deleted documents — `active` and `deleted_at` are independent
    // columns, so an archived doc (deleted_at set, active still true) would
    // otherwise still trigger an expiry alert for a document the client can no
    // longer see in the portal.
    .is("deleted_at", null)

  if (docsError || !documents) {
    // The whole tick aborts here: no alerts go out for anyone this run.
    await logAppError({
      area: "cron.expiry.fetch_documents",
      source: "cron",
      error: docsError,
      context: { note: "expiry tick aborted; no alerts dispatched this run" },
    })
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  if (documents.length === 0) {
    return NextResponse.json({ success: true, message: "No documents inside the alert range." })
  }

  const notificationsSent = []
  const adminDigestItems: Array<{
    client_name: string
    document_name: string
    expiry_date: string
    days_until_expiry: number
  }> = []

  // 2. Process each document
  for (const doc of documents) {
    // See lib/notifications/expiry-window.ts for why only the smallest crossed
    // window is chosen (no back-fill spam) and why alert_window stays the dedup
    // key — UNIQUE (document_id, alert_window, notification_type).
    const daysLeft = daysUntilExpiry(doc.expiry_date as string, todayIso)
    const alertWindow = selectExpiryAlertWindow(daysLeft)

    // Check if we already sent this specific alert
    const { data: existingAlert } = await supabase
      .from("notifications_sent")
      .select("id")
      .eq("document_id", doc.id)
      .eq("alert_window", alertWindow)
      .eq("notification_type", "expiry_warning")
      // maybeSingle, not single: "no alert yet" is the normal case and single()
      // raises PGRST116 for it, which only produced noise in the logs.
      .maybeSingle()

    if (existingAlert) {
      console.log(`Alert already sent for doc ${doc.id} at window ${alertWindow}. Skipping.`)
      continue
    }

    // Use the organisation's designated contact, not an arbitrary first portal
    // user whose ordering can change as people are invited or removed.
    const relatedClient = doc.clients as
      | { name?: string; contact_name?: string; contact_email?: string }
      | Array<{ name?: string; contact_name?: string; contact_email?: string }>
      | null
    const client = Array.isArray(relatedClient)
      ? relatedClient[0]
      : relatedClient
    const contactEmail = client?.contact_email
    const contactName = client?.contact_name || client?.name || "there"

    if (!contactEmail) {
      console.warn(`[cron/expiry] no contact email for client ${doc.client_id}, skipping doc ${doc.id}`)
      continue
    }

    const payload = {
      type: "expiry_alert" as const,
      client_email: contactEmail,
      client_name: contactName,
      document_name: doc.filename,
      expiry_date: doc.expiry_date as string,
      // The REAL day count, not the window bucket — a document first seen 5 days
      // out must not be emailed "expires in 7 days". <= 0 renders as "has
      // expired" (see buildEmail, expiry_alert case).
      days_until_expiry: daysLeft,
    }

    const result = await dispatchNotification(payload, {
      // Resend deduplicates retries/concurrent cron runs at the provider. This
      // closes the old gap where email succeeded but notifications_sent failed,
      // causing the next run to send the same threshold again.
      idempotencyKey: `expiry-${doc.id}-${alertWindow}`,
    })

    if (!result.ok) {
      await logWorkflowFailure({
        workflowName: "expiry_alert",
        error: result.error ?? "unknown dispatch failure",
        area: "notifications.expiry_alert",
        source: "cron",
        payload: { ...payload, documentId: doc.id, outboxId: result.outboxId ?? null },
      })
      // Skip notifications_sent insert so the next cron tick retries this doc.
      continue
    }

    const { error: sentLogError } = await supabase
      .from("notifications_sent")
      .insert({
        client_id: doc.client_id,
        notification_type: "expiry_warning",
        document_id: doc.id,
        alert_window: alertWindow
      })
    if (sentLogError) {
      await logAppError({
        area: "cron.expiry.audit_insert",
        source: "cron",
        error: sentLogError,
        context: { documentId: doc.id, note: "alert emailed but dedup row missing — may resend" },
      })
      await supabase.from("workflow_errors").insert({
        workflow_name: "expiry_notification_audit",
        error_message: sentLogError.message,
        payload: { ...payload, document_id: doc.id, alert_window: alertWindow },
      })
    }

    notificationsSent.push({ docId: doc.id, window: alertWindow })

    adminDigestItems.push({
      client_name: client?.name ?? contactName,
      document_name: doc.filename,
      expiry_date: doc.expiry_date as string,
      days_until_expiry: daysLeft,
    })
  }

  // 3. Copy the admin team on what went out — one digest per run, best-effort.
  if (adminDigestItems.length > 0) {
    const { data: admins } = await supabase.from("admin_users").select("email")
    for (const admin of admins ?? []) {
      if (!admin.email) continue
      const digest = {
        type: "expiry_admin_digest" as const,
        admin_email: admin.email,
        items: adminDigestItems,
      }
      const digestResult = await dispatchNotification(digest)
      if (!digestResult.ok) {
        await logWorkflowFailure({
          workflowName: "expiry_admin_digest",
          error: digestResult.error ?? "unknown dispatch failure",
          area: "notifications.expiry_admin_digest",
          source: "cron",
          payload: { ...digest, outboxId: digestResult.outboxId ?? null },
        })
      }
    }
  }

  return NextResponse.json({
    success: true, 
    processed: documents.length,
    notificationsSent: notificationsSent.length
  })
}
