# Phase 18 — FRA Seed Template — UAT

**Phase status:** Code-complete + DB-live. Migration 016 applied 2026-05-27 (via supabase-888 MCP). Seeded one admin master template (`Fire Risk Assessment (Type 3) — Single Premises`, `is_published=true`, 6 sections / 40 entities). Legacy `lib/forms/fra-template.ts` deleted after grep-confirming zero references. n8n assessment webhook ported into `submitAssessmentAction` via `after(...)`. All 5 ROADMAP success criteria delivered.

**Prereq for §A–§E:** one admin user, one client_user signed in to a different org, the FRA Type 3 template visible at `/admin/templates`. `N8N_ASSESSMENT_WEBHOOK_URL` env var set to a request-bin (e.g. webhook.site) for §D smoke.

**Seeded IDs:**
- `form_templates.id = 00000000-0000-4000-a000-000000000018`
- `template_versions.id = 00000000-0000-4000-a000-000000000118`

---

## §A — Builder renders the FRA structure (SC#1, TMPL-FRA-01)

1. **As admin:** Navigate to `/admin/templates` — see "Fire Risk Assessment (Type 3) — Single Premises" in the list with `Published` status.
2. Click into the template to open the builder. Verify:
   - 6 top-level sections in left-rail order: `01 — Premises Details`, `02 — Fire Safety Management`, `03 — Means of Escape`, `04 — Fire Protection Measures`, `05 — Findings & Action Plan`, `06 — Sign-Off`.
   - Conditional sub-sections appear as nested under their parents: `Policy remediation` (§02 child), `Obstruction details` (§03 child), `Detection upgrade plan` (§04 child).
   - §01 starts with a `geolocationField` ("Site location"), followed by text/textarea/text/select for Premises name / Site address / Responsible person / Occupancy type.
   - §05 has Likelihood + Consequence number fields, the PAS 79 computed field, the Action Plan repeating section, and General observations.
   - §06 contains one signature field at the end.

**Expected outcomes:**
- [ ] Template renders in the builder with all 6 sections.
- [ ] Conditional sub-sections are visually distinct (greyed/indented per Phase 15 UI-SPEC).
- [ ] No "Unknown entity type" errors in the console.

---

## §B — End-to-end fill on the client surface (SC#2 + SC#3 + SC#4, TMPL-FRA-02/03/04)

1. **As admin:** Assign the FRA Type 3 template to a client_user A's org (via Phase 16 `AssignTemplateModal`). Set due_date to a week from today. Leave instructions blank.
2. **As client A** (incognito or second browser): Navigate to `/client/assignments` → Active tab → click the FRA assignment → click "Fill as-is".
3. **Verify the fill page renders:**
   - Browser prompts for geolocation permission (or auto-populates if previously granted). The geolocation field captures lat/lng.
   - All text/textarea fields show the `MicButton` for STT (Phase 14 inheritance).
   - In §02, select "Yes — but out of date" or "No" for the policy question. The `Policy remediation` sub-section appears below; selecting "Yes — current and signed" hides it.
   - In §03, select "Partially — minor obstructions" or "No — significant obstructions". The `Obstruction details` sub-section appears.
   - In §04, select "None / domestic only" for Detection system. The `Detection upgrade plan` sub-section appears.
   - In §05, enter Likelihood = 3 and Consequence = 4. The PAS 79 `Risk score` field updates to show **12 — Substantial** (per the band table at `lib/form-builder/risk/pas79.ts`).
   - In §05 Action Plan, click "Add row". A new row appears with Action description (textarea), Responsible person (text), Target completion date (date), Priority (select). Add 2-3 rows.
   - In §03 and §04, "Photographic evidence" multi-photo fields accept up to 8 photos each. In §03a, "Obstruction photos" accepts up to 5.
   - In §06, the signature canvas accepts a finger-drawn signature.
4. **Click "Submit form".** Verify the submission lands and you're redirected to the assignment landing page.

**Expected outcomes:**
- [ ] All conditional sub-sections show/hide based on Yes/No selections (SC#2).
- [ ] STT mic button visible on every text/textarea field (SC#3).
- [ ] Multi-photo evidence uploads work (SC#3).
- [ ] PAS 79 risk score auto-calculates and updates live (SC#4).
- [ ] Action Plan adds/removes rows (SC#4).
- [ ] Signature canvas accepts input.
- [ ] Submission completes without error.

---

## §C — PAS 79 risk-score band verification (TMPL-FRA-04)

The PAS 79 module at `lib/form-builder/risk/pas79.ts` defines the band mapping. Verify against the live `computedField`:

| Likelihood × Consequence | Expected Band | Expected Score |
|--------------------------|---------------|----------------|
| 1 × 1 | Trivial | 1 |
| 1 × 2 / 2 × 1 | Tolerable | 2 |
| 2 × 2 / 1 × 4 | Tolerable | 4 |
| 2 × 3 / 3 × 2 | Moderate | 6 |
| 3 × 3 | Moderate | 9 |
| 3 × 4 / 4 × 3 | Substantial | 12 |
| 4 × 4 | Intolerable | 16 |
| 5 × 5 | Intolerable | 25 |

**Action:** in §B fill, change Likelihood and Consequence through the 8 combinations above. Verify the Risk score field updates each time with the expected number AND band label.

**Expected outcomes:**
- [ ] All 8 combinations yield the expected score + band.
- [ ] Band labels match `pas79.ts` definitions.
- [ ] The score updates live (no page reload required).

**[ASSUMED A1]** — band boundaries in `pas79.ts` are RESEARCH-flagged as needing Matt's confirmation. If any combination is off, the fix is a one-line edit in `pas79.ts` (not a re-seed).

---

## §D — n8n webhook fires on admin submission (SC#5, TMPL-FRA-05)

**Prereq:** Set `N8N_ASSESSMENT_WEBHOOK_URL` in your local `.env.local` to a webhook.site URL.

1. **As admin:** Open an existing assessment in the admin queue (not the client-side fill). Or create one via the admin assessment flow.
2. Fill the assessment to completion in `app/admin/assessments/[id]/page.tsx`. Click "Submit".
3. **Verify the n8n webhook fired** — check the webhook.site URL received a POST with body `{ "submissionId": "<uuid>" }`.
4. **Verify the AI report pipeline ALSO fired** — check the submission row's `draft_report_json` is populated after a few seconds (Phase 7's existing `after(runReportDraftGeneration)` hook).

**Expected outcomes:**
- [ ] n8n webhook receives the POST.
- [ ] AI draft also generates (parallel pipeline — both fire from the same `after()` block).
- [ ] Failure on the n8n side does NOT block the AI pipeline (the second `after()` is independent).
- [ ] `workflow_errors` row is inserted if n8n returns non-200 (verify in Supabase Studio).

---

## §E — Customer submission does NOT fire AI (P7 invariant)

This is a regression test for the architectural invariant locked in Phase 17 and reinforced by Plan 18-02's `<behavior>` block.

1. **As client A:** Submit a customer-template form (any non-assignment submission via `/client/templates/[id]/fill`).
2. **Verify in Supabase Studio:**
   - The `form_submissions` row exists with `status='submitted'` and `assignment_id=NULL`.
   - `draft_report_json` is and remains NULL — the AI pipeline did NOT fire.
   - No row in `workflow_errors` for `assignment_reminder` or `assessment_webhook`.

**Expected outcomes:**
- [ ] Customer submission writes the row but does NOT trigger AI or n8n.
- [ ] Only the admin `submitAssessmentAction` path fires both.

---

## §F — Accepted trade-offs

### §F.1 PAS 79 band boundaries (RESEARCH ASSUMED A1)

The exact band cutoffs in `pas79.ts` (≤2 Trivial, ≤4 Tolerable, ≤9 Moderate, ≤12 Substantial, ≤25 Intolerable) follow standard PAS 79 5×5 matrix guidance. Confirm with Matt during UAT §C. If divergent, the fix is a one-line edit.

### §F.2 Customer recurrence handling (Phase 17 + Phase 18 integration)

When a client_user fills the assigned FRA (Phase 16 + 17 path), the Phase 17 inline recurrence trigger in `submitAssignedFillByIdAction` runs IF the assignment has a `recurrence_rule`. The new occurrence will pin to the latest published version of the master FRA (Phase 17 §C verification). This is Phase 17's contract; Phase 18 just confirms the FRA seed plays well with it.

### §F.3 Customer-forked FRAs (Phase 16 D-08 integration)

If a client_user forks the FRA via "Customise first" (Phase 16 D-07), the fork is owned by the client's org (`owner_type='customer'`) and snapshots the FRA version at fork time. Edits to the master FRA in the future do NOT cascade to existing forks. This is Phase 16's contract; Phase 18 honors it (no master-to-fork cascade introduced by the seed migration).

---

## §G — Acceptance for phase close

§A, §B, §C, §D, §E are the production UAT walkthroughs.

- §A — Builder render: ready to UAT now (DB-live).
- §B — End-to-end fill: ready to UAT now.
- §C — PAS 79 verification: ready to UAT now (with [ASSUMED A1] confirmation from Matt).
- §D — n8n webhook smoke: needs `N8N_ASSESSMENT_WEBHOOK_URL` set to a request-bin.
- §E — P7 invariant regression: ready to UAT now.

**Open questions for Matt (UAT-time):**
- Confirm PAS 79 band boundaries match Yellow Broom convention.
- Confirm the §02/§03/§04 Yes/No sub-section reveal mapping matches his FRA practice.
- Confirm the 4-column Action Plan structure (Description / Owner / Date / Priority) matches industry norm.
- Confirm the n8n side has the routing for this webhook (or, if SC#5 is satisfied entirely by the existing AI SDK pipeline, the n8n port becomes a fire-and-forget audit log and that's still OK).
