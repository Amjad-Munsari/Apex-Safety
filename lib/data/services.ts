/**
 * Service catalog — shared types and pure helpers.
 *
 * Data is read from Supabase by server components / server actions:
 *   - `lib/data/services-server.ts` — server-only fetchers
 *   - `app/admin/services/actions.ts` — server-only mutations
 *
 * This file is safe to import from both client and server code: it has no
 * runtime state and no Supabase imports.
 */

export type ServiceCategory = "Monthly Packages" | "Training courses" | "Services"

// Three categories matching prod:
//   - Monthly Packages: ongoing retainer tiers (priced per month)
//   - Training courses: priced per delegate
//   - Services: assessments / consultancy / testing — most quote-on-request
// If Matt adds new categories via /admin/services, extend this union.
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "Monthly Packages",
  "Training courses",
  "Services",
]

export type Service = {
  id: string
  name: string
  description: string | null
  category: ServiceCategory
  /** `null` = quote on request. Admin enters the price per-proposal. */
  unit_price: number | null
  unit: string
  active: boolean
}

export type ServiceInput = {
  name: string
  description?: string | null
  category: ServiceCategory
  unit_price: number | null
  unit?: string
  active?: boolean
}

/** Group services by category, in canonical order, omitting empty categories. */
export function groupByCategory(
  services: Service[]
): Array<{ title: ServiceCategory; services: Service[] }> {
  return SERVICE_CATEGORIES
    .map(title => ({ title, services: services.filter(s => s.category === title) }))
    .filter(group => group.services.length > 0)
}
