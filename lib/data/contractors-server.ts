import "server-only"

import { adminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Contractor, ContractorCategory } from "./contractors"
import { CONTRACTOR_CATEGORIES } from "./contractors"

type ContractorRow = {
  id: string
  company_name: string
  category: string | null
  contact_name: string
  phone: string
  email: string
  website: string | null
  address: string | null
  notes: string | null
  active: boolean | null
}

const SELECT_COLUMNS =
  "id, company_name, category, contact_name, phone, email, website, address, notes, active"

function normalizeRow(row: ContractorRow): Contractor {
  const category = (
    CONTRACTOR_CATEGORIES.includes(row.category as ContractorCategory)
      ? row.category
      : "Other"
  ) as ContractorCategory

  return {
    id: row.id,
    company_name: row.company_name,
    category,
    contact_name: row.contact_name,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    notes: row.notes,
    active: row.active ?? true,
  }
}

/** Fetch all non-deleted contractors (active + inactive). Used by the admin directory. */
export async function fetchContractors(): Promise<Contractor[]> {
  const { data, error } = await adminClient
    .from("contractors")
    .select(SELECT_COLUMNS)
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("company_name", { ascending: true })

  if (error) {
    console.error("fetchContractors failed:", error)
    return []
  }

  return (data ?? []).map(normalizeRow)
}

/**
 * Fetch active contractors through the RLS-scoped client. Used by the client
 * portal directory — the contractors_authenticated_select policy grants any
 * signed-in user read access.
 */
export async function fetchActiveContractors(): Promise<Contractor[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("contractors")
    .select(SELECT_COLUMNS)
    .eq("active", true)
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("company_name", { ascending: true })

  if (error) {
    console.error("fetchActiveContractors failed:", error)
    throw new Error("Could not load the contractor directory")
  }

  return (data ?? []).map(normalizeRow)
}
