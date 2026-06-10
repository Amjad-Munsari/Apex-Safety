import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"
import { getAppSettings } from "@/lib/settings/app-settings"

export async function GET(request: Request) {
  // Simple cron secret protection (Header or Query Param for manual testing)
  const authHeader = request.headers.get("authorization")
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

  // Respect the admin "Send expiry reminders" toggle — when off, the cron is a
  // no-op (documents are untouched; nothing is emailed).
  const settings = await getAppSettings()
  if (!settings.expiryRemindersEnabled) {
    return NextResponse.json({ success: true, message: "Expiry reminders are disabled in settings." })
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Calculate the target dates for our alerts (30, 14, 7 days from now)
  const today = new Date()
  const addDays = (d: Date, days: number) => {
    const nd = new Date(d)
    nd.setDate(nd.getDate() + days)
    return nd.toISOString().split('T')[0]
  }

  const day30 = addDays(today, 30)
  const day14 = addDays(today, 14)
  const day7 = addDays(today, 7)

  // 1. Fetch documents that expire on exactly those dates
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select(`
      id, 
      filename, 
      document_category, 
      expiry_date, 
      client_id,
      clients ( name )
    `)
    .in("expiry_date", [day30, day14, day7])
    .eq("active", true)

  if (docsError || !documents) {
    console.error("Cron fetch documents error:", docsError)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  if (documents.length === 0) {
    return NextResponse.json({ success: true, message: "No documents expiring on target dates." })
  }

  const notificationsSent = []

  // 2. Process each document
  for (const doc of documents) {
    // Determine which window this falls into
    let alertWindow = 0
    if (doc.expiry_date === day30) alertWindow = 30
    if (doc.expiry_date === day14) alertWindow = 14
    if (doc.expiry_date === day7) alertWindow = 7

    // Check if we already sent this specific alert
    const { data: existingAlert } = await supabase
      .from("notifications_sent")
      .select("id")
      .eq("document_id", doc.id)
      .eq("alert_window", alertWindow)
      .eq("notification_type", "expiry_warning")
      .single()

    if (existingAlert) {
      console.log(`Alert already sent for doc ${doc.id} at window ${alertWindow}. Skipping.`)
      continue
    }

    // Fetch client contact
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("name, email")
      .eq("client_id", doc.client_id)
      .limit(1)

    const contact = clientUsers?.[0]
    const contactEmail = contact?.email
    const contactName = contact?.name || "there"

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
      days_until_expiry: alertWindow,
    }

    const result = await dispatchNotification(payload)

    if (!result.ok) {
      console.error(`[cron/expiry] dispatch failed for doc ${doc.id}: ${result.error}`)
      await supabase.from("workflow_errors").insert({
        workflow_name: "expiry_alert",
        error_message: result.error ?? "unknown dispatch failure",
        payload: payload,
      })
      // Skip notifications_sent insert so the next cron tick retries this doc.
      continue
    }

    await supabase
      .from("notifications_sent")
      .insert({
        client_id: doc.client_id,
        notification_type: "expiry_warning",
        document_id: doc.id,
        alert_window: alertWindow
      })

    notificationsSent.push({ docId: doc.id, window: alertWindow })
  }

  return NextResponse.json({ 
    success: true, 
    processed: documents.length,
    notificationsSent: notificationsSent.length
  })
}
