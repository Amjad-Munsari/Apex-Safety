"use server"

import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth-helpers"
import { assertClientActive } from "@/lib/clients/require-active"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"

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
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    throw new Error("Unsupported file type — upload a PDF or image")
  }

  const fileExt = file.name.split(".").pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `${clientId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(filePath, file)

  if (uploadError) {
    console.error("Storage upload error:", uploadError)
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
    console.error("Database insert error:", dbError)
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

  if (contactEmail) {
    const result = await dispatchNotification({
      type: "document_uploaded",
      client_email: contactEmail,
      client_name: contactName,
      document_name: file.name,
      document_category: category,
      expiry_date: expiryDate || null,
    })
    if (!result.ok) {
      console.error(`[upload] notification dispatch failed for client ${clientId}: ${result.error}`)
      await supabase.from("workflow_errors").insert({
        workflow_name: "document_uploaded",
        error_message: result.error ?? "unknown dispatch failure",
        payload: { client_id: clientId, document_id: document?.id, document_name: file.name },
      })
    }
  } else {
    console.warn(`[upload] no contact email for client ${clientId}, skipping notification`)
  }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin/compliance")
  revalidatePath("/client/compliance")

  return { success: true, document }
}
