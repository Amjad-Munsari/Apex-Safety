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
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  signOffName: "Matt Robinson",
  senderName: "888 Safety & Training",
  expiryRemindersEnabled: true,
  notifyOnUpload: true,
  logoPath: null,
  logoUrl: null,
}

/**
 * Read the singleton app_settings row. Falls back to defaults if the row is
 * missing (e.g. migration not yet applied) so callers never crash on settings.
 * Reads via the service-role adminClient.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const { data } = await adminClient
    .from("app_settings")
    .select("sign_off_name, sender_name, expiry_reminders_enabled, notify_on_upload, logo_path")
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
  }
}
