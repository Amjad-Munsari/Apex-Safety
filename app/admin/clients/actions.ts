"use server"

import { adminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"

export type NewClientInput = {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  siteAddress?: string
}

/**
 * Insert a new client row and return its id. The caller (proposal builder,
 * client list page, etc.) decides what to do with the id — usually advance
 * to the next step or revalidate the list.
 */
export async function createClient(input: NewClientInput): Promise<{ id: string }> {
  if (!(await isAdmin())) throw new Error("Unauthorized")

  const name = input.name.trim()
  if (!name) throw new Error("Business name is required")

  const { data, error } = await adminClient
    .from("clients")
    .insert({
      name,
      contact_name: input.contactName?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      site_address: input.siteAddress?.trim() || null,
      hours_balance: 0,
      active: true,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("Error creating client:", error)
    throw new Error(error?.message || "Failed to create client")
  }

  revalidatePath("/admin/clients")
  revalidatePath("/admin/proposals/new")
  revalidatePath("/admin")

  return { id: data.id }
}

export async function updateClientHours(clientId: string, adjustment: number) {
  if (!(await isAdmin())) throw new Error("Unauthorized")

  // 1. Get current balance
  const { data: client, error: fetchError } = await adminClient
    .from("clients")
    .select("hours_balance")
    .eq("id", clientId)
    .single()

  if (fetchError || !client) {
    throw new Error("Client not found")
  }

  const newBalance = Math.max(0, (client.hours_balance || 0) + adjustment)

  // 2. Update balance
  const { error: updateError } = await adminClient
    .from("clients")
    .update({ hours_balance: newBalance })
    .eq("id", clientId)

  if (updateError) {
    throw new Error(`Failed to update hours: ${updateError.message}`)
  }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin")

  return { success: true, newBalance }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client portal access — invite / resend / revoke
//
// Onboarding uses the Supabase Admin API to create the auth user (which sets the
// auth token columns correctly, unlike a raw SQL insert) and generates an action
// link. Email automation is deferred (Option C): we return the link so the admin
// can send it manually. The invitee clicks it → /auth/callback exchanges the code
// → lands on /auth/set-password to choose a password.
// ─────────────────────────────────────────────────────────────────────────────

function portalRedirectTo(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  return `${base.replace(/\/$/, "")}/auth/callback?next=/auth/set-password`
}

export type InviteClientUserInput = {
  name: string
  email: string
  role?: string
}

export type InviteResult =
  | { ok: true; link: string; status: "invited" | "resent"; name: string }
  | { ok: false; error: string }

export async function inviteClientUser(
  clientId: string,
  input: InviteClientUserInput
): Promise<InviteResult> {
  // AuthZ: these actions wield the service-role client (creates auth users,
  // mints login links). There is no route middleware, so this server-trusted
  // admin_users check is the sole gate. Match the sibling-action convention.
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" }

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  // Constrain role to a known allowlist — never trust the client value.
  const role = input.role === "owner" ? "owner" : "member"

  if (!name) return { ok: false, error: "Name is required." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." }

  const redirectTo = portalRedirectTo()

  // Already linked to a client? Short-circuit with a clear outcome.
  const { data: existingLink } = await adminClient
    .from("client_users")
    .select("id, client_id")
    .eq("email", email)
    .maybeSingle()

  if (existingLink) {
    if (existingLink.client_id !== clientId) {
      return { ok: false, error: "That email is already linked to another organisation." }
    }
    // Same org → issue a fresh set-password link (resend).
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    })
    if (error || !data?.properties?.action_link) {
      return { ok: false, error: error?.message || "Could not generate a link." }
    }
    return { ok: true, link: data.properties.action_link, status: "resent", name }
  }

  // Not linked yet → invite (creates the auth user). If the auth user already
  // exists (without a client_users link), fall back to a recovery link.
  let userId: string | undefined
  let link: string | undefined

  const invite = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, data: { name } },
  })

  if (invite.error) {
    const recovery = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    })
    if (recovery.error) return { ok: false, error: invite.error.message }
    userId = recovery.data.user?.id
    link = recovery.data.properties?.action_link
  } else {
    userId = invite.data.user?.id
    link = invite.data.properties?.action_link
  }

  if (!userId || !link) return { ok: false, error: "Could not create the invite link." }

  const { error: linkErr } = await adminClient.from("client_users").insert({
    id: userId,
    client_id: clientId,
    name,
    email,
    role,
  })
  if (linkErr) return { ok: false, error: linkErr.message }

  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true, link, status: "invited", name }
}

export async function revokeClientUser(
  clientId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" }

  // Removes the org link → the user can no longer resolve a client context, so
  // the portal shows the "sign in to continue" fallback. The auth account is
  // left intact (no orphaned-data risk); re-inviting re-links it.
  const { error } = await adminClient
    .from("client_users")
    .delete()
    .eq("id", userId)
    .eq("client_id", clientId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true }
}
