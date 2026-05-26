# Phase 16 — Multi-Tenancy + Fork-on-Fill — UAT

**Phase status:** Code-complete with 1 known build-blocking gap (see §D). Live DB migrations 013 + 014 applied 2026-05-26. Types regenerated and committed.

**Prereq for §A and §B:** one admin user (`admin@…`); two client users in two different orgs (Org A + Org B); at least one published admin master template.

---

## §A — Customise first → fork → builder redirect (D-07)

1. **Prereqs:** Admin signed in; client_user A signed in (incognito or second browser); ≥ 1 published admin master template; an existing assignment from admin to client A's org pointing at that master template.

2. **As client A:** Navigate to `/client/assignments` — see the assignment under the **Active** tab. Click into it.

3. **On the landing page (`/client/assignments/[id]`), verify:**
   - Template name displayed at top (28px Newsreader).
   - Due date shown (or "No due date").
   - Instructions block visible **only if** the assignment row has `instructions` set (cream bg with gold left border).

4. **Click "Customise first"** — the AlertDialog opens with the locked title **"Create your own copy?"** and the locked body copy.

5. **Click "Create my copy"** — observe the redirect to `/client/templates/<some-uuid>/edit`. The builder opens with the assignment's fields visible.

6. **In Supabase Studio:**
   - The `form_assignments` row now points at the fork's `template_id` (template_id rewritten).
   - The fork has `parent_template_id = <master.id>` and `owner_type = 'customer'`, `owner_id = <client A's org id>`.

**Expected outcomes (checkboxes):**
- [ ] Redirect happened.
- [ ] Builder shows the same fields as the master.
- [ ] Assignment row's `template_id` is rewritten to the fork.
- [ ] Fork's `parent_template_id` references the master.

---

## §B — Admin clients list counter pill (D-12)

1. **As admin:** Assign the same template to 2 different clients via the `AssignTemplateModal` (one of them being client A).

2. **Navigate to `/admin/clients`** — observe the **earth-amber counter pill** on rows for both clients. Hover to verify the tooltip reads "2 active assignments" (or "1 active assignment" depending on prior state — pluralisation must be correct).

3. **Verify** a client with zero active assignments shows **NO pill** (the absence is the affordance — confirming D-12's "show pill only when count > 0" rule).

**Expected outcomes:**
- [ ] Pill renders only on rows with > 0 active assignments.
- [ ] Hover tooltip pluralisation is correct (`1 active assignment` vs `N active assignments`).

---

## §C — `/client/templates` simplification (D-09)

1. **As client A:** Navigate to `/client/templates`.

2. **Verify the page shows only "My Templates"** — no "Available Templates" / admin-masters section. The `TODO(phaseB)` block from earlier is removed.

3. **Verify the page heading uses the 28px Newsreader size** (visually consistent with `/client/assignments` heading).

4. **If client A has zero customer templates:** verify the empty state shows:
   - "No templates yet"
   - "Create your own forms or customise an assigned form when it arrives."

**Expected outcomes:**
- [ ] No admin-masters section anywhere on `/client/templates`.
- [ ] Heading size matches `/client/assignments`.
- [ ] Empty-state copy is the locked UI-SPEC strings.

---

## §D — KNOWN GAP: fill-page build error (P1, must fix before customer-facing UAT)

**Status:** Build-blocking. Vitest is green (362/362 passing for Phase 16 deliverables); production `npm run build` adds 2 new "Module not found" errors on top of the pre-Phase-16 baseline.

**Files affected:**
- `app/client/assignments/[id]/fill/fill-assignment-client.tsx`
- `app/client/templates/[id]/fill/fill-customer-template-client.tsx`

**Root cause:** Plans 16-04 and 16-06 imported `@/components/forms/form-renderer` — that component does not exist. The real renderer is `InterpreterRenderer` from `@/components/form-interpreter/interpreter-renderer.tsx` (coltorapps-based), with a different API: `schema: FormBuilderSchema`, `submissionId: string`, `clientId: string`, submit via `ref`.

**Why Vitest passed anyway:** Both fill-client modules are loaded only at runtime by their `page.tsx` parents. Vitest spec mocks for `submitAssignedFillAction` / `submitCustomerTemplateFillAction` exercise the server actions directly without instantiating the client components.

**Required to close §D:**
1. RSC-side: create the `form_submissions` row in `[id]/fill/page.tsx` before mounting the client (pattern: `app/admin/assessments/[id]/page.tsx` lines 80-130).
2. Replace `FillAssignmentClient` and `FillCustomerTemplateClient` with thin wrappers around `<InterpreterRenderer schema={…} submissionId={…} clientId={…} surface="cream" />`.
3. Move the submit responsibility into the server action wiring already inside `InterpreterRenderer` (it currently calls `submitAssessmentAction` — needs to be parameterised, or split into two variants for the two flows).
4. Remove `FormRenderer` imports + `normalizeFormSchema` usage in the new files (`FormBuilderSchema` is the right shape, fed straight from `template_versions.schema_json`).

**Pre-existing build failures (not Phase 16):**
- `leaflet` / `leaflet/dist/leaflet.css` — used in `components/form-interpreter/geolocation-map.tsx`.
- `@react-pdf/renderer` — used in `components/pdf/proposal-document.tsx`, `lib/pdf/generator.tsx`.

These were broken before Phase 16 began (Phase 14/15 build summaries noted them). They're tracked separately — not Phase 16 work.

---

## Acceptance for phase close

Sections §A, §B, §C are the production UAT walkthroughs. §D is the close-out blocker.

- §A — Customise first → fork: **needs UAT once §D is fixed** (fork itself works; the fill page that the redirect lands users on is broken until §D fix).
- §B — Counter pill: **ready to UAT now** (no fill-page dependency).
- §C — Templates simplification: **ready to UAT now** (no fill-page dependency).
