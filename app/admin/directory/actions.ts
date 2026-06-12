"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-helpers"
import type { ContractorInput } from "@/lib/data/contractors"

function revalidateDirectory() {
  revalidatePath("/admin/directory")
  revalidatePath("/client/directory")
}

export async function addContractor(data: ContractorInput) {
  // Admin-role gate — directory writes via the service-role adminClient.
  await requireAdmin()

  const { error } = await adminClient.from("contractors").insert([
    {
      company_name: data.company_name,
      category: data.category,
      contact_name: data.contact_name,
      phone: data.phone,
      email: data.email,
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      active: data.active ?? true,
    },
  ])

  if (error) {
    console.error("Error adding contractor:", error)
    throw new Error(error.message)
  }

  revalidateDirectory()
}

export async function updateContractor(id: string, data: ContractorInput) {
  // Admin-role gate — directory writes via the service-role adminClient.
  await requireAdmin()

  const { error } = await adminClient
    .from("contractors")
    .update({
      company_name: data.company_name,
      category: data.category,
      contact_name: data.contact_name,
      phone: data.phone,
      email: data.email,
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      ...(data.active !== undefined ? { active: data.active } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    console.error("Error updating contractor:", error)
    throw new Error(error.message)
  }

  revalidateDirectory()
}

export async function toggleContractorActive(id: string, active: boolean) {
  // Admin-role gate — directory writes via the service-role adminClient.
  await requireAdmin()

  const { error } = await adminClient
    .from("contractors")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Error toggling contractor state:", error)
    throw new Error(error.message)
  }

  revalidateDirectory()
}

export async function deleteContractor(id: string) {
  // Admin-role gate — directory writes via the service-role adminClient.
  await requireAdmin()

  const { error } = await adminClient
    .from("contractors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Error deleting contractor:", error)
    throw new Error(error.message)
  }

  revalidateDirectory()
}
