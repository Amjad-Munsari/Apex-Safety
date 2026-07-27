"use server"

import { createClient } from "@/lib/supabase/server"
import { adminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/auth-helpers"
import { assertClientActive } from "@/lib/clients/require-active"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { getAppSettings } from "@/lib/settings/app-settings"
import { logAppError, logWorkflowFailure } from "@/lib/observability/log"
import {
  detectAllowedDocumentType,
  mimeMatchesDetectedType,
} from "@/lib/files/file-signature"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Server-side upload limits — the client modal's accept="" attribute is not a
// security control (a direct server-action call bypasses it).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
])

export async function uploadClientDocumentAction(formData: FormData) {
  const supabase = await createClient()

  // Demo bypass is dev-only (never honor the client-set cookie in production).
  const cookieStore = await cookies()
  const isDemoMode =
    process.env.NODE_ENV !== "production" && cookieStore.get("demo_mode")?.value === "1"

  let userId: string

  if (isDemoMode) {
    userId = "276946f9-0d99-4f55-bba1-8abe1f4f87b7"
  } else {
    // Admin-only action (uploads a document for any client org). Without this,
    // any authenticated client user could upload to an arbitrary clientId.
    if (!(await isAdmin())) throw new Error("Unauthorized")
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")
    userId = user.id
  }

  const clientId = formData.get("clientId") as string
  const category = formData.get("category") as string
  const expiryDate = formData.get("expiryDate") as string
  const file = formData.get("file") as File

  if (!clientId || !category || !file) {
    throw new Error("Missing required fields")
  }
  if (!UUID_RE.test(clientId)) {
    throw new Error("Invalid client id")
  }
  // Frozen-client guard — no new docs for a deactivated client (existing stay).
  await assertClientActive(clientId)
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 25 MB limit")
  }
  if (file.size === 0) {
    throw new Error("The selected file is empty")
  }
  // Fail CLOSED. The old `file.type && !ALLOWED_MIME.has(...)` skipped the
  // allowlist entirely when the part carried no Content-Type, so omitting the
  // header was enough to opt out of it.
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Unsupported file type — upload a PDF or image")
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer())
  const detectedType = detectAllowedDocumentType(fileBytes)
  if (!detectedType || !mimeMatchesDetectedType(file.type, detectedType.mime)) {
    throw new Error("The file contents do not match an allowed PDF or image type")
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${detectedType.extension}`
  const filePath = `${clientId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(filePath, file)

  if (uploadError) {
    await logAppError({
      area: "documents.upload.storage",
      source: "action",
      error: uploadError,
      actorType: "admin",
      clientId,
      context: { filePath, category, sizeBytes: file.size },
    })
    throw new Error("Failed to upload document")
  }

  const { data: document, error: dbError } = await supabase
    .from("documents")
    .insert({
      client_id: clientId,
      filename: file.name,
      document_category: category,
      storage_path: filePath,
      expiry_date: expiryDate || null,
      file_size_bytes: file.size,
      uploaded_by: userId,
      active: true,
    })
    .select()
    .single()

  if (dbError) {
    await logAppError({
      area: "documents.upload.metadata",
      source: "action",
      error: dbError,
      actorType: "admin",
      clientId,
      context: { filePath, category, note: "uploaded object rolled back" },
    })
    await supabase.storage.from("client-documents").remove([filePath])
    throw new Error("Failed to save document metadata")
  }

  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("name, email")
    .eq("client_id", clientId)
    .limit(1)

  const contact = clientUsers?.[0]
  const contactEmail = contact?.email
  const contactName = contact?.name || "there"

  // Respect the admin "Notify on document upload" setting — when off, the
  // document is still saved but no client notification is dispatched.
  const settings = await getAppSettings()

  if (contactEmail && settings.notifyOnUpload) {
    const result = await dispatchNotification({
      type: "document_uploaded",
      client_email: contactEmail,
      client_name: contactName,
      document_name: file.name,
      document_category: category,
      expiry_date: expiryDate || null,
    })
    if (!result.ok) {
      await logWorkflowFailure({
        workflowName: "document_uploaded",
        error: result.error ?? "unknown dispatch failure",
        area: "notifications.document_uploaded",
        source: "action",
        clientId,
        payload: {
          document_id: document?.id,
          document_name: file.name,
          outboxId: result.outboxId ?? null,
        },
      })
    }
  } else if (!settings.notifyOnUpload) {
    console.info(`[upload] upload notifications disabled in settings — skipping for client ${clientId}`)
  } else {
    console.warn(`[upload] no contact email for client ${clientId}, skipping notification`)
  }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin/compliance")
  revalidatePath("/client/compliance")

  return { success: true, document }
}

/**
 * Permanently delete a client document: removes the DB row and its file in the
 * `client-documents` bucket. Admin-only. Throws on failure so the calling button
 * can surface a toast (mirrors deleteProposal / deleteAssessment).
 */
export async function deleteDocument(documentId: string) {
  if (!(await isAdmin())) throw new Error("Unauthorized")

  const { data: doc } = await adminClient
    .from("documents")
    .select("storage_path, client_id")
    .eq("id", documentId)
    .maybeSingle()

  // Nothing to delete — treat as success so the UI can refresh cleanly.
  if (!doc) return

  const { error: delErr } = await adminClient.from("documents").delete().eq("id", documentId)
  if (delErr) throw new Error(delErr.message)

  // Best-effort storage cleanup — the row is already gone; a stranded file is
  // lower-risk than a half-deleted document.
  if (doc.storage_path) {
    const { error: rmErr } = await adminClient.storage
      .from("client-documents")
      .remove([doc.storage_path])
    if (rmErr) {
      await logAppError({
        area: "documents.delete.storage_cleanup",
        source: "action",
        severity: "warning",
        error: rmErr,
        actorType: "admin",
        clientId: doc.client_id ?? null,
        context: { documentId, storagePath: doc.storage_path, note: "row deleted; file stranded" },
      })
    }
  }

  if (doc.client_id) revalidatePath(`/admin/clients/${doc.client_id}`)
  revalidatePath("/admin/compliance")
  revalidatePath("/client/compliance")
  revalidatePath("/admin")
}
