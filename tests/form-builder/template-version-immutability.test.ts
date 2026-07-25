import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  "supabase/migrations/031_template_version_immutability.sql",
  "utf8"
)

describe("template version immutability migration", () => {
  it("removes signed-in UPDATE access while preserving append-only admin access", () => {
    expect(migration).toMatch(
      /drop policy if exists "template_versions_client_own_update"/i
    )
    expect(migration).not.toMatch(
      /create policy "template_versions_client_own_update"/i
    )
    expect(migration).toMatch(
      /create policy "template_versions_admin_insert"[\s\S]*for insert/i
    )
    expect(migration).toMatch(
      /create policy "template_versions_admin_select"[\s\S]*for select/i
    )
  })

  it("blocks updates to published or referenced versions", () => {
    expect(migration).toMatch(/old\.published_at is not null/i)
    expect(migration).toMatch(/public\.form_assignments/i)
    expect(migration).toMatch(/public\.form_submissions/i)
    expect(migration).toMatch(/before update on public\.template_versions/i)
  })

  it("removes signed-in hard-delete access to template parents", () => {
    expect(migration).toMatch(
      /drop policy if exists "form_templates_admin_all"/i
    )
    expect(migration).toMatch(
      /drop policy if exists "form_templates_client_own_delete"/i
    )
    expect(migration).not.toMatch(
      /create policy "form_templates_client_own_delete"/i
    )
    expect(migration).toMatch(
      /create policy "form_templates_admin_update"[\s\S]*owner_type = 'admin'/i
    )
  })
})
