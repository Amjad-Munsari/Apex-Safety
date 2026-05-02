"use server"

import { adminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function updateClientHours(clientId: string, adjustment: number) {
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
