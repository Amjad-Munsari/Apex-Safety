// Pure path derivation for signing artefacts. Deliberately its own module:
// lib/signing.ts constructs the Supabase admin client at import time, so pulling
// a pure helper from there would drag a configured client into anything that
// only needs string math (including unit tests).

/**
 * Storage key for the signature-stamped copy of a proposal PDF.
 *
 * The stamped PDF must NEVER be written over the original: the original is what
 * proposal_signatures.document_hash attests to, and overwriting it made that
 * hash permanently unverifiable (see migration 029). Deriving a sibling key
 * keeps both artefacts, and keeps the mapping deterministic so a retry of the
 * same signature lands on the same object instead of littering the bucket.
 */
export function signedPdfPathFor(originalPath: string): string {
  return originalPath.toLowerCase().endsWith(".pdf")
    ? `${originalPath.slice(0, -".pdf".length)}-signed.pdf`
    : `${originalPath}-signed.pdf`
}
