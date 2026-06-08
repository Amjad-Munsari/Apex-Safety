"use server"

import { adminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { assertClientActive, clientIsActive, CLIENT_DEACTIVATED_MESSAGE } from "@/lib/clients/require-active"

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
  // Admin-role gate — inserts via the service-role adminClient (RLS bypassed),
  // so without this any authenticated user could create client orgs.
  // requireAdmin() enforces admin_users membership and stays demo-compatible.
  await requireAdmin()

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

/**
 * Toggle a client's active flag. Reversible — used by both the Deactivate and
 * Reactivate controls in the client detail Danger Zone. No data is touched;
 * inactive clients stay in the list (badged) so reactivation is discoverable.
 */
export async function setClientActive(
  clientId: string,
  active: boolean
): Promise<{ ok: true; active: boolean } | { ok: false; error: string }> {
  // Admin-role gate — writes via the service-role adminClient (RLS bypassed).
  await requireAdmin()

  const { error } = await adminClient
    .from("clients")
    .update({ active })
    .eq("id", clientId)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/clients")
  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin")
  return { ok: true, active }
}

/**
 * Permanently delete a client and its entire relational subtree.
 *
 * IRREVERSIBLE. Guarded by a server-side name match (the dialog also gates the
 * button client-side, but that is UX only — this check is the real boundary).
 *
 * Order is load-bearing — clientId must stay resolvable through the cleanup, so
 * the row delete is LAST:
 *   1. requireAdmin()
 *   2. re-fetch name; reject if missing or confirmationName !== name
 *   3. best-effort Storage cleanup (reports + form-media under `${clientId}/`).
 *      A failure here is logged to workflow_errors and does NOT abort — orphaned
 *      bucket objects are lower-risk than a half-deleted client (mirrors the
 *      report-delivery philosophy in assessments/actions.ts).
 *   4. delete customer-owned form_templates (polymorphic owner_id, no DB FK —
 *      see AGENTS.md; their template_versions cascade).
 *   5. delete the clients row — migration 021 cascades assignments, submissions,
 *      field_media, documents, hours_transactions, proposals, signatures,
 *      client_users, and notifications_sent atomically.
 */
export async function deleteClient(
  clientId: string,
  confirmationName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  // Step 2: re-fetch the authoritative name and verify the confirmation.
  const { data: client, error: fetchError } = await adminClient
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle()

  if (fetchError) return { ok: false, error: fetchError.message }
  if (!client) return { ok: false, error: "Client not found." }
  if (confirmationName.trim() !== client.name) {
    return { ok: false, error: "Name does not match." }
  }

  // Step 3: best-effort Storage cleanup. list() is shallow, so we walk the two
  // top-level prefixes the app writes under `${clientId}/...`.
  try {
    await removeClientStorage(clientId)
  } catch (err) {
    console.error("client delete: storage cleanup failed", { clientId, err })
    await adminClient.from("workflow_errors").insert({
      workflow_name: "client_delete_storage",
      error_message: err instanceof Error ? err.message : String(err),
      payload: { clientId },
    })
    // continue — do NOT abort the delete
  }

  // Step 4: customer-owned templates (no FK to clients; versions cascade).
  const { error: tplError } = await adminClient
    .from("form_templates")
    .delete()
    .eq("owner_type", "customer")
    .eq("owner_id", clientId)
  if (tplError) return { ok: false, error: `Failed to remove client templates: ${tplError.message}` }

  // Step 5: delete the client — DB cascades the relational subtree.
  const { error: delError } = await adminClient
    .from("clients")
    .delete()
    .eq("id", clientId)
  if (delError) return { ok: false, error: delError.message }

  revalidatePath("/admin/clients")
  revalidatePath("/admin")
  return { ok: true }
}

/**
 * Remove all Storage objects written under a client's prefix in the `reports`
 * and `form-media` buckets. Storage has no FK to the DB, so this is the only
 * thing that reclaims a deleted client's files. Recurses one level because
 * form-media nests as `${clientId}/signatures|photos/${submissionId}/...`.
 */
async function removeClientStorage(clientId: string): Promise<void> {
  for (const bucket of ["reports", "form-media"] as const) {
    const paths = await listAllUnder(bucket, clientId)
    if (paths.length > 0) {
      const { error } = await adminClient.storage.from(bucket).remove(paths)
      if (error) throw new Error(`${bucket}: ${error.message}`)
    }
  }
}

/** Depth-first list of every object path under `prefix` in a bucket. */
async function listAllUnder(bucket: string, prefix: string): Promise<string[]> {
  const { data: entries, error } = await adminClient.storage
    .from(bucket)
    .list(prefix, { limit: 1000 })
  if (error) throw new Error(`${bucket} list ${prefix}: ${error.message}`)
  if (!entries) return []

  const files: string[] = []
  for (const entry of entries) {
    const full = `${prefix}/${entry.name}`
    // Supabase marks true files with a metadata/id; folders come back with id=null.
    if (entry.id === null) {
      files.push(...(await listAllUnder(bucket, full)))
    } else {
      files.push(full)
    }
  }
  return files
}

export async function updateClientHours(clientId: string, adjustment: number) {
  // Admin-role gate — adjusts billable hours_balance via the service-role
  // adminClient. Without this any authenticated user could top up / drain any
  // client's hours. requireAdmin() enforces admin_users membership.
  await requireAdmin()
  // Frozen-client guard — no hours changes on a deactivated client.
  await assertClientActive(clientId)

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

  // Frozen-client guard — can't invite users to a deactivated client.
  if (!(await clientIsActive(clientId))) {
    return { ok: false, error: CLIENT_DEACTIVATED_MESSAGE }
  }

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
