# 16-07 — Migration push + verification (BLOCKING) — SUMMARY

**Plan:** 16-07
**Status:** Completed with 1 known gap (see §D / Self-Check below)
**Wave:** 4 (sequential, blocking)
**Executed:** 2026-05-26

---

## What was delivered

### Task 1a — Live DB migration push (via supabase-888 MCP)

Per user authorisation, both migrations applied to the live `888fst` Supabase project:

- **013_phase16_assignments_instructions** — `ALTER TABLE form_assignments ADD COLUMN IF NOT EXISTS instructions TEXT` + `COMMENT ON COLUMN` citing D-04. ✅
- **014_phase16_customer_submissions** — `ALTER TABLE form_submissions ALTER COLUMN assignment_id DROP NOT NULL` + `COMMENT ON COLUMN` citing D-16. ✅

Verified via `list_tables(verbose=true)`:
- `form_assignments.instructions text NULL` present with D-04 comment.
- `form_submissions.assignment_id uuid NULL` (nullable) with D-16 comment; FK to `form_assignments(id)` retained.

### Task 1b — Programmatic verification

- `lib/supabase/database.types.ts` — created (file did not previously exist). Regenerated via `mcp__supabase-888__generate_typescript_types` and written verbatim. Contains:
  - `form_assignments.instructions: string | null` (Row/Insert/Update) ✅
  - `form_submissions.assignment_id: string | null` (Row/Insert/Update) ✅
- `npm test --run` — **362 passed**, 4 failed (baseline `specialty-entities.test.ts` Phase-14 red-tests, unchanged), 5 skipped (RLS suite skipped when env vars absent — acceptable per Plan 16-01 contract), 3 todo. All four filled-in Phase 16 specs (`fork-assigned-template`, `assignment-status-transitions`, `customer-self-fill-submission`, `assignments-query`) pass.
- `npm run build` — **fails with 9 errors** (7 pre-existing on `leaflet`/`@react-pdf/renderer` from before Phase 16; **2 new from Phase 16** — see §D below).

### Task 1c — BUILDER-04 regression check

- `package.json` "@coltorapps/builder": "0.2.4" ✅
- `package.json` "react": "19.2.4" ✅

BUILDER-04 dependency pin intact.

### Task 2 — UAT + ROADMAP authoring

- `.planning/phases/16-multi-tenancy-fork-on-fill/16-UAT.md` — written with §A (Customise→fork), §B (Counter pill), §C (Templates simplification), and §D (the build gap).
- `.planning/ROADMAP.md` — Phase 16 plan list already enumerated 16-01 through 16-07 from the earlier planner pass; this task marked 16-07 as `[x]` and added a Phase-16 execution footer noting the §D gap.

---

## Phase-level commits (this plan)

- `7fc005b` — feat(16-07): regenerate database.types.ts post migrations 013 + 014

Tracking commits across waves (orchestrator):
- `b7409fb` chore: merge executor worktree (16-01 wave 0)
- `9ab175c` docs(phase-16): update tracking after wave 0
- (16-02 worktree commits recovered from dangling, no merge commit — see git log `b1bf3b9..a63d4d6`)
- `bfd7f92` docs(phase-16): update tracking after wave 1
- `e7ec74c` docs(phase-16): update tracking after wave 2 (after cherry-pick recovery of 16-04)
- `be560a0` docs(phase-16): update tracking after wave 3

---

## §D — KNOWN GAP (build blocker, customer-UAT blocker)

Two new files written by Wave 2/3 executor agents import a non-existent component:

```ts
// app/client/assignments/[id]/fill/fill-assignment-client.tsx (Plan 16-04)
// app/client/templates/[id]/fill/fill-customer-template-client.tsx (Plan 16-06)
import { FormRenderer } from "@/components/forms/form-renderer";  // <-- does not exist
```

The real renderer is `InterpreterRenderer` from `@/components/form-interpreter/interpreter-renderer` (coltorapps-based), with a different API (`schema: FormBuilderSchema`, `submissionId: string`, `clientId: string`, submit via `ref`). Both fill clients were authored against a hypothetical `FormRenderer({ schema, data, onChange, surface })` API that no agent verified existed.

**Why Vitest passed:** The two affected modules are only loaded at runtime by their `page.tsx` RSC parents. The Vitest specs (`assignment-status-transitions.test.ts`, `customer-self-fill-submission.test.ts`) mock the server-action surface (`submitAssignedFillAction`, `submitCustomerTemplateFillAction`) directly without instantiating the client components.

**Why we shipped it anyway:**
1. Migrations are non-destructive and the live DB needed the column changes for any Phase 16 surface to work.
2. All other Phase 16 surfaces work: admin assign modal (`/admin/templates/[id]`, `/admin/clients/[id]` tab), admin views (`/admin/assignments`, `/admin/clients` counter pill), client assignment list (`/client/assignments`), assignment landing page, "Customise first" fork flow, customer template builder.
3. The build was already broken pre-Phase-16 on `leaflet` and `@react-pdf/renderer` — this fix adds 2 errors to an already-failing baseline rather than breaking a previously-green build.

**Required to close §D (gap-closure plan suggested):**
1. Move submission row creation to `[id]/fill/page.tsx` (RSC) — pattern from `app/admin/assessments/[id]/page.tsx`.
2. Replace `FillAssignmentClient` and `FillCustomerTemplateClient` with thin wrappers around `<InterpreterRenderer schema={…} submissionId={…} clientId={…} surface="cream" />`.
3. Parameterise `InterpreterRenderer`'s submit action (currently hard-wired to `submitAssessmentAction`) — split into a variant that calls `submitAssignedFillAction` / `submitCustomerTemplateFillAction`.
4. Remove `FormRenderer` import + `normalizeFormSchema` usage in the two new files; feed `template_versions.schema_json` straight into `InterpreterRenderer` as `FormBuilderSchema`.

Suggested next command (when ready): `/gsd:phase 16 add` a gap-closure plan, OR `/gsd:execute-phase 16 --gaps-only` after a fix plan is authored.

---

## Self-Check: PARTIAL

- **Schema push:** PASSED — migrations 013 + 014 live, verified via `list_tables`.
- **Types regen:** PASSED — `lib/supabase/database.types.ts` reflects both migrations; assertion regex green.
- **Vitest sweep:** PASSED for Phase 16 deliverables — 362 passed; baseline 4 pre-existing failures unchanged; 0 new Phase-16 failures.
- **`npm run build`:** **FAILED** — 7 pre-existing errors + 2 new Phase-16 errors (FormRenderer). Tracked as §D in 16-UAT.md.
- **BUILDER-04 pin:** PASSED — @coltorapps/builder@0.2.4 + react@19.2.4 intact.
- **UAT walkthroughs:** §A blocked by §D fix; §B + §C ready to run now.
