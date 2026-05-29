"use server"

import { adminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"

export async function getComplianceDocSignedUrl(
  docId: string,
  opts: { mode?: "view" | "download" } = {}
): Promise<{ url: string | null; filename: string | null }> {
  // Auth gate — without this, any caller who could invoke the Server Action
  // could mint a 5-min signed URL for any document by guessing docId.
  // Code audit 2026-05-29.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { url: null, filename: null }
  }

  const { data: doc, error: docErr } = await adminClient
    .from("documents")
    .select("storage_path, filename")
    .eq("id", docId)
    .maybeSingle()

  if (docErr || !doc?.storage_path) {
    return { url: null, filename: doc?.filename ?? null }
  }

  const mode = opts.mode ?? "download"
  const signOpts = mode === "download" ? { download: doc.filename ?? true } : undefined

  const { data: signed, error: signErr } = await adminClient
    .storage
    .from("client-documents")
    .createSignedUrl(doc.storage_path, 60 * 5, signOpts)

  if (signErr || !signed?.signedUrl) {
    return { url: null, filename: doc.filename }
  }

  return { url: signed.signedUrl, filename: doc.filename }
}

export async function sendManualExpiryReminder(
  docId: string
): Promise<{ ok: boolean; error?: string }> {
  // Auth gate — without this, an unauthenticated caller could trigger n8n
  // dispatches for arbitrary docs. Code audit 2026-05-29.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data: doc, error: docErr } = await adminClient
    .from("documents")
    .select("id, filename, expiry_date, client_id")
    .eq("id", docId)
    .maybeSingle()

  if (docErr || !doc) {
    return { ok: false, error: "Document not found" }
  }

  if (!doc.expiry_date) {
    return { ok: false, error: "Document has no expiry date" }
  }

  const { data: contacts } = await adminClient
    .from("client_users")
    .select("name, email")
    .eq("client_id", doc.client_id)
    .limit(1)

  const contact = contacts?.[0]
  if (!contact?.email) {
    return { ok: false, error: "Client has no contact email" }
  }

  const expiry = new Date(doc.expiry_date)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const payload = {
    type: "expiry_alert" as const,
    client_email: contact.email,
    client_name: contact.name || "there",
    document_name: doc.filename,
    expiry_date: doc.expiry_date,
    days_until_expiry: daysUntilExpiry,
  }

  const result = await dispatchNotification(payload)

  if (!result.ok) {
    // Use adminClient (service role) — workflow_errors is an audit log, not a
    // user mutation. With user JWT the RLS policy (app_metadata.role='admin')
    // can silently kill the insert when the role claim is absent.
    await adminClient.from("workflow_errors").insert({
      workflow_name: "expiry_alert_manual",
      error_message: result.error ?? "unknown dispatch failure",
      payload: payload,
    })
    return { ok: false, error: result.error ?? "Dispatch failed" }
  }

  // Same rationale — admin audit insert, use service role.
  await adminClient.from("notifications_sent").insert({
    client_id: doc.client_id,
    notification_type: "expiry_warning_manual",
    document_id: doc.id,
    alert_window: daysUntilExpiry,
  })

  return { ok: true }
}
