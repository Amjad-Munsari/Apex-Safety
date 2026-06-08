-- 020_proposal_signing.sql
-- First-party e-signature support for proposals.
-- Captures a drawn signature, signer identity, IP, and a PDF document hash at
-- signing time so we have a tamper-evident audit trail without a third-party
-- signing provider.
--
-- RLS RATIONALE (service-role-only write model):
--   All writes to proposal_signatures and all updates to the signing columns on
--   proposals flow through Next.js server routes using the service-role
--   adminClient. That client bypasses RLS entirely, so we grant NO INSERT or
--   UPDATE policies to anon or authenticated. The public signing page never
--   calls Supabase directly — it only calls the Next.js API, which validates
--   the one-time token and performs the write server-side. This prevents an
--   attacker who obtains the anon key from forging signatures.

-- ─────────────────────────────────────────────────────────────
-- TABLE: proposal_signatures
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposal_signatures (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id      UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  signer_name      TEXT        NOT NULL,
  signer_email     TEXT        NOT NULL,
  -- Full base64 PNG data URL ("data:image/png;base64,...") captured from the
  -- signature pad. Stored verbatim so it can be embedded in the sealed PDF.
  signature_image  TEXT        NOT NULL,
  -- Client IP collected by the Next.js server route (x-forwarded-for / socket).
  ip_address       INET        NOT NULL,
  user_agent       TEXT,
  -- SHA-256 hex of the proposal PDF byte-content at the moment the signing
  -- link was redeemed. Lets us prove the signer saw exactly this document.
  document_hash    TEXT        NOT NULL,
  signed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_signatures_proposal_id
  ON proposal_signatures(proposal_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: proposal_signatures
-- ─────────────────────────────────────────────────────────────

ALTER TABLE proposal_signatures ENABLE ROW LEVEL SECURITY;

-- Explicitly deny all access for the anon role. The service-role key bypasses
-- RLS on its own, so this only affects unauthenticated Supabase JS clients.
REVOKE ALL ON proposal_signatures FROM anon;

-- Admins (authenticated, app_metadata.role = 'admin') can read signatures for
-- audit and PDF-sealing purposes. Mirrors the pattern used for proposals and
-- services in 001_initial_schema.sql.
DROP POLICY IF EXISTS "proposal_signatures_admin_select" ON proposal_signatures;
CREATE POLICY "proposal_signatures_admin_select" ON proposal_signatures
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- No INSERT / UPDATE / DELETE policies for any role — all mutations go through
-- the service-role adminClient in server routes (see RLS RATIONALE above).

-- ─────────────────────────────────────────────────────────────
-- ALTER TABLE proposals — signing workflow columns
-- ─────────────────────────────────────────────────────────────

-- signing_token stores the SHA-256 HASH of the raw token, never the raw token
-- itself, so a DB breach cannot be used to replay a signing link.
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS signing_token              TEXT,
  ADD COLUMN IF NOT EXISTS signing_token_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_token_used         BOOLEAN NOT NULL DEFAULT FALSE,
  -- SHA-256 hex of the PDF captured when the signing link is dispatched.
  -- Compared against document_hash on proposal_signatures at redemption time.
  ADD COLUMN IF NOT EXISTS signing_document_hash      TEXT,
  ADD COLUMN IF NOT EXISTS signed_at                  TIMESTAMPTZ;

-- Partial unique index: enforces one active token per row while allowing
-- multiple historical NULL values (i.e. proposals that have never been sent
-- for signing, or that have had their token consumed and cleared).
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_signing_token_unique
  ON proposals(signing_token)
  WHERE signing_token IS NOT NULL;
