// Unit tests for normalizeClientTemplateRows — the mapping behind the
// "Client-built forms" read-only panel on the admin client-detail page (spec 2.6).
//
// History: this used to flatten a PostgREST self-referential embed
// (parent:form_templates!parent_template_id(name)). Verified against the live
// DB: PostgREST resolves that embed in the CHILDREN direction, so `parent` was
// always [] and fork lineage never rendered. The normalizer now takes an
// explicit parent-id → name map built from a second query instead.

import { describe, it, expect } from "vitest"
import { normalizeClientTemplateRows } from "@/app/admin/clients/[id]/client-templates"

describe("normalizeClientTemplateRows", () => {
  it("returns [] for null/undefined/empty input", () => {
    expect(normalizeClientTemplateRows(null)).toEqual([])
    expect(normalizeClientTemplateRows(undefined)).toEqual([])
    expect(normalizeClientTemplateRows([])).toEqual([])
  })

  it("resolves fork lineage from the parentNames map", () => {
    const out = normalizeClientTemplateRows(
      [
        {
          id: "fork-1",
          name: "Our FRA",
          template_type: "fra",
          is_published: true,
          created_at: "2026-06-01T00:00:00.000Z",
          parent_template_id: "master-9",
        },
      ],
      { "master-9": "FRA Type 3 (master)" }
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: "fork-1",
      parent_template_id: "master-9",
      parentName: "FRA Type 3 (master)",
      is_published: true,
    })
  })

  it("treats a template with no parent as built-from-scratch (null lineage)", () => {
    const out = normalizeClientTemplateRows(
      [
        {
          id: "own-1",
          name: "Bespoke checklist",
          template_type: "custom",
          is_published: true,
          created_at: "2026-06-03T00:00:00.000Z",
          parent_template_id: null,
        },
      ],
      {}
    )
    expect(out[0].parent_template_id).toBeNull()
    expect(out[0].parentName).toBeNull()
  })

  it("keeps fork lineage id but null name when the parent is missing from the map (e.g. deleted master)", () => {
    const out = normalizeClientTemplateRows(
      [
        {
          id: "edge-1",
          name: "Edge",
          template_type: "fra",
          is_published: false,
          created_at: "2026-06-04T00:00:00.000Z",
          parent_template_id: "master-3",
        },
      ],
      {}
    )
    expect(out[0].parentName).toBeNull()
    expect(out[0].parent_template_id).toBe("master-3")
  })

  it("works without a parentNames map at all", () => {
    const out = normalizeClientTemplateRows([
      {
        id: "no-map",
        name: "No map",
        template_type: "custom",
        is_published: false,
        created_at: "2026-06-05T00:00:00.000Z",
        parent_template_id: "master-1",
      },
    ])
    expect(out[0].parentName).toBeNull()
  })
})
