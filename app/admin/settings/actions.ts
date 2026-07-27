"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-helpers"
import {
  verifyCurrentPayPalConnection,
  verifyPayPalCredentials,
  type PayPalConnectionHealth,
  type PayPalMode,
} from "@/lib/paypal"
import {
  detectAllowedDocumentType,
  mimeMatchesDetectedType,
} from "@/lib/files/file-signature"
import { logAppError } from "@/lib/observability/log"

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB (matches the dropzone copy)
const ALLOWED_LOGO_MIME = new Set(["image/png", "image/jpeg", "image/webp"])

export interface SavePayPalCredentialsInput {
  clientId: string
  clientSecret: string
  mode: PayPalMode
}

export interface PayPalConnectionStatus {
  health: PayPalConnectionHealth
  mode: PayPalMode
  clientIdHint: string | null
  verifiedAt: string | null
}

function validPayPalValue(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && !/[\u0000-\u001F\u007F]/.test(value)
}

/**
 * Verify a credential pair with PayPal before committing it to Vault. The
 * returned shape is deliberately status-only because Server Action responses
 * are serialized to the browser.
 */
export async function savePayPalCredentials(
  input: SavePayPalCredentialsInput
): Promise<{ ok: true; status: PayPalConnectionStatus } | { ok: false; error: string }> {
  await requireAdmin()

  const clientId = typeof input?.clientId === "string" ? input.clientId.trim() : ""
  const clientSecret =
    typeof input?.clientSecret === "string" ? input.clientSecret.trim() : ""
  const mode = input?.mode

  if (
    !validPayPalValue(clientId, 512) ||
    !validPayPalValue(clientSecret, 1024) ||
    (mode !== "sandbox" && mode !== "live")
  ) {
    return { ok: false, error: "Enter a valid Client ID, secret, and connection mode." }
  }

  const verification = await verifyPayPalCredentials({ clientId, clientSecret, mode })
  if (!verification.ok) return verification

  const { data, error } = await adminClient.rpc("set_paypal_runtime_credentials", {
    p_client_id: clientId,
    p_client_secret: clientSecret,
    p_mode: mode,
  })
  if (error) return { ok: false, error: "Could not save the PayPal connection. Try again." }

  const row = (Array.isArray(data) ? data[0] : data) as {
    enabled?: unknown
    paypal_mode?: unknown
    client_id_hint?: unknown
    verified_at?: unknown
  } | null
  if (
    !row ||
    typeof row.enabled !== "boolean" ||
    (row.paypal_mode !== "sandbox" && row.paypal_mode !== "live") ||
    typeof row.client_id_hint !== "string" ||
    typeof row.verified_at !== "string"
  ) {
    return { ok: false, error: "PayPal was saved but its status could not be confirmed. Refresh and try again." }
  }

  revalidatePath("/admin/settings")
  revalidatePath("/client/billing")
  return {
    ok: true,
    status: {
      health: row.enabled ? "connected" : "paused",
      mode: row.paypal_mode,
      clientIdHint: row.client_id_hint,
      verifiedAt: row.verified_at,
    },
  }
}

/** Pause or resume only new checkout creation; pending orders retain their key version. */
export async function setPayPalPaymentsEnabled(
  enabled: boolean
): Promise<{ ok: true; status: PayPalConnectionStatus } | { ok: false; error: string }> {
  await requireAdmin()
  if (typeof enabled !== "boolean") return { ok: false, error: "Choose whether new payments are enabled." }

  if (enabled) {
    const verification = await verifyCurrentPayPalConnection()
    if (!verification.ok) return verification
  }

  const { data, error } = await adminClient.rpc("set_paypal_payments_enabled", { p_enabled: enabled })
  if (error) {
    return {
      ok: false,
      error: enabled
        ? "Could not resume payments. Check the saved PayPal connection and try again."
        : "Could not pause payments. Try again.",
    }
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    enabled?: unknown
    paypal_mode?: unknown
    client_id_hint?: unknown
    verified_at?: unknown
  } | null
  if (
    !row ||
    row.enabled !== enabled ||
    (row.paypal_mode !== "sandbox" && row.paypal_mode !== "live") ||
    typeof row.client_id_hint !== "string" ||
    typeof row.verified_at !== "string"
  ) {
    return { ok: false, error: "PayPal status could not be confirmed. Refresh and try again." }
  }

  revalidatePath("/admin/settings")
  revalidatePath("/client/billing")
  return {
    ok: true,
    status: {
      health: enabled ? "connected" : "paused",
      mode: row.paypal_mode,
      clientIdHint: row.client_id_hint,
      verifiedAt: row.verified_at,
    },
  }
}

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
    if (rmErr) {
      await logAppError({
        area: "settings.branding_logo.cleanup",
        source: "action",
        severity: "warning",
        error: rmErr,
        actorType: "admin",
        context: { note: "logo reference cleared; object left in storage" },
      })
    }
  }

  revalidatePath("/admin/settings")
  return { ok: true }
}
