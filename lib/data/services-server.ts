import "server-only"

import { adminClient } from "@/lib/supabase/admin"
import type { Service, ServiceCategory } from "./services"
import { SERVICE_CATEGORIES } from "./services"

type ServiceRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  unit_price: number | string | null
  unit: string | null
  active: boolean | null
}

function normalizeRow(row: ServiceRow): Service {
  const category = (
    SERVICE_CATEGORIES.includes(row.category as ServiceCategory)
      ? row.category
      : "Services"
  ) as ServiceCategory

  // Preserve null — quote-on-request services don't have a unit price in
  // the catalog; the proposal builder asks the admin to enter one per quote.
  let unit_price: number | null
  if (row.unit_price === null || row.unit_price === undefined) {
    unit_price = null
  } else if (typeof row.unit_price === "string") {
    const parsed = Number(row.unit_price)
    unit_price = Number.isFinite(parsed) ? parsed : null
  } else {
    unit_price = row.unit_price
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category,
    unit_price,
    unit: row.unit ?? "each",
    active: row.active ?? true,
  }
}

/** Fetch all non-deleted services (active + inactive). Used by the admin catalog. */
export async function fetchServices(): Promise<Service[]> {
  const { data, error } = await adminClient
    .from("services")
    .select("id, name, description, category, unit_price, unit, active")
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("fetchServices failed:", error)
    return []
  }

  return (data ?? []).map(normalizeRow)
}

/** Fetch only active services. Used by the proposal builder. */
export async function fetchActiveServices(): Promise<Service[]> {
  return (await fetchServices()).filter(s => s.active)
}
