"use server"

import { adminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"

export async function getComplianceDocSignedUrl(
  docId: string,
  opts: { mode?: "view" | "download" } = {}
): Promise<{ url: string | null; filename: string | null }> {
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
  const supabase = await createClient()

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
    await supabase.from("workflow_errors").insert({
      workflow_name: "expiry_alert_manual",
      error_message: result.error ?? "unknown dispatch failure",
      payload: payload,
    })
    return { ok: false, error: result.error ?? "Dispatch failed" }
  }

  await supabase.from("notifications_sent").insert({
    client_id: doc.client_id,
    notification_type: "expiry_warning_manual",
    document_id: doc.id,
    alert_window: daysUntilExpiry,
  })

  return { ok: true }
}
