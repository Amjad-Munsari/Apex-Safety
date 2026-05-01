"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { sendMockSMS, sendMockEmail } from "@/lib/notifications/mock-dispatch"

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

  const { data: clientData } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single()

  const clientName = clientData?.name || "Client"
  const contact = clientUsers?.[0]

  // 5. Send Mock Notifications
  const mockPhone = "+447700900000" // Mock phone since we don't store it yet
  const contactEmail = contact?.email || "unknown@example.com"
  const contactName = contact?.name || "there"

  const smsMessage = `888 Safety: A new document (${category}) has been uploaded to your portal. Login to view: https://portal.888safety.com`
  await sendMockSMS(mockPhone, smsMessage)

  const emailSubject = `New Document Uploaded: ${category}`
  const emailBody = `Hi ${contactName},

A new document has been uploaded to your 888 Safety compliance portal.
Document: ${file.name}
Category: ${category}
${expiryDate ? `Expiry Date: ${expiryDate}` : ""}

Please log in to your portal to view or download it.

Regards,
888 Safety`
  
  await sendMockEmail(contactEmail, emailSubject, emailBody)

  // 6. Revalidate
  revalidatePath(`/admin/clients/${clientId}`)

  return { success: true, document }
}
