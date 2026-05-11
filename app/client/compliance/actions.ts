"use server"

import { createClient } from "@/lib/supabase/server"

export async function getClientComplianceDocSignedUrl(
  docId: string
): Promise<{ url: string | null; filename: string | null }> {
  const supabase = await createClient()

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("storage_path, filename")
    .eq("id", docId)
    .maybeSingle()

  if (docErr || !doc?.storage_path) {
    return { url: null, filename: doc?.filename ?? null }
  }

  const { data: signed, error: signErr } = await supabase
    .storage
    .from("client-documents")
    .createSignedUrl(doc.storage_path, 60 * 5, { download: doc.filename ?? true })

  if (signErr || !signed?.signedUrl) {
    return { url: null, filename: doc.filename }
  }

  return { url: signed.signedUrl, filename: doc.filename }
}
