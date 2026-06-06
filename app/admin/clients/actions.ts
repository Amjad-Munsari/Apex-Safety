"use server"

import { adminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"

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

export async function updateClientHours(clientId: string, adjustment: number) {
  // Admin-role gate — adjusts billable hours_balance via the service-role
  // adminClient. Without this any authenticated user could top up / drain any
  // client's hours. requireAdmin() enforces admin_users membership.
  await requireAdmin()

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
