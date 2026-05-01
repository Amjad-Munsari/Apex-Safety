"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"

export async function addService(data: {
  name: string
  description?: string
  category?: string
  unit_price: number
}) {
  const { error } = await adminClient
    .from("services")
    .insert([
      {
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        unit_price: data.unit_price,
      },
    ])

  if (error) {
    console.error("Error adding service:", error)
    throw new Error(error.message)
  }

  revalidatePath("/admin/services")
  revalidatePath("/admin/proposals/new")
}

export async function updateService(
  id: string,
  data: {
    name: string
    description?: string
    category?: string
    unit_price: number
  }
) {
  const { error } = await adminClient
    .from("services")
    .update({
      name: data.name,
      description: data.description || null,
      category: data.category || null,
      unit_price: data.unit_price,
      updated_at: new Date().toISOString(),
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
    .update({ active, updated_at: new Date().toISOString() })
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
