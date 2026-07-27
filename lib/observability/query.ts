import "server-only"

import { adminClient } from "@/lib/supabase/admin"

/**
 * Read side of `app_error_log` for the admin diagnostics page.
 *
 * Queries run through the service-role client for the same reason the rest of
 * the dashboard does — these are aggregates across every org, and the row-level
 * policy is an admin-only gate rather than a filter. Every caller sits behind
 * `requireAdmin()`.
 */

export interface AppErrorRecord {
  id: string
  occurred_at: string
  severity: string
  source: string
  area: string
  message: string
  error_name: string | null
  stack: string | null
  digest: string | null
  route_path: string | null
  request_path: string | null
  request_method: string | null
  request_id: string | null
  actor_type: string | null
  actor_id: string | null
  client_id: string | null
  release: string | null
  environment: string
  fingerprint: string
  context: Record<string, unknown>
  resolved: boolean
}

/**
 * A fault, not an occurrence: every row sharing a fingerprint collapses into
 * one entry carrying the newest example plus how often and how recently it has
 * happened. Without this, one loop drowns the page and hides everything else.
 */
export interface AppErrorGroup {
  fingerprint: string
  count: number
  firstSeen: string
  lastSeen: string
  unresolvedCount: number
  latest: AppErrorRecord
  affectedClients: number
}

export interface AppErrorFilters {
  severity?: string
  source?: string
  area?: string
  /** Hide anything already triaged. */
  unresolvedOnly?: boolean
  /** ISO timestamp lower bound. */
  since?: string
  search?: string
}

const SELECT_COLUMNS =
  "id, occurred_at, severity, source, area, message, error_name, stack, digest, route_path, request_path, request_method, request_id, actor_type, actor_id, client_id, release, environment, fingerprint, context, resolved"

/**
 * Fetches recent rows and groups them in application code.
 *
 * Deliberately not a database aggregate: at Merlin's volumes (a handful of
 * errors a day, capped by retention) the round trip is trivial, and keeping the
 * grouping here means adding a facet to the UI never needs a migration.
 */
export async function getAppErrorGroups(
  filters: AppErrorFilters = {},
  rowLimit = 500
): Promise<{ groups: AppErrorGroup[]; totalRows: number; degraded: boolean }> {
  let query = adminClient
    .from("app_error_log")
    .select(SELECT_COLUMNS)
    .order("occurred_at", { ascending: false })
    .limit(rowLimit)

  if (filters.severity) query = query.eq("severity", filters.severity)
  if (filters.source) query = query.eq("source", filters.source)
  if (filters.area) query = query.like("area", `${filters.area}%`)
  if (filters.unresolvedOnly) query = query.eq("resolved", false)
  if (filters.since) query = query.gte("occurred_at", filters.since)
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, " ").trim()
    if (term) query = query.or(`message.ilike.%${term}%,area.ilike.%${term}%,route_path.ilike.%${term}%`)
  }

  const { data, error } = await query

  if (error) {
    // The error log failing to load is itself worth a log line, but must not
    // recurse into logAppError — a broken table would loop.
    console.error(`[app-error] read failed: ${error.message}`)
    return { groups: [], totalRows: 0, degraded: true }
  }

  const rows = (data ?? []) as unknown as AppErrorRecord[]
  const byFingerprint = new Map<string, AppErrorGroup>()
  const clientsByFingerprint = new Map<string, Set<string>>()

  for (const row of rows) {
    const existing = byFingerprint.get(row.fingerprint)
    const clients = clientsByFingerprint.get(row.fingerprint) ?? new Set<string>()
    if (row.client_id) clients.add(row.client_id)
    clientsByFingerprint.set(row.fingerprint, clients)

    if (!existing) {
      byFingerprint.set(row.fingerprint, {
        fingerprint: row.fingerprint,
        count: 1,
        firstSeen: row.occurred_at,
        lastSeen: row.occurred_at,
        unresolvedCount: row.resolved ? 0 : 1,
        // Rows arrive newest-first, so the first one seen is the latest.
        latest: row,
        affectedClients: clients.size,
      })
      continue
    }

    existing.count += 1
    existing.unresolvedCount += row.resolved ? 0 : 1
    if (row.occurred_at < existing.firstSeen) existing.firstSeen = row.occurred_at
    if (row.occurred_at > existing.lastSeen) {
      existing.lastSeen = row.occurred_at
      existing.latest = row
    }
    existing.affectedClients = clients.size
  }

  const groups = Array.from(byFingerprint.values()).sort((a, b) =>
    b.lastSeen.localeCompare(a.lastSeen)
  )

  return { groups, totalRows: rows.length, degraded: false }
}

/** Every occurrence of one fault, newest first, for the detail view. */
export async function getAppErrorOccurrences(
  fingerprint: string,
  limit = 50
): Promise<AppErrorRecord[]> {
  const { data, error } = await adminClient
    .from("app_error_log")
    .select(SELECT_COLUMNS)
    .eq("fingerprint", fingerprint)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`[app-error] occurrence read failed: ${error.message}`)
    return []
  }
  return (data ?? []) as unknown as AppErrorRecord[]
}

export interface AppErrorSummary {
  last24h: number
  last7d: number
  unresolved: number
  distinctFaults: number
  browserShare: number
}

/** Headline counts for the diagnostics page and the admin dashboard tile. */
export async function getAppErrorSummary(): Promise<AppErrorSummary> {
  const now = Date.now()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await adminClient
    .from("app_error_log")
    .select("occurred_at, resolved, fingerprint, source")
    .gte("occurred_at", weekAgo)
    .order("occurred_at", { ascending: false })
    .limit(2000)

  if (error) {
    console.error(`[app-error] summary read failed: ${error.message}`)
    return { last24h: 0, last7d: 0, unresolved: 0, distinctFaults: 0, browserShare: 0 }
  }

  const rows = (data ?? []) as { occurred_at: string; resolved: boolean; fingerprint: string; source: string }[]
  const fingerprints = new Set(rows.map((r) => r.fingerprint))
  const browser = rows.filter((r) => r.source === "browser").length

  return {
    last24h: rows.filter((r) => r.occurred_at >= dayAgo).length,
    last7d: rows.length,
    unresolved: rows.filter((r) => !r.resolved).length,
    distinctFaults: fingerprints.size,
    browserShare: rows.length ? Math.round((browser / rows.length) * 100) : 0,
  }
}
