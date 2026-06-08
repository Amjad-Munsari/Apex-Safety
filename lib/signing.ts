import "server-only"

import { createHash, randomBytes } from "crypto"

import { adminClient } from "@/lib/supabase/admin"

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * The subset of a `proposals` row required by the signing page.
 * The HASH of the signing token is stored in `proposals.signing_token`;
 * this record is returned when that hash matches and the token is still valid.
 *
 * Route-layer note:
 *   - null because row not found  → 404
 *   - null because `signing_token_used`  → 409
 *   - null because `signing_token_expires_at` past → 410
 * Callers are responsible for distinguishing these cases; this function
 * returns a usable record or null (keep it simple).
 */
export interface ProposalSigningRecord {
  id: string
  client_id: string
  services_json: Record<string, unknown>
  proposal_pdf_path: string
  status: string
  signing_token_expires_at: string
  signing_token_used: boolean
  signing_document_hash: string | null
}

// ── Pure crypto helpers ──────────────────────────────────────────────────────

/**
 * Generate a fresh signing token pair.
 *
 * - `raw`  – 256-bit URL-safe base64 string. Goes in the email link.
 * - `hash` – SHA-256 hex digest of `raw`. Stored in `proposals.signing_token`.
 */
export function generateSigningToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url")
  const hash = createHash("sha256").update(raw).digest("hex")
  return { raw, hash }
}

/**
 * Recompute the stored hash from a raw token.
 * Callers use this to look up or verify a token received from a URL.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

// ── Database helpers ─────────────────────────────────────────────────────────

/**
 * Validate a raw signing token against the `proposals` table.
 *
 * Returns `null` when:
 *   - No row found for the computed hash
 *   - `signing_token_used` is `true`
 *   - `signing_token_expires_at` is at or before the current time
 *
 * Otherwise returns the {@link ProposalSigningRecord} for use by the signing page.
 *
 * JSDoc note: the route layer maps null to 410 (expired) or 409 (used) as appropriate.
 */
export async function validateSigningToken(
  raw: string
): Promise<ProposalSigningRecord | null> {
  const hash = hashToken(raw)

  const { data, error } = await adminClient
    .from("proposals")
    .select(
      "id, client_id, services_json, proposal_pdf_path, status, signing_token_expires_at, signing_token_used, signing_document_hash"
    )
    .eq("signing_token", hash)
    .maybeSingle()

  if (error || data === null) return null

  const row = data as ProposalSigningRecord

  if (row.signing_token_used) return null

  if (new Date(row.signing_token_expires_at) <= new Date()) return null

  return row
}

// ── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Download a PDF from Supabase Storage and return its SHA-256 hex digest.
 *
 * @param pdfPath - Storage object path within the `proposals` bucket.
 * @throws {Error} If the download fails (e.g. object not found, permission denied).
 */
export async function hashDocument(pdfPath: string): Promise<string> {
  const { data, error } = await adminClient.storage
    .from("proposals")
    .download(pdfPath)

  if (error !== null || data === null) {
    throw new Error(
      `hashDocument: download failed for "${pdfPath}": ${error?.message ?? "no data returned"}`
    )
  }

  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return createHash("sha256").update(buffer).digest("hex")
}
