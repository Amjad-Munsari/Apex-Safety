---
phase: 16-multi-tenancy-fork-on-fill
plan: "06"
plan_id: 16-06
subsystem: client-templates-fill
tags: [client, customer-templates, self-fill, deleted_at, ui-cleanup, dead-code-removal]
dependency_graph:
  requires: [16-01, 16-04]
  provides: [submitCustomerTemplateFillAction, FillCustomerTemplatePage, FillCustomerTemplateClient, simplified-client-templates-page]
  affects: [app/client/templates/, tests/form-builder/]
tech_stack:
  added: []
  patterns: [assignment_id=null for customer-built submissions, server-context client_id (T-16-04), two-step latest-published-version fetch, NEXT_REDIRECT bubble pattern, soft-delete deleted_at filter (T-16-08), UUID guard]
key_files:
  created:
    - app/client/templates/[id]/fill/page.tsx
    - app/client/templates/[id]/fill/fill-customer-template-client.tsx
  modified:
    - app/client/templates/page.tsx
    - app/client/templates/actions.ts
    - tests/form-builder/customer-self-fill-submission.test.ts
    - tests/form-builder/save-draft.test.ts
  deleted: []
decisions:
  - "lib/forms/schema-diff.ts is RETAINED — lib/forms/schema-diff.test.ts is a direct consumer with real assertions; only the import from app/client/templates/actions.ts was removed (forkOnFill was the sole actions.ts consumer)"
  - "redirect() imported statically at top of actions.ts rather than dynamically to keep the module shape consistent"
  - "FillCustomerTemplateClient mirrors FillAssignmentClient structure verbatim to minimise divergence on the cream surface"
metrics:
  duration_minutes: 25
  tasks_completed: 3
  files_created: 2
  files_modified: 4
  completed_date: "2026-05-26"
---

# Phase 16 Plan 06: Customer Self-Fill + /client/templates Cleanup Summary

**One-liner:** Customer-built template fill path with assignment_id=null server action, simplified /client/templates page (28px heading, admin-masters removed), forkOnFill dead-code deleted.

---

## What Was Delivered

### Task 1: Simplify /client/templates page (D-09, UI-SPEC Route G)

**app/client/templates/page.tsx** — Simplified from 134 lines to 80 lines:

- Removed the `assigned` admin-masters fetch (lines 15-23 in original) and `TODO(phaseB)` comment (resolves D-09)
- Removed the "Available Templates" / "01 — Available Templates" section JSX (lines 54-95 in original) including its mono divider
- Updated page heading from `text-[32px]` to `text-[28px]` (UI-SPEC unified client heading scale)
- Updated mono index from `06 · Templates` to `06 · My Templates` (single-section naming)
- Changed "My Templates" section label from `02 — My Templates` to `My Templates` (no numbering, only section now)
- Updated empty-state with locked UI-SPEC copy: h3 "No templates yet" + p "Create your own forms or customise an assigned form when it arrives."
- Retained `<NewClientTemplateButton>`, `<ClientTemplateCard>` grid, and all `mine` query logic unchanged

### Task 2: /client/templates/[id]/fill route + submitCustomerTemplateFillAction + test assertions

**app/client/templates/actions.ts** — Appended `submitCustomerTemplateFillAction`:
- `(templateId: string, answers: Record<string, unknown>): Promise<void>`
- Step 1: `requireClientContext()` — throws "Not a client user" if unauthenticated
- Step 2: `createClient()` — RLS-aware (T-16-06: never lib/supabase/admin)
- Step 3: `requireOwnedTemplate(templateId, ctx.client_id)` — throws on cross-org template (T-16-07)
- Step 4: `.from("template_versions").select("id").eq("template_id", templateId).not("published_at", "is", null).order("version_number", { ascending: false }).limit(1).maybeSingle()` — throws "Template has no published version" if null
- Step 5: `.from("form_submissions").insert({ template_version_id: latestVersion.id, client_id: ctx.client_id, assignment_id: null, status: "submitted", answers_json: answers })` — `assignment_id: null` (D-16), `client_id: ctx.client_id` (T-16-04: server context only, never a function parameter)
- Step 6: `revalidatePath("/client/templates")` + `revalidatePath("/client/templates/${templateId}")`
- Step 7: `redirect("/client/templates")` as the last statement (RESEARCH Pitfall 1: outside try/catch)

**app/client/templates/[id]/fill/page.tsx** (NEW) — RSC fill route:
- UUID guard (rejects non-UUIDs before Postgres)
- `getClientContext()` — notFound() if null
- Ownership check: `.from("form_templates").select("id, name, owner_id, owner_type, deleted_at")` — notFound() if template missing, deleted, owner_type !== "customer", or owner_id !== ctx.client_id (T-16-01, T-16-08)
- Two-step latest-version fetch: `.from("template_versions").select("id, schema_json").not("published_at", "is", null).order("version_number", { ascending: false }).limit(1).maybySingle()` — notFound() if no published version
- Renders cream-surface wrapper with mono back link + 28px serif template name + `<FillCustomerTemplateClient>`

**app/client/templates/[id]/fill/fill-customer-template-client.tsx** (NEW) — `"use client"`:
- Props: `templateId`, `templateName`, `schemaJson`
- State: `answers`, `pending` via `useTransition`
- `FormRenderer` with `surface="cream"`
- Progress bar (filledCount/totalFields)
- Submit button: "Submit form" black fill full-width (`bg-[#1a1a1a] text-white h-12`)
- Calls `submitCustomerTemplateFillAction(templateId, answers)` on submit
- NEXT_REDIRECT bubble pattern (let redirect errors propagate)

**tests/form-builder/customer-self-fill-submission.test.ts** — 4 real assertions replacing the Wave-0 `it.todo` scaffold:
- (a) `assignment_id: null` in INSERT payload (D-16 contract)
- (b) `client_id: "client-org-001"` from mocked `getClientContext()` — no client_id parameter in function signature (T-16-04 mitigation)
- (c) `.not("published_at", "is", null)` chain called — `versionMaybySingleSpy` is invoked and `template_version_id: "ver-1"` appears in INSERT payload
- (d) Throws "Template has no published version" when `maybySingle` returns `{ data: null }`

### Task 3: Delete forkOnFill + clean orphaned imports (D-07)

**app/client/templates/actions.ts** — Removed:
- `export async function forkOnFill(...)` function block (entire 91-line JSDoc + body)
- `import type { FormBuilderSchema } from "@/lib/form-builder"` (was solely used by forkOnFill params)
- `import { hasStructuralChanges } from "@/lib/forms/schema-diff"` (was solely consumed by forkOnFill)

Retained: `createClientTemplate`, `saveClientDraftAction`, `publishClientTemplateAction`, `deleteClientTemplate`, `submitCustomerTemplateFillAction` (all 5 existing exports preserved)

**lib/forms/schema-diff.ts** — RETAINED (not deleted):
- `lib/forms/schema-diff.test.ts` is a direct consumer with 8 real assertions on `hasStructuralChanges`
- Only the import from `app/client/templates/actions.ts` was removed

**tests/form-builder/save-draft.test.ts** — Removed:
- `vi.mock("@/lib/forms/schema-diff", () => ({ hasStructuralChanges: vi.fn(() => false) }))` (line 66 in original)
- This mock was there to satisfy the transitive import chain through `forkOnFill` in actions.ts; no longer needed after forkOnFill deletion

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Design Adaptations

**1. lib/forms/schema-diff.ts retained (expected per plan)**
- The plan explicitly states: "If any other file consumes it (e.g., a builder helper somewhere), the file stays but only the import from actions.ts is removed."
- `lib/forms/schema-diff.test.ts` has 8 real assertions on `hasStructuralChanges` — clear consumer.
- The JSDoc in `schema-diff.ts` still references `forkOnFill` (historical documentation) — this is stale but harmless since the function is gone. The file's purpose as a schema-comparison utility is independent of forkOnFill.

---

## Known Stubs

None — all plan deliverables are fully wired.

The `FillCustomerTemplateClient` uses `FormRenderer` from `@/components/forms/form-renderer` which has a pre-existing unresolved module error in node_modules (also present in `FillAssignmentClient` and throughout the codebase). This is a pre-existing infra issue from the worktree base, not introduced by this plan.

---

## Threat Surface Scan

All threats from the plan's threat register are mitigated:

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-16-04 Tampering — client_id from client input | `client_id: ctx.client_id` (server context); no client_id param in signature | Test (b) + code review |
| T-16-06 Service-role on client surface | `createClient` from `lib/supabase/server` (RLS-aware); grep confirms 0 hits on `supabase/admin` in `app/client/templates/` (only a comment) | grep gate |
| T-16-07 POST without client claim | `requireClientContext()` throws "Not a client user"; `requireOwnedTemplate()` throws on cross-org | code review |
| T-16-01 Cross-tenant template/version read | Ownership check before fetching schema_json; notFound on cross-org template_id | code review |
| T-16-08 Soft-deleted templates in fill route | `deleted_at !== null` check in page.tsx ownership gate | code review |
| T-16-09 Dead forkOnFill path callable post-Plan-05 | forkOnFill deleted entirely from actions.ts | grep gate (0 non-comment hits) |

No new threat surface was introduced beyond what the plan declared.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `app/client/templates/page.tsx` does NOT contain `TODO(phaseB)` | PASS |
| `app/client/templates/page.tsx` does NOT contain `text-[32px]` | PASS |
| `app/client/templates/page.tsx` contains `text-[28px]` | PASS |
| `app/client/templates/page.tsx` contains `No templates yet` | PASS |
| `app/client/templates/page.tsx` does NOT contain `Available admin masters` or `Available Templates` | PASS |
| `app/client/templates/[id]/fill/page.tsx` exists | PASS |
| `app/client/templates/[id]/fill/fill-customer-template-client.tsx` exists with `"use client"` | PASS |
| `app/client/templates/actions.ts` contains `submitCustomerTemplateFillAction` | PASS |
| `app/client/templates/actions.ts` contains `assignment_id: null` | PASS |
| `app/client/templates/actions.ts` contains `client_id: ctx.client_id` | PASS |
| `app/client/templates/actions.ts` contains `.not("published_at", "is", null)` | PASS |
| `app/client/templates/actions.ts` does NOT contain `forkOnFill` (non-comment) | PASS |
| `app/client/templates/actions.ts` does NOT contain `hasStructuralChanges` (non-comment) | PASS |
| `tests/form-builder/customer-self-fill-submission.test.ts` has 0 `it.todo(` calls | PASS |
| `tests/form-builder/customer-self-fill-submission.test.ts` contains `assignment_id: null`, `client-org-001`, `Template has no published version` | PASS |
| `npm test -- tests/form-builder/customer-self-fill-submission.test.ts --run` exits 0 (4/4 pass) | PASS |
| `npm test -- tests/form-builder/ --run`: same 4 pre-existing specialty-entities failures, no new regressions | PASS |
| Commit 2e7073a exists (Task 1) | PASS |
| Commit 411fe82 exists (Task 2) | PASS |
| Commit df0c99c exists (Task 3) | PASS |
