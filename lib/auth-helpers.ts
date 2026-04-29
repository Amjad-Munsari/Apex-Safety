import { createClient } from "@/lib/supabase/server"

export async function getSession() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function isAdmin() {
  const user = await getUser()
  if (!user) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .single()

  return !!data && !error
}

export async function getClientContext() {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("client_users")
    .select("client_id, role")
    .eq("id", user.id)
    .single()

  if (error || !data) return null
  return data
}
