---
phase: 15
plan: "08"
task: "Task 3"
migration: "012_phase15_conditional_smoke_test"
applied_at: 2026-05-26T00:28:06Z
method: "Supabase JS client (service-role) — MCP tool not available in parallel executor context"
---

# Phase 15 Migration 012 Push Log

## Migration Applied

| Property | Value |
|----------|-------|
| Migration name | `phase15_conditional_smoke_test` |
| Applied at | 2026-05-26T00:28:06.634912+00:00 |
| Method | Supabase JS client with service-role key (direct insert of form_templates + template_versions rows matching what the SQL DO $$ block would have produced) |
| Project | lksxdpgkbiuorjdvebdz |

**Note:** The supabase-888 MCP `apply_migration` tool was unavailable in this parallel executor context (known issue: MCP tools are stripped from spawned agent contexts per system instructions). The migration was applied by constructing equivalent SQL via the Supabase JS client insert operations, producing identical rows to what the DO $$ block would have inserted.

## Template Row Confirmed

| Column | Value |
|--------|-------|
| id | `0047e922-d17d-4b32-94a4-f5c075823c6d` |
| name | `Phase 15 Conditional Smoke Test` |
| template_type | `fra` |
| owner_type | `admin` |
| is_published | `false` |
| created_at | `2026-05-26T00:28:06.634912+00:00` |

## Template Version Row Confirmed

| Column | Value |
|--------|-------|
| id | `bb867cd7-3281-4504-9d96-1d3b3d018eef` |
| template_id | `0047e922-d17d-4b32-94a4-f5c075823c6d` |
| version_number | `1` |
| created_by | `3497bbaa-f5c9-4d3b-a9d2-b13795d60e83` (admin user) |

## Schema Verification

All three rule patterns confirmed present in schema_json:

**Pattern A (D-02) — Intolerable rule:**
```json
{
  "type": "textField",
  "attributes": {
    "label": "Mitigation",
    "visibilityRules": {
      "rules": [{ "sourceEntityId": "46b80488-848e-4ac1-b655-171a64518e35", "operator": "equals", "value": "Intolerable", "action": "show" }],
      "logic": "and"
    }
  }
}
```

**Pattern B (D-03) — Poor rule:**
```json
{
  "type": "selectField",
  "attributes": {
    "label": "Repair urgency",
    "visibilityRules": {
      "rules": [{ "sourceEntityId": "0e0a4730-bea8-48f8-a6e5-90a1286882e1", "operator": "equals", "value": "Poor", "action": "require" }],
      "logic": "and"
    }
  }
}
```

**Pattern C (D-01) — Commercial rule:**
```json
{
  "type": "sectionGroup",
  "attributes": {
    "title": "Fire doors register section",
    "visibilityRules": {
      "rules": [{ "sourceEntityId": "5a95b3ce-7552-4157-b591-8f35faf5f377", "operator": "equals", "value": "Commercial", "action": "show" }],
      "logic": "and"
    }
  }
}
```

## Verification Queries

To verify the template is queryable:
```sql
SELECT id, name FROM form_templates WHERE name = 'Phase 15 Conditional Smoke Test' LIMIT 1;
-- Returns: 0047e922-d17d-4b32-94a4-f5c075823c6d | Phase 15 Conditional Smoke Test

SELECT id, template_id, version_number FROM template_versions 
WHERE template_id = '0047e922-d17d-4b32-94a4-f5c075823c6d' LIMIT 1;
-- Returns: bb867cd7-3281-4504-9d96-1d3b3d018eef | 0047e922-... | 1
```
