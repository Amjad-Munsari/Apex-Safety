import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { getAppSettings } from "@/lib/settings/app-settings"

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

  // Calculate the target dates for our alerts (30, 14, 7 days from now).
  // UTC math: setUTCDate + toISOString agree on the same calendar day. The old
  // setDate/getDate (LOCAL) followed by toISOString (UTC) could shift the target
  // by a day near midnight on a non-UTC host, diverging from the assignment
  // scheduler's UTC iso() helper and matching the wrong documents.
  const today = new Date()
  const addDays = (d: Date, days: number) => {
    const nd = new Date(d)
    nd.setUTCDate(nd.getUTCDate() + days)
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
    // Exclude soft-deleted documents — `active` and `deleted_at` are independent
    // columns, so an archived doc (deleted_at set, active still true) would
    // otherwise still trigger an expiry alert for a document the client can no
    // longer see in the portal.
    .is("deleted_at", null)

  if (docsError || !documents) {
    console.error("Cron fetch documents error:", docsError)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  if (documents.length === 0) {
    return NextResponse.json({ success: true, message: "No documents expiring on target dates." })
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

    const org = doc.clients as { name?: string } | { name?: string }[] | null
    const orgName = (Array.isArray(org) ? org[0]?.name : org?.name) ?? contactName
    adminDigestItems.push({
      client_name: orgName,
      document_name: doc.filename,
      expiry_date: doc.expiry_date as string,
      days_until_expiry: alertWindow,
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
        console.error(`[cron/expiry] admin digest failed for ${admin.email}: ${digestResult.error}`)
        await supabase.from("workflow_errors").insert({
          workflow_name: "expiry_admin_digest",
          error_message: digestResult.error ?? "unknown dispatch failure",
          payload: digest,
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
