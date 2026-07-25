"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-helpers"
import {
  detectAllowedDocumentType,
  mimeMatchesDetectedType,
} from "@/lib/files/file-signature"

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB (matches the dropzone copy)
const ALLOWED_LOGO_MIME = new Set(["image/png", "image/jpeg", "image/webp"])

export interface SaveNotificationSettingsInput {
  signOffName: string
  senderName: string
  expiryRemindersEnabled: boolean
  notifyOnUpload: boolean
  /** Reference rate for the hours⇄credits conversion (credits per hour). */
  creditsPerHour: number
  brandingPrimary: string
  brandingSecondary: string
}

/**
 * Persist the notification defaults from the admin Settings page. These were
 * previously local-only React state that reset on reload. The toggles now gate
 * real dispatch (see lib/documents/actions.ts and the expiry reminder paths).
 * The sign-off / sender labels are retained for the agreed future email-brand
 * cutover; the current Resend identity still comes from deployment settings.
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
  const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/
  if (
    !HEX_COLOUR.test(input.brandingPrimary) ||
    !HEX_COLOUR.test(input.brandingSecondary)
  ) {
    return { ok: false, error: "Brand colours must be six-digit hex values." }
  }

  // UPSERT, not UPDATE: app_settings is a singleton seeded by migration 023, but
  // an UPDATE that matches no row is NOT an error — if the row is ever absent
  // (it was deleted from prod by a test-data sweep in Jul 2026) every save
  // silently no-ops while still returning ok:true, and getAppSettings masks it
  // by falling back to DEFAULT_APP_SETTINGS. Upserting id=1 self-heals instead.
  const { error } = await adminClient
    .from("app_settings")
    .upsert(
      {
        id: 1,
        sign_off_name: signOff,
        sender_name: sender,
        expiry_reminders_enabled: input.expiryRemindersEnabled,
        notify_on_upload: input.notifyOnUpload,
        credits_per_hour: creditsPerHour,
        branding_primary: input.brandingPrimary.toLowerCase(),
        branding_secondary: input.brandingSecondary.toLowerCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )

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
  // Fail CLOSED — an absent Content-Type must not bypass the allowlist.
  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    return { ok: false, error: "Upload a PNG, JPEG or WebP image." }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const detected = detectAllowedDocumentType(bytes)
  if (
    !detected ||
    !["image/png", "image/jpeg", "image/webp"].includes(detected.mime) ||
    !mimeMatchesDetectedType(file.type, detected.mime)
  ) {
    return { ok: false, error: "The logo bytes do not match the selected image type." }
  }

  const ext = detected.extension
  // Stable name per upload so the public URL changes (cache-busts) on replace.
  const path = `logo-${Date.now()}.${ext}`

  const { error: uploadError } = await adminClient.storage
    .from("branding")
    .upload(path, bytes, { contentType: detected.mime, upsert: true })

  if (uploadError) return { ok: false, error: uploadError.message }

  // Remove the previous logo so the bucket doesn't accumulate orphans.
  const { data: prev } = await adminClient
    .from("app_settings")
    .select("logo_path")
    .eq("id", 1)
    .maybeSingle()

  // Upsert for the same reason as saveNotificationSettings: a missing singleton
  // row would make the upload appear to succeed while the path was never stored.
  const { error: updateError } = await adminClient
    .from("app_settings")
    .upsert(
      { id: 1, logo_path: path, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    )

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
    .upsert(
      { id: 1, logo_path: null, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    )

  if (error) return { ok: false, error: error.message }

  if (prev?.logo_path) {
    const { error: rmErr } = await adminClient.storage.from("branding").remove([prev.logo_path])
    if (rmErr) console.error("removeBrandingLogo: storage cleanup failed", rmErr)
  }

  revalidatePath("/admin/settings")
  return { ok: true }
}
