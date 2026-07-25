import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const actions = readFileSync("app/admin/proposals/actions.ts", "utf8")
const clientActions = readFileSync("app/client/proposals/actions.ts", "utf8")
const migration = readFileSync(
  "supabase/migrations/033_sent_proposal_immutability.sql",
  "utf8"
)

describe("proposal signing evidence immutability", () => {
  it("allows PDF regeneration and deletion only while a proposal is Draft", () => {
    expect(actions).toMatch(
      /function regenerateProposalPdf[\s\S]*proposal\.status !== "Draft"/
    )
    expect(actions).toMatch(
      /function deleteProposal[\s\S]*row\.status !== "Draft"/
    )
  })

  it("does not replace the sent document hash when the client rotates a link", () => {
    expect(clientActions).toMatch(
      /proposal\.signing_document_hash \?\?[\s\S]*hashDocument/
    )
  })

  it("freezes the PDF and commercial terms in the database after send", () => {
    expect(migration).toMatch(
      /old\.status in \('Sent', 'Signed', 'Contract Issued'\)/i
    )
    for (const column of [
      "client_id",
      "services_json",
      "total_price",
      "proposal_pdf_path",
      "signing_document_hash",
    ]) {
      expect(migration).toContain(column)
    }
    expect(migration).toMatch(/before update on public\.proposals/i)
  })
})
