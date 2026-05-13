"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import type { ServiceCategory } from "@/lib/data/services"

type ServicePayload = {
  name: string
  description?: string | null
  category: ServiceCategory
  unit_price: number | null
  unit?: string
  active?: boolean
}

export async function addService(data: ServicePayload) {
  const { error } = await adminClient.from("services").insert([
    {
      name: data.name,
      description: data.description ?? null,
      category: data.category,
      unit_price: data.unit_price,
      unit: data.unit?.trim() || "each",
      active: data.active ?? true,
    },
  ])

  if (error) {
    console.error("Error adding service:", error)
    throw new Error(error.message)
  }

  revalidatePath("/admin/services")
  revalidatePath("/admin/proposals/new")
}

export async function updateService(id: string, data: ServicePayload) {
  const { error } = await adminClient
    .from("services")
    .update({
      name: data.name,
      description: data.description ?? null,
      category: data.category,
      unit_price: data.unit_price,
      unit: data.unit?.trim() || "each",
      ...(data.active !== undefined ? { active: data.active } : {}),
    })
    .eq("id", id)

  if (error) {
    console.error("Error updating service:", error)
    throw new Error(error.message)
  }

  revalidatePath("/admin/services")
  revalidatePath("/admin/proposals/new")
}

export async function toggleServiceActive(id: string, active: boolean) {
  const { error } = await adminClient
    .from("services")
    .update({ active })
    .eq("id", id)

  if (error) {
    console.error("Error toggling service state:", error)
    throw new Error(error.message)
  }

  revalidatePath("/admin/services")
  revalidatePath("/admin/proposals/new")
}

export async function deleteService(id: string) {
  const { error } = await adminClient
    .from("services")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Error deleting service:", error)
    throw new Error(error.message)
  }

  revalidatePath("/admin/services")
  revalidatePath("/admin/proposals/new")
}
