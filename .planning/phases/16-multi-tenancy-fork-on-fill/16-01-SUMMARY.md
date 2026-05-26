---
phase: 16-multi-tenancy-fork-on-fill
plan: "01"
plan_id: 16-01
subsystem: schema-migrations, test-infrastructure
tags: [supabase, rls, vitest, multi-tenancy, schema-migration]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/013_phase16_assignments_instructions.sql
    - supabase/migrations/014_phase16_customer_submissions.sql
    - tests/rls/helpers/seed-two-tenants.ts
    - tests/rls/multi-tenancy.spec.ts
    - tests/form-builder/fork-assigned-template.test.ts
    - tests/form-builder/assignment-status-transitions.test.ts
    - tests/form-builder/customer-self-fill-submission.test.ts
    - tests/form-builder/assignments-query.test.ts
  affects:
    - vitest.config.ts
tech_stack:
  added:
    - "@supabase/supabase-js (direct createClient usage in RLS test helper)"
  patterns:
    - "describe.skipIf(!hasEnv) for env-gated integration tests"
    - "it.todo() Wave-0 scaffold pattern for future plan contracts"
    - "Two-tenant seed/teardown with service-role + anon+signInWithPassword per Pitfall 4"
key_files:
  created:
    - supabase/migrations/013_phase16_assignments_instructions.sql
    - supabase/migrations/014_phase16_customer_submissions.sql
    - tests/rls/helpers/seed-two-tenants.ts
    - tests/rls/multi-tenancy.spec.ts
    - tests/form-builder/fork-assigned-template.test.ts
    - tests/form-builder/assignment-status-transitions.test.ts
    - tests/form-builder/customer-self-fill-submission.test.ts
    - tests/form-builder/assignments-query.test.ts
  modified:
    - vitest.config.ts
decisions:
  - "Migration 013 uses ADD COLUMN IF NOT EXISTS for idempotent replay safety"
  - "Migration 014 drops NOT NULL without a TRIGGER or CHECK (application-level invariant per RESEARCH)"
  - "form_templates admin master rows use owner_id=null in test seed (owner_id is nullable in migration 001)"
  - "form_assignments.assigned_by=null in test seed (FK is nullable; seeded client users are not admin_users)"
  - "RLS positive control uses form_assignments (not form_submissions) because form_submissions_client_delivered policy requires status=delivered for client reads"
  - "Wave-0 scaffolds use it.todo — no vi.mock needed since there is no implementation code yet"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 8
  files_modified: 1
---

# Phase 16 Plan 01: Schema Migrations + RLS Test Infrastructure Summary

Phase 16's multi-tenancy contract is established via two schema migrations (not yet pushed) and a full RLS test infrastructure. Subsequent plans (02-07) execute against this verified contract.

## What Was Built

### Migration Files (NOT pushed — push reserved for Plan 07)

**`supabase/migrations/013_phase16_assignments_instructions.sql`**
- `ALTER TABLE public.form_assignments ADD COLUMN IF NOT EXISTS instructions TEXT;`
- `COMMENT ON COLUMN` documenting Phase 16 D-04 (optional free-text shown above form)
- No DEFAULT required — NULL is the correct "no instructions" state

**`supabase/migrations/014_phase16_customer_submissions.sql`**
- `ALTER TABLE public.form_submissions ALTER COLUMN assignment_id DROP NOT NULL;`
- FK `REFERENCES form_assignments(id)` retained — admin-flow submissions remain valid
- `COMMENT ON COLUMN` documenting Phase 16 D-16 application-level invariant
- No TRIGGER added (anti-pattern per RESEARCH); no CHECK (Postgres disallows cross-table subquery in CHECK)

### vitest.config.ts Diff

Line 8 `include` array extended from 2 entries to 3:
```
"tests/rls/**/*.{test,spec}.{ts,tsx}"
```
(added alongside existing `tests/form-builder/**` and `tests/form-interpreter/**` entries)

### Two-Tenant Seed Helper

**`tests/rls/helpers/seed-two-tenants.ts`**

Exported surface:
- `export interface TestUser` — 11 fields: email, password, authUserId, clientId, clientUserId, adminMasterTemplateId, adminMasterVersionId, assignmentId, customerTemplateId, customerTemplateVersionId, submissionId
- `export interface SeedContext` — `{ userA: TestUser; userB: TestUser }`
- `export async function seedTwoTenants(): Promise<SeedContext>` — provisions 2 tenants × 9 rows each
- `export async function teardown(ctx: SeedContext): Promise<void>` — reverse-order delete + auth.admin.deleteUser
- `export async function signedInClientFor(user: TestUser): Promise<SupabaseClient>` — anon+signInWithPassword, never service-role

Per-tenant seed sequence:
1. `auth.admin.createUser` (email_confirm: true)
2. `clients` row insert
3. `client_users` row insert (linking auth user → org)
4. Admin master `form_templates` row (owner_type='admin', owner_id=null, is_published=true)
5. Published `template_versions` v1 for admin master
6. `form_assignments` row (status='pending', assigned_by=null)
7. Customer-owned `form_templates` row (owner_type='customer', owner_id=clients.id)
8. Published `template_versions` v1 for customer template
9. `form_submissions` row (assignment_id=assignmentId, status='Draft')

All emails carry `Date.now()` stamp to prevent concurrent-run collisions.

### 5-Spec RLS Isolation Suite

**`tests/rls/multi-tenancy.spec.ts`**

```typescript
describe.skipIf(!hasEnv)("RLS — cross-org isolation (Phase 16)", () => { ... })
```

| # | Spec Name | Table | Assertion |
|---|-----------|-------|-----------|
| 1 | Client A cannot read Client B's customer-owned form_templates | form_templates | `expect(data).toEqual([])` |
| 2 | Client A cannot read Client B's customer template_versions by id | template_versions | `expect(data).toEqual([])` |
| 3 | Client A cannot read Client B's form_submissions by client_id | form_submissions | `expect(data).toEqual([])` |
| 4 | Client A cannot read Client B's form_assignments by client_id | form_assignments | `expect(data).toEqual([])` |
| 5 | Client A CAN read own-org form_assignments (positive control) | form_assignments | `expect(data?.length).toBeGreaterThan(0)` |

The positive control (spec 5) catches silent seed failures (Threat T-16-08).

### 4 Form-Builder Wave-0 Scaffolds

| File | Phase 16 Decisions | Filled in Plan |
|------|--------------------|----------------|
| `tests/form-builder/fork-assigned-template.test.ts` | D-05, D-06 | Plan 05 |
| `tests/form-builder/assignment-status-transitions.test.ts` | D-08, D-10, D-11 | Plan 04 |
| `tests/form-builder/customer-self-fill-submission.test.ts` | D-16 | Plan 06 |
| `tests/form-builder/assignments-query.test.ts` | D-08 (query shape) | Plan 04 |

Each scaffold contains `it.todo()` entries so `npm test` reports todos without failing.

## Environment Variables Required for RLS Suite to Run

The `describe.skipIf(!hasEnv)` guard requires all three of these to be set:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (used for assertion reads)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (seed/teardown only)

When absent: Vitest reports "5 tests | 5 skipped" (silent skip, not failure).
When present: Tests run against the live DB — do NOT set in `.env.local`; use `.env.test` or CI secrets.

## Deviations from Plan

### Pre-existing Failure (Out of Scope)

`tests/form-builder/specialty-entities.test.ts` has 4 pre-existing failing tests (present before this plan's changes — verified via `git stash` confirmation). The failure is unrelated to Plan 16-01 changes.

Per SCOPE BOUNDARY rule: pre-existing failures in unrelated files are out of scope. Logged here for awareness.

### Decision: owner_id=null for Admin Master Templates in Test Seed

The plan said "OR insert a service-role admin_users entry; pick the approach that matches existing test pattern at tests/security.spec.ts line 96-105". The security.spec.ts pattern seeds `documents` (not `form_templates`), so it does not address admin_users. Since `form_templates.owner_id` is nullable (migration 001 line 50, no NOT NULL), using `owner_id=null` is simpler and avoids creating a transient admin_users row. The RLS tests assert cross-org isolation via `client_id` columns; admin template `owner_id` is not the tested field.

### Decision: assigned_by=null in form_assignments Seed

`form_assignments.assigned_by UUID REFERENCES admin_users(id)` — the FK is nullable. Seeded client users are not in `admin_users`, so `NULL` is used. The RLS test does not assert on `assigned_by`.

### Decision: Positive Control on form_assignments (not form_submissions)

`form_submissions_client_delivered` policy restricts client SELECT to rows where `status='delivered'`. The seeded submissions have `status='Draft'`, so a positive control on `form_submissions` would return `[]` even for own-org rows — making it an unreliable seed validator. The positive control on `form_assignments` uses `form_assignments_client_own` (no status restriction), which reliably returns the seeded row.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migrations 013+014 + vitest.config.ts | d46266b | migrations/013, 014, vitest.config.ts |
| 2 | Two-tenant seed/teardown harness | e32e09e | tests/rls/helpers/seed-two-tenants.ts |
| 3 | RLS suite + 4 Wave-0 scaffolds | 9a7b6f2 | tests/rls/multi-tenancy.spec.ts, 4 form-builder scaffolds |

## Self-Check: PASSED

- [x] `supabase/migrations/013_phase16_assignments_instructions.sql` — exists, contains `ADD COLUMN IF NOT EXISTS instructions TEXT`
- [x] `supabase/migrations/014_phase16_customer_submissions.sql` — exists, contains `ALTER COLUMN assignment_id DROP NOT NULL`
- [x] `vitest.config.ts` — contains `tests/rls/**/*.{test,spec}.{ts,tsx}`
- [x] `tests/rls/helpers/seed-two-tenants.ts` — exports seedTwoTenants, teardown, signedInClientFor, SeedContext, TestUser; TypeScript clean
- [x] `tests/rls/multi-tenancy.spec.ts` — 5 specs, describe.skipIf, signedInClientFor, 4x expect(data).toEqual([]), 1x toBeGreaterThan(0)
- [x] 4 form-builder scaffold files — each contains it.todo entries
- [x] Migrations NOT pushed (push reserved for Plan 07)
- [x] Commits d46266b, e32e09e, 9a7b6f2 exist in git log
