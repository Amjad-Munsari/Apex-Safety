/**
 * Shared services catalog. Demo-only client-side store.
 *
 * Swap-out plan for Supabase: keep the function signatures
 * (`getServices`, `addService`, `updateService`, `deleteService`,
 * `setServiceActive`) and replace the in-memory implementation with
 * `adminClient.from("services")` queries. Components consume via the
 * `useServices()` hook so the migration only touches this file.
 */

import { useEffect, useState } from "react"

export type ServiceCategory =
  | "Fire Risk Assessments"
  | "Testing & Retainer"
  | "Training Courses"

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "Fire Risk Assessments",
  "Testing & Retainer",
  "Training Courses",
]

export type Service = {
  id: string
  name: string
  description: string | null
  category: ServiceCategory
  unit_price: number
  unit: string
  active: boolean
}

const SEED: Service[] = [
  // ── Fire Risk Assessments ─────────────────────────────────────────────────
  {
    id: "fra-type-1",
    name: "Fire Risk Assessment (Type 1)",
    description: "Non-destructive inspection of common parts. Suitable for low-risk premises.",
    category: "Fire Risk Assessments",
    unit_price: 480,
    unit: "each",
    active: true,
  },
  {
    id: "fra-type-3",
    name: "Fire Risk Assessment (Type 3)",
    description: "Non-destructive inspection of common parts plus a sample of dwellings or rooms.",
    category: "Fire Risk Assessments",
    unit_price: 620,
    unit: "each",
    active: true,
  },
  {
    id: "fra-type-4",
    name: "Fire Risk Assessment (Type 4)",
    description: "Destructive inspection — opens up structure where required. PAS 79 / BS 9997 aligned.",
    category: "Fire Risk Assessments",
    unit_price: 980,
    unit: "each",
    active: true,
  },
  {
    id: "site-risk-assessment",
    name: "Site Risk Assessment",
    description: "Whole-site H&S risk assessment covering operations, contractors, and access.",
    category: "Fire Risk Assessments",
    unit_price: 540,
    unit: "each",
    active: true,
  },

  // ── Testing & Retainer ────────────────────────────────────────────────────
  {
    id: "retainer-5h",
    name: "Consulting Retainer — 5 hours",
    description: "Block of 5 advisory hours, valid 12 months. Use for ad-hoc queries and mini-audits.",
    category: "Testing & Retainer",
    unit_price: 425,
    unit: "block",
    active: true,
  },
  {
    id: "retainer-10h",
    name: "Consulting Retainer — 10 hours",
    description: "Block of 10 advisory hours, valid 12 months. Best for quarterly check-ins.",
    category: "Testing & Retainer",
    unit_price: 800,
    unit: "block",
    active: true,
  },
  {
    id: "retainer-20h",
    name: "Consulting Retainer — 20 hours",
    description: "Block of 20 advisory hours, valid 12 months. Embedded compliance support.",
    category: "Testing & Retainer",
    unit_price: 1500,
    unit: "block",
    active: true,
  },
  {
    id: "pat-testing",
    name: "PAT Testing",
    description: "Portable Appliance Testing — labelled, logged, and certificated per item.",
    category: "Testing & Retainer",
    unit_price: 2.5,
    unit: "appliance",
    active: true,
  },
  {
    id: "dse-assessment",
    name: "DSE Assessment",
    description: "Display Screen Equipment workstation assessment per individual user.",
    category: "Testing & Retainer",
    unit_price: 35,
    unit: "user",
    active: true,
  },

  // ── Training Courses ──────────────────────────────────────────────────────
  {
    id: "basic-fire-awareness",
    name: "Basic Fire Awareness",
    description: "Half-day classroom session covering fire causes, prevention, and evacuation.",
    category: "Training Courses",
    unit_price: 360,
    unit: "course",
    active: true,
  },
  {
    id: "emergency-first-aid",
    name: "Emergency First Aid at Work",
    description: "1-day HSE-aligned EFAW course. Up to 12 delegates.",
    category: "Training Courses",
    unit_price: 680,
    unit: "course",
    active: true,
  },
  {
    id: "fire-marshal",
    name: "Fire Marshal Training",
    description: "Full-day Fire Marshal certification with practical extinguisher session.",
    category: "Training Courses",
    unit_price: 820,
    unit: "course",
    active: true,
  },
  {
    id: "fire-warden",
    name: "Fire Warden Training",
    description: "Half-day Fire Warden / sweep duties course. Up to 10 delegates.",
    category: "Training Courses",
    unit_price: 540,
    unit: "course",
    active: true,
  },
  {
    id: "first-aid-3-day",
    name: "First Aid at Work (3-day)",
    description: "3-day HSE-aligned FAW certification, valid 3 years. Up to 12 delegates.",
    category: "Training Courses",
    unit_price: 1650,
    unit: "course",
    active: true,
  },
  {
    id: "manual-handling",
    name: "Manual Handling",
    description: "Half-day practical manual handling course. Tailored to workplace tasks.",
    category: "Training Courses",
    unit_price: 420,
    unit: "course",
    active: true,
  },
]

// ─── In-memory store with pub/sub so multiple consumers stay in sync ─────────

let _services: Service[] = SEED.map(s => ({ ...s }))
const _listeners = new Set<() => void>()

function _notify() {
  _listeners.forEach(fn => fn())
}

function _slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function _uniqueId(base: string): string {
  let id = base || `svc-${Date.now()}`
  let n = 2
  while (_services.some(s => s.id === id)) {
    id = `${base}-${n++}`
  }
  return id
}

export type ServiceInput = {
  name: string
  description?: string | null
  category: ServiceCategory
  unit_price: number
  unit?: string
  active?: boolean
}

export function getServices(): Service[] {
  return _services.map(s => ({ ...s }))
}

export function getActiveServices(): Service[] {
  return _services.filter(s => s.active).map(s => ({ ...s }))
}

export function addService(input: ServiceInput): Service {
  const created: Service = {
    id: _uniqueId(_slugify(input.name)),
    name: input.name,
    description: input.description ?? null,
    category: input.category,
    unit_price: input.unit_price,
    unit: input.unit?.trim() || "each",
    active: input.active ?? true,
  }
  _services = [..._services, created]
  _notify()
  return created
}

export function updateService(id: string, patch: Partial<ServiceInput>): Service | null {
  const idx = _services.findIndex(s => s.id === id)
  if (idx === -1) return null
  const current = _services[idx]
  const next: Service = {
    ...current,
    name: patch.name ?? current.name,
    description: patch.description !== undefined ? patch.description : current.description,
    category: patch.category ?? current.category,
    unit_price: patch.unit_price ?? current.unit_price,
    unit: patch.unit?.trim() || current.unit,
    active: patch.active ?? current.active,
  }
  _services = [..._services.slice(0, idx), next, ..._services.slice(idx + 1)]
  _notify()
  return next
}

export function setServiceActive(id: string, active: boolean): void {
  updateService(id, { active })
}

export function deleteService(id: string): boolean {
  const before = _services.length
  _services = _services.filter(s => s.id !== id)
  if (_services.length === before) return false
  _notify()
  return true
}

export function subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

/** React hook — returns the live services snapshot and re-renders on mutation. */
export function useServices(): Service[] {
  const [snapshot, setSnapshot] = useState<Service[]>(() => getServices())
  useEffect(() => {
    return subscribe(() => setSnapshot(getServices()))
  }, [])
  return snapshot
}

/** Group services by category, in canonical order, omitting empty categories. */
export function groupByCategory(services: Service[]): Array<{ title: ServiceCategory; services: Service[] }> {
  return SERVICE_CATEGORIES
    .map(title => ({ title, services: services.filter(s => s.category === title) }))
    .filter(group => group.services.length > 0)
}
