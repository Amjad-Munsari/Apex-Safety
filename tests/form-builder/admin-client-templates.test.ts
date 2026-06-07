// Unit tests for normalizeClientTemplateRows — the mapping behind the
// "Client-built forms" read-only panel on the admin client-detail page (spec 2.6).
//
// The risk this guards: Supabase returns the self-referential parent embed
// (parent:form_templates!parent_template_id(name)) as an ARRAY or an OBJECT
// depending on relationship inference. The normalizer must flatten both without
// throwing, and correctly distinguish forked vs built-from-scratch templates.

import { describe, it, expect } from "vitest"
import { normalizeClientTemplateRows } from "@/app/admin/clients/[id]/client-templates"

describe("normalizeClientTemplateRows", () => {
  it("returns [] for null/undefined/empty input", () => {
    expect(normalizeClientTemplateRows(null)).toEqual([])
    expect(normalizeClientTemplateRows(undefined)).toEqual([])
    expect(normalizeClientTemplateRows([])).toEqual([])
  })

  it("flattens an OBJECT-shaped parent join and reports fork lineage", () => {
    const out = normalizeClientTemplateRows([
      {
        id: "fork-1",
        name: "Our FRA",
        template_type: "fra",
        is_published: true,
        created_at: "2026-06-01T00:00:00.000Z",
        parent_template_id: "master-9",
        parent: { name: "FRA Type 3 (master)" },
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: "fork-1",
      parent_template_id: "master-9",
      parentName: "FRA Type 3 (master)",
      is_published: true,
    })
  })

  it("flattens an ARRAY-shaped parent join (Supabase relationship-inference variant)", () => {
    const out = normalizeClientTemplateRows([
      {
        id: "fork-2",
        name: "Cloned form",
        template_type: "site_risk",
        is_published: false,
        created_at: "2026-06-02T00:00:00.000Z",
        parent_template_id: "master-7",
        parent: [{ name: "Site Risk (master)" }],
      },
    ])
    expect(out[0].parentName).toBe("Site Risk (master)")
    expect(out[0].is_published).toBe(false)
  })

  it("treats a template with no parent as built-from-scratch (null lineage)", () => {
    const out = normalizeClientTemplateRows([
      {
        id: "own-1",
        name: "Bespoke checklist",
        template_type: "custom",
        is_published: true,
        created_at: "2026-06-03T00:00:00.000Z",
        parent_template_id: null,
        parent: null,
      },
    ])
    expect(out[0].parent_template_id).toBeNull()
    expect(out[0].parentName).toBeNull()
  })

  it("does not throw when the parent embed is an empty array", () => {
    const out = normalizeClientTemplateRows([
      {
        id: "edge-1",
        name: "Edge",
        template_type: "fra",
        is_published: false,
        created_at: "2026-06-04T00:00:00.000Z",
        parent_template_id: "master-3",
        parent: [],
      },
    ])
    expect(out[0].parentName).toBeNull()
    expect(out[0].parent_template_id).toBe("master-3")
  })
})
