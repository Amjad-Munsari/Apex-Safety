"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-helpers"

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB (matches the dropzone copy)
const ALLOWED_LOGO_MIME = new Set(["image/png", "image/svg+xml", "image/jpeg", "image/webp"])

export interface SaveNotificationSettingsInput {
  signOffName: string
  senderName: string
  expiryRemindersEnabled: boolean
  notifyOnUpload: boolean
  /** Reference rate for the hours⇄credits conversion (credits per hour). */
  creditsPerHour: number
}

/**
 * Persist the notification defaults from the admin Settings page. These were
 * previously local-only React state that reset on reload. The toggles now gate
 * real dispatch (see lib/documents/actions.ts and the expiry reminder paths);
 * the sign-off / sender names are read by n8n when composing emails.
 */
export async function saveNotificationSettings(
  input: SaveNotificationSettingsInput
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const signOff = input.signOffName.trim()
  const sender = input.senderName.trim()
  if (!signOff) return { ok: false, error: "Sign-off name is required." }
  if (!sender) return { ok: false, error: "Sender name is required." }
  // Reference rate must be a positive integer (matches the DB CHECK >= 1).
  const creditsPerHour = input.creditsPerHour
  if (!Number.isInteger(creditsPerHour) || creditsPerHour < 1) {
    return { ok: false, error: "Credits per hour must be a whole number of 1 or more." }
  }

  const { error } = await adminClient
    .from("app_settings")
    .update({
      sign_off_name: signOff,
      sender_name: sender,
      expiry_reminders_enabled: input.expiryRemindersEnabled,
      notify_on_upload: input.notifyOnUpload,
      credits_per_hour: creditsPerHour,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/settings")
  return { ok: true }
}

/**
 * Upload a branding logo to the public `branding` bucket and persist its path.
 * Returns the public URL so the form can preview it immediately. Replaces the
 * old no-op that only toasted "logo staged".
 */
export async function uploadBrandingLogo(
  formData: FormData
): Promise<{ ok: boolean; logoUrl?: string; error?: string }> {
  await requireAdmin()

  const file = formData.get("logo") as File | null
  if (!file || file.size === 0) return { ok: false, error: "No file selected." }
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "Logo exceeds the 2 MB limit." }
  if (file.type && !ALLOWED_LOGO_MIME.has(file.type)) {
    return { ok: false, error: "Upload a PNG, SVG, JPEG or WebP image." }
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png"
  // Stable name per upload so the public URL changes (cache-busts) on replace.
  const path = `logo-${Date.now()}.${ext}`

  const { error: uploadError } = await adminClient.storage
    .from("branding")
    .upload(path, file, { contentType: file.type || "image/png", upsert: true })

  if (uploadError) return { ok: false, error: uploadError.message }

  // Remove the previous logo so the bucket doesn't accumulate orphans.
  const { data: prev } = await adminClient
    .from("app_settings")
    .select("logo_path")
    .eq("id", 1)
    .maybeSingle()

  const { error: updateError } = await adminClient
    .from("app_settings")
    .update({ logo_path: path, updated_at: new Date().toISOString() })
    .eq("id", 1)

  if (updateError) return { ok: false, error: updateError.message }

  if (prev?.logo_path && prev.logo_path !== path) {
    await adminClient.storage.from("branding").remove([prev.logo_path])
  }

  const { data: pub } = adminClient.storage.from("branding").getPublicUrl(path)
  revalidatePath("/admin/settings")
  return { ok: true, logoUrl: pub.publicUrl }
}

/**
 * Remove the branding logo: clear `logo_path` and delete the file from the
 * `branding` bucket. The client portal falls back to no logo.
 */
export async function removeBrandingLogo(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const { data: prev } = await adminClient
    .from("app_settings")
    .select("logo_path")
    .eq("id", 1)
    .maybeSingle()

  const { error } = await adminClient
    .from("app_settings")
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq("id", 1)

  if (error) return { ok: false, error: error.message }

  if (prev?.logo_path) {
    const { error: rmErr } = await adminClient.storage.from("branding").remove([prev.logo_path])
    if (rmErr) console.error("removeBrandingLogo: storage cleanup failed", rmErr)
  }

  revalidatePath("/admin/settings")
  return { ok: true }
}
