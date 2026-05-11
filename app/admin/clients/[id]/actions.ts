"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"

export async function uploadClientDocumentAction(formData: FormData) {
  const supabase = await createClient()

  const cookieStore = await cookies()
  const isDemoMode = cookieStore.get("demo_mode")?.value === "1"

  // 1. Verify admin session or allow demo mode
  let userId: string

  if (isDemoMode) {
    // Use a fixed dummy admin ID for demo mode
    userId = "276946f9-0d99-4f55-bba1-8abe1f4f87b7"
  } else {
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

  // 2. Upload file to Storage
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `${clientId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(filePath, file)

  if (uploadError) {
    console.error("Storage upload error:", uploadError)
    throw new Error("Failed to upload document")
  }

  // 3. Insert into documents table
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
    // Attempt to clean up storage if db fails
    await supabase.storage.from("client-documents").remove([filePath])
    throw new Error("Failed to save document metadata")
  }

  // 4. Fetch Client Contact for Notifications
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("name, email")
    .eq("client_id", clientId)
    .limit(1)

  const contact = clientUsers?.[0]
  const contactEmail = contact?.email
  const contactName = contact?.name || "there"

  // 5. Dispatch new-document notification via n8n
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

  // 6. Revalidate
  revalidatePath(`/admin/clients/${clientId}`)

  return { success: true, document }
}
