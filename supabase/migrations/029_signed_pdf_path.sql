-- ─────────────────────────────────────────────────────────────────────────────
-- 029_signed_pdf_path.sql
--
-- FIX for the e-signature evidence gap (pre-launch audit blocker 6, "repair
-- e-signature immutability and transactional evidence", found still live during
-- the 2026-07-25 hole-hunt).
--
-- What was wrong: proposal_signatures.document_hash records the SHA-256 of the
-- PDF as it existed when the proposal was SENT (captured by beginSigning via
-- hashDocument). After a successful signature, /api/sign/[token] re-uploaded the
-- signature-stamped PDF to the SAME storage key with `upsert: true` — destroying
-- the exact bytes the hash attests to. No copy of the original survived, so
-- re-hashing the stored file could never match the recorded hash, and a mismatch
-- could not distinguish "stamped as designed" from "someone swapped the
-- document". The stored hash was therefore unusable as evidence, which is the
-- whole reason it exists. Worse, the stamping step is best-effort inside a
-- try/catch, so whether the file matched its hash depended on whether an
-- unlogged step happened to succeed.
--
-- The fix: the stamped PDF goes to its OWN key, recorded here, and
-- proposals.proposal_pdf_path becomes immutable once signing has begun. The
-- attested original is preserved, so document_hash can actually be verified
-- against it, and the stamped copy is what surfaces to readers.
--
--   signed_pdf_path       — storage key of the signature-stamped PDF. NULL until
--                           a signature completes (and stays NULL if the
--                           best-effort stamp fails, in which case readers fall
--                           back to the original — see the `?? proposal_pdf_path`
--                           reads in the proposal surfaces).
--   signed_document_hash  — SHA-256 of the stamped bytes, so the delivered
--                           artefact is independently verifiable too. The
--                           pre-stamp hash stays in proposal_signatures.
--
-- Both nullable and additive: existing rows are untouched and no backfill is
-- possible or wanted (for any proposal already signed under the old code the
-- original bytes are gone, so there is nothing truthful to record — those rows
-- keep signed_pdf_path NULL and their document_hash stays unverifiable).
--
-- Idempotent: IF NOT EXISTS on both columns. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.proposals
  add column if not exists signed_pdf_path text,
  add column if not exists signed_document_hash text;

comment on column public.proposals.signed_pdf_path is
  'Storage key of the signature-stamped PDF. NULL until a signature completes. proposal_pdf_path holds the immutable pre-signature original that proposal_signatures.document_hash attests to — never overwrite it.';

comment on column public.proposals.signed_document_hash is
  'SHA-256 of the stamped PDF bytes at signed_pdf_path. The pre-stamp hash lives in proposal_signatures.document_hash.';
