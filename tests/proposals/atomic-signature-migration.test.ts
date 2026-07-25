import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  "supabase/migrations/032_atomic_proposal_signature_redemption.sql",
  "utf8"
)

describe("atomic proposal signature redemption", () => {
  it("commits lifecycle, artefact path, and evidence in one function", () => {
    expect(migration).toMatch(/update public\.proposals/i)
    expect(migration).toMatch(/signing_token_used = true/i)
    expect(migration).toMatch(/signed_pdf_path = p_signed_pdf_path/i)
    expect(migration).toMatch(/insert into public\.proposal_signatures/i)
    expect(migration).toMatch(/p\.signing_document_hash = p_expected_document_hash/i)
    expect(migration).toMatch(/p\.proposal_pdf_path = p_expected_pdf_path/i)
  })

  it("is callable only by the service role", () => {
    expect(migration).toMatch(/security definer/i)
    expect(migration).toMatch(/set search_path = ''/i)
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/i)
  })
})
