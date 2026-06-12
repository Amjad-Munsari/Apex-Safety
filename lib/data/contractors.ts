/**
 * Contractor directory — shared types and pure helpers.
 *
 * Data is read from Supabase by server components / server actions:
 *   - `lib/data/contractors-server.ts` — server-only fetchers
 *   - `app/admin/directory/actions.ts` — server-only mutations
 *
 * This file is safe to import from both client and server code: it has no
 * runtime state and no Supabase imports.
 */

export type ContractorCategory =
  | "Fire Alarms & Detection"
  | "Fire Extinguishers"
  | "Emergency Lighting"
  | "Fire Doors & Passive Protection"
  | "Sprinklers & Suppression"
  | "Electrical"
  | "Security & Access"
  | "General Maintenance"
  | "Other"

// Trades Matt's clients typically need remedial work from after an
// assessment. If Matt needs new categories via /admin/directory, extend
// this union — unknown values read back from the DB normalize to "Other".
export const CONTRACTOR_CATEGORIES: ContractorCategory[] = [
  "Fire Alarms & Detection",
  "Fire Extinguishers",
  "Emergency Lighting",
  "Fire Doors & Passive Protection",
  "Sprinklers & Suppression",
  "Electrical",
  "Security & Access",
  "General Maintenance",
  "Other",
]

export type Contractor = {
  id: string
  company_name: string
  category: ContractorCategory
  contact_name: string
  phone: string
  email: string
  website: string | null
  address: string | null
  notes: string | null
  /** Inactive contractors stay in the admin list but are hidden from clients. */
  active: boolean
}

export type ContractorInput = {
  company_name: string
  category: ContractorCategory
  contact_name: string
  phone: string
  email: string
  website?: string | null
  address?: string | null
  notes?: string | null
  active?: boolean
}

/** Group contractors by category, in canonical order, omitting empty categories. */
export function groupByCategory(
  contractors: Contractor[]
): Array<{ title: ContractorCategory; contractors: Contractor[] }> {
  return CONTRACTOR_CATEGORIES
    .map(title => ({ title, contractors: contractors.filter(c => c.category === title) }))
    .filter(group => group.contractors.length > 0)
}
