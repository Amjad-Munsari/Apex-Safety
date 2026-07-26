import "server-only"

import { adminClient } from "@/lib/supabase/admin"

export interface AppSettings {
  signOffName: string
  senderName: string
  expiryRemindersEnabled: boolean
  notifyOnUpload: boolean
  logoPath: string | null
  /** Public URL for the branding logo, derived from logoPath (null when unset). */
  logoUrl: string | null
  /** Reference rate for the hours⇄credits conversion (credits per hour). */
  creditsPerHour: number
  brandingPrimary: string
  brandingSecondary: string
  paypal: {
    mode: "sandbox" | "live"
    clientIdHint: string | null
    verifiedAt: string | null
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  signOffName: "Matt Robinson",
  senderName: "888 Safety & Training",
  expiryRemindersEnabled: true,
  notifyOnUpload: true,
  logoPath: null,
  logoUrl: null,
  creditsPerHour: 4,
  brandingPrimary: "#3b8273",
  brandingSecondary: "#d97706",
  paypal: {
    mode: "live",
    clientIdHint: null,
    verifiedAt: null,
  },
}

/**
 * Read the singleton app_settings row. Falls back to defaults if the row is
 * missing (e.g. migration not yet applied) so callers never crash on settings.
 * Reads via the service-role adminClient.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const { data } = await adminClient
    .from("app_settings")
    .select("sign_off_name, sender_name, expiry_reminders_enabled, notify_on_upload, logo_path, credits_per_hour, branding_primary, branding_secondary, paypal_enabled, paypal_mode, paypal_client_id_hint, paypal_verified_at")
    .eq("id", 1)
    .maybeSingle()

  if (!data) return DEFAULT_APP_SETTINGS

  const logoPath = data.logo_path ?? null
  const logoUrl = logoPath
    ? adminClient.storage.from("branding").getPublicUrl(logoPath).data.publicUrl
    : null

  return {
    signOffName: data.sign_off_name ?? DEFAULT_APP_SETTINGS.signOffName,
    senderName: data.sender_name ?? DEFAULT_APP_SETTINGS.senderName,
    expiryRemindersEnabled: data.expiry_reminders_enabled ?? true,
    notifyOnUpload: data.notify_on_upload ?? true,
    logoPath,
    logoUrl,
    creditsPerHour: data.credits_per_hour ?? DEFAULT_APP_SETTINGS.creditsPerHour,
    brandingPrimary:
      data.branding_primary ?? DEFAULT_APP_SETTINGS.brandingPrimary,
    brandingSecondary:
      data.branding_secondary ?? DEFAULT_APP_SETTINGS.brandingSecondary,
    paypal: {
      mode: data.paypal_mode === "sandbox" ? "sandbox" : "live",
      clientIdHint: data.paypal_client_id_hint ?? null,
      verifiedAt: data.paypal_verified_at ?? null,
    },
  }
}
