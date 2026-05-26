---
phase: 15
slug: conditional-logic-engine
type: uat
created: 2026-05-26
status: pending
---

# Phase 15 — Manual UAT Script: Conditional Logic Engine

> **Pre-condition:** All steps assume migration 012 is applied.
> Run `SELECT name FROM form_templates WHERE name = 'Phase 15 Conditional Smoke Test'` and confirm a row is returned.
> The template ID is `0047e922-d17d-4b32-94a4-f5c075823c6d` (see 15-PUSH-LOG.md).
> `npm run dev` (or equivalent) must be running without errors.
> Signed in as admin before starting any section.
> DO NOT mark Phase 15 complete until either all sections PASS or failures have an accepted-deferral note.

---

## Pre-flight Checklist

Before starting any section, confirm all of these:

- [ ] Migration 012 applied — `SELECT name FROM form_templates WHERE name = 'Phase 15 Conditional Smoke Test'` returns a row
- [ ] `npm run dev` is running without errors on `http://localhost:3000`
- [ ] Browser console is open (F12) on a fresh session — no pre-existing errors
- [ ] Signed in as admin (Matt or equivalent admin account)
- [ ] Chrome desktop (latest stable) — required for full visibilityRules UX testing

---

## Section A — Builder: ConditionalLogicSection + PropertiesPanel

*Tests that the Conditional Logic collapsible section appears in the PropertiesPanel for non-container entities, and does NOT appear for containers. Exercises the builder UI (UI-SPEC §1).*

**A1 — Open the smoke template in the builder**

- [ ] Navigate to `/admin/templates`
- [ ] Locate "Phase 15 Conditional Smoke Test" in the list
- [ ] Click to open the form builder
- [ ] Verify the canvas renders 6 root-level entity cards: Site type, Likelihood (1-5), Consequence (1-5), PAS 79 risk level, Mitigation, Fire doors register section
- [ ] Verify the "Fire doors register section" sectionGroup shows "Fire doors register" repeatingSection as a child, and that repeatingSection shows 2 indented children (Door condition, Repair urgency)

**A2 — ConditionalLogicSection renders on non-container entity**

- [ ] Click the "Mitigation" textField entity in the canvas
- [ ] In the PropertiesPanel (right panel), scroll to the bottom
- [ ] Verify a collapsible section labelled `CONDITIONAL LOGIC (1)` is present (rule count badge shows 1)
- [ ] Verify the section is collapsed by default (chevron pointing right)
- [ ] Click the CONDITIONAL LOGIC header to expand it
- [ ] Verify the expanded state shows:
  - [ ] An AND/OR segmented toggle at the top
  - [ ] One rule row: source = "PAS 79 risk level", operator = "equals", value = "Intolerable", action = "show"
  - [ ] A trash icon on the rule row
  - [ ] A `+ Add condition` dashed button at the bottom

**A3 — ConditionalLogicSection does NOT render on sectionGroup**

- [ ] Click the "Fire doors register section" sectionGroup entity in the canvas
- [ ] In the PropertiesPanel, scroll to the bottom
- [ ] Verify NO `CONDITIONAL LOGIC` section is present (containers cannot have rules on themselves per D-04/UI-SPEC §1)
- [ ] Same for the "Fire doors register" repeatingSection — no CONDITIONAL LOGIC editor

**A4 — Source-field dropdown content**

- [ ] Click the "Repair urgency" selectField child entity in the builder canvas
- [ ] Expand its CONDITIONAL LOGIC section
- [ ] Click the source-field dropdown in the existing rule row
- [ ] Verify "Door condition" (its repeatingSection sibling) appears in the dropdown
- [ ] Verify root-level fields also appear (Site type, Likelihood, etc.) per D-03 ancestor-scope
- [ ] Verify fields from other contexts do NOT appear (no invalid cross-scope references)

**A5 — Operator dropdown filters by source field type**

- [ ] With the "Mitigation" field selected, expand its CONDITIONAL LOGIC section
- [ ] Click the operator dropdown in the rule row
- [ ] Source is a computedField (formula=pas79) — verify available operators include: equals, not equals, greater than, less than (per D-06 computedField filter)
- [ ] Verify `contains` does NOT appear (computedField outputs a category string, not freetext)

**A — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section B — Builder: Rule Editing (ADD / EDIT / DELETE)

*Tests the rule-editor interactions: adding a new rule, editing fields, and deleting a rule.*

**B1 — Add a new rule to a field**

- [ ] Select the "Site type" selectField in the builder canvas
- [ ] Scroll to the CONDITIONAL LOGIC section (should show 0 rules, badge absent)
- [ ] Expand the section
- [ ] Click `+ Add condition`
- [ ] Verify a new empty rule row appears: `— field — | equals | value… | → | show | 🗑`
- [ ] Use the source-field dropdown to select a field (e.g., "Likelihood (1-5)")
- [ ] Set operator to "greater than"
- [ ] Set value to "3"
- [ ] Set action to "hide"
- [ ] Verify the CONDITIONAL LOGIC badge now shows `(1)` in the collapsed header

**B2 — Delete a rule**

- [ ] Click the trash icon on the newly added rule row from B1
- [ ] Verify the rule row disappears from the expanded section
- [ ] Verify the badge in the collapsed header reverts to `CONDITIONAL LOGIC` (no badge = 0 rules)

**B3 — AND/OR toggle**

- [ ] Select the "Mitigation" textField (which already has 1 rule)
- [ ] Expand CONDITIONAL LOGIC
- [ ] Click `+ Add condition` to add a second rule (fill it with any valid values)
- [ ] Verify the AND/OR toggle is visible
- [ ] Click `OR` — the OR chip becomes active (styled with `bg-[#3b8273]` teal)
- [ ] Click `AND` — the AND chip becomes active
- [ ] Delete the extra rule when done (so the spec remains clean)

**B — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section C — Fill Flow: D-03 Per-Instance Require (FRA Doors)

*Tests the canonical FRA-doors per-instance require flow: when Door condition = Poor, Repair urgency becomes required within the same instance. Per D-03: sibling reference inside repeatingSection is scoped per-instance.*

**C1 — Open fill page with Site type = Commercial**

- [ ] From `/admin/assessments/new`, create a new assignment using "Phase 15 Conditional Smoke Test" against any client
- [ ] Land on the fill page
- [ ] Set "Site type" to "Commercial"
- [ ] Verify the "Fire doors register section" sectionGroup and its contained "Fire doors register" repeatingSection are visible

**C2 — Add 2 fire door instances**

- [ ] Click the "+ Add Fire doors register" (or equivalent add-instance button) twice
- [ ] Verify 2 instance cards appear: instance 1 and instance 2
- [ ] Each instance shows: "Door condition" (selectField), "Repair urgency" (selectField)

**C3 — Instance 0: Door condition = Good → Repair urgency NOT required**

- [ ] In instance 1 (first instance), set "Door condition" to "Good"
- [ ] Verify "Repair urgency" in instance 1 does NOT show a required asterisk `*` (it is optional)
- [ ] Verify submitting without filling "Repair urgency" in instance 1 does NOT block on that field

**C4 — Instance 1: Door condition = Poor → Repair urgency becomes required**

- [ ] In instance 2 (second instance), set "Door condition" to "Poor"
- [ ] Verify "Repair urgency" in instance 2 SHOWS a required asterisk `*` or equivalent indicator (dynamic required per D-03)
- [ ] Attempt to submit the form without filling "Repair urgency" in instance 2
- [ ] Verify the submit is blocked with a validation error on that field

**C5 — Fill Repair urgency and submit successfully**

- [ ] Set "Repair urgency" in instance 2 to "High"
- [ ] Also fill any other required fields (Likelihood, Consequence, Site type already done)
- [ ] Submit the form
- [ ] Verify a success confirmation (toast or navigation)

**C6 — D-03 scope isolation: per-instance**

- [ ] Confirm that changing "Door condition" in instance 2 to "Poor" did NOT affect whether "Repair urgency" in instance 1 was required (they are independent per D-03)

**C — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section D — Fill Flow: D-01 Cascade Strip (Site Type = Residential)

*Tests the root-scope show/hide rule: when Site type = Residential, the "Fire doors register section" sectionGroup hides, along with all its descendants (cascade per D-01). On submit, the hidden subtree is stripped from answers_json.*

**D1 — Set Site type = Commercial (section visible)**

- [ ] Open the smoke template fill page (create a new assignment)
- [ ] Set "Site type" to "Commercial"
- [ ] Verify the "Fire doors register section" sectionGroup is visible
- [ ] Add one fire door instance to confirm the repeatingSection is usable

**D2 — Set Site type = Residential (section hides)**

- [ ] Change "Site type" to "Residential"
- [ ] Verify the "Fire doors register section" and ALL its children unmount immediately (no transition)
- [ ] Verify the Fire doors register section title is no longer visible in the DOM (check via F12 Elements panel)
- [ ] The form reflows — the gap the section occupied closes naturally

**D3 — Set Site type = Industrial (section still hidden)**

- [ ] Change "Site type" to "Industrial"
- [ ] Verify the section remains hidden (rule: show only when Commercial)

**D4 — Restore Commercial (section re-appears)**

- [ ] Change "Site type" back to "Commercial"
- [ ] Verify the "Fire doors register section" re-appears
- [ ] If a fire door instance was added before (D1 step), verify the D-01 decision to "preserve on hide, drop on submit" — the instance may or may not be restored depending on implementation (check the D-01 decision in CONTEXT.md: values are preserved in the interpreter store)

**D5 — Submit with Residential (D-01 cascade strip confirmed)**

- [ ] Set "Site type" to "Residential" (section hidden)
- [ ] Fill other required fields (Likelihood, Consequence)
- [ ] Submit the form
- [ ] Verify the submission succeeds (no validation error about Fire doors — the hidden section is excluded from validation)

**D6 — (Optional DB check) Verify cascade strip in answers_json**

- [ ] After submitting in D5, note the submission ID from the URL
- [ ] Query `form_submissions.answers_json` for the submission using the Supabase dashboard or MCP:
  ```sql
  SELECT id, answers_json FROM form_submissions 
  WHERE id = '<submission-id>' LIMIT 1;
  ```
- [ ] Verify the sectionGroup entity ID (`c95096c7...` or equivalent) does NOT appear as a key in `answers_json` (D-01 server scrub)
- [ ] Verify the repeatingSection entity ID and child entity IDs also do NOT appear

**D — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section E — Fill Flow: D-02 PAS 79 Mitigation Show/Hide

*Tests the computedField-as-rule-source flow (D-02): when PAS 79 evaluates to "Intolerable", the Mitigation textField becomes visible.*

**E1 — Low risk: Mitigation NOT visible**

- [ ] Open the smoke template fill page
- [ ] Set "Site type" to "Commercial" (or any value — Mitigation is root-level, always accessible)
- [ ] Set "Likelihood (1-5)" = 1, "Consequence (1-5)" = 1
- [ ] Verify "PAS 79 risk level" badge shows "Trivial" (score = 1)
- [ ] Verify the "Mitigation" textField is NOT visible (it has a `show` rule that requires Intolerable)

**E2 — Intolerable risk: Mitigation appears**

- [ ] Set "Likelihood (1-5)" = 5, "Consequence (1-5)" = 5
- [ ] Verify "PAS 79 risk level" badge shows "Intolerable" (score = 25)
- [ ] Verify the "Mitigation" textField APPEARS immediately (reactive — no page reload)
- [ ] Verify the "Mitigation" field shows the placeholder text from the migration

**E3 — Fill and submit with Mitigation visible**

- [ ] Fill the "Mitigation" field with a real value, e.g. "Install additional suppression system"
- [ ] Complete any other required fields and submit
- [ ] Verify success confirmation

**E4 — Mitigation value persists to answers_json**

- [ ] After submitting, query `form_submissions.answers_json`:
  ```sql
  SELECT answers_json FROM form_submissions 
  WHERE id = '<submission-id>' LIMIT 1;
  ```
- [ ] Verify the Mitigation entity's ID appears as a key with a non-empty value
- [ ] Confirm the value matches what was filled in E3

**E5 — Back to low risk: Mitigation hides again**

- [ ] In the same fill session (or a new one), set risk back to low (Likelihood=1, Consequence=1)
- [ ] Verify "Mitigation" hides immediately
- [ ] Submit without filling Mitigation
- [ ] Query `answers_json` — Mitigation entity ID should be ABSENT (server scrub, D-01 applied to hidden "show" fields)

**E — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section F — Cycle Detection (Builder UAT)

*Tests that save-time cycle detection works: a cycle between two fields is rejected with an inline error and the Publish button is disabled.*

**F1 — Build a deliberate cycle**

- [ ] Open the smoke template in the admin builder
- [ ] Select the "Site type" selectField
- [ ] Expand CONDITIONAL LOGIC and click `+ Add condition`
- [ ] Set source = "Mitigation", operator = "equals", value = "test", action = "show"
- [ ] Now select the "Mitigation" textField
- [ ] It already has a rule: source = "PAS 79 risk level" → equals → Intolerable → show
- [ ] Add a second rule on "Mitigation": source = "Site type", operator = "equals", value = "Commercial", action = "show"
- [ ] (Optional: if the builder validates on every keystroke, the cycle may appear before you click Save)
- [ ] Click "Save" or "Publish"

**F2 — Verify cycle error toast**

- [ ] Verify a Sonner toast appears with title `Circular rule detected`
- [ ] Verify the toast body shows the cycle path (entity labels joined with `→`)
- [ ] Verify the Save/Publish did NOT complete (the cycle was rejected)

**F3 — CycleErrorBanner in PropertiesPanel**

- [ ] With the cycle still present, select the "Site type" or "Mitigation" entity in the builder
- [ ] Verify the CONDITIONAL LOGIC section shows a `CycleErrorBanner` inline error
- [ ] Verify the banner text contains the cycle path
- [ ] Verify the "Publish" button is disabled (tooltip: `Fix circular rules before publishing`)

**F4 — Remove one rule to break the cycle**

- [ ] In the "Site type" entity's CONDITIONAL LOGIC, delete the rule that references "Mitigation" (trash icon)
- [ ] Verify the `CycleErrorBanner` disappears from the PropertiesPanel
- [ ] Verify the "Publish" button becomes enabled again

**F — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section G — End-to-End Submit + answers_json Verification

*Tests the full submission pipeline with the smoke template: PAS 79 Intolerable + visible Mitigation + Commercial + Fire doors instances. Confirms the scrub contract in answers_json.*

**G1 — Fill the smoke template fully (Intolerable, Commercial, 2 doors)**

- [ ] Open the smoke template fill page
- [ ] Set "Site type" = "Commercial" (Fire doors section becomes visible)
- [ ] Set "Likelihood" = 5, "Consequence" = 5 (Intolerable, Mitigation appears)
- [ ] Fill "Mitigation" = "Full suppression system to be installed Q3"
- [ ] Add 2 fire door instances:
  - Instance 1: Door condition = Good (Repair urgency: leave empty — not required)
  - Instance 2: Door condition = Poor, Repair urgency = High
- [ ] Submit the form
- [ ] Verify success confirmation

**G2 — Confirm answers_json contains all visible entities**

- [ ] Locate the submission row (by navigation URL or Supabase query)
- [ ] Query:
  ```sql
  SELECT answers_json FROM form_submissions WHERE id = '<submission-id>';
  ```
- [ ] Verify "Mitigation" value is present (entity was visible at submit)
- [ ] Verify the repeatingSection instances array has 2 entries
- [ ] Instance 2 entry contains Door condition = "Poor" and Repair urgency = "High"

**G3 — Hidden entities absent from answers_json**

- [ ] Submit a second time with "Site type" = "Residential" (Fire doors section hidden)
- [ ] Query `answers_json` for that submission
- [ ] Verify the sectionGroup entity ID, repeatingSection entity ID, Door condition entity ID, and Repair urgency entity ID are ALL absent from the top-level keys (D-01 cascade strip)

**G — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section H — DB-Side answers_json Inspection (Optional)

*Optional DB-level verification using the Supabase dashboard or MCP tool. Augments the UI-level checks in Sections D-G.*

**H1 — Open Supabase Studio or use the MCP `execute_sql` tool**

- [ ] Via Supabase Studio (`https://app.supabase.com/project/lksxdpgkbiuorjdvebdz/editor`) or the supabase-888 MCP, run:
  ```sql
  SELECT id, answers_json, submitted_at
  FROM form_submissions
  ORDER BY submitted_at DESC
  LIMIT 3;
  ```

**H2 — Verify hidden-subtree scrub for Residential submission**

- [ ] For the submission where Site type = Residential, verify:
  - [ ] `answers_json` contains a key for `e_site_type` (the selectField was visible + filled)
  - [ ] `answers_json` does NOT contain a key for the sectionGroup entity ID (hidden → stripped)
  - [ ] `answers_json` does NOT contain a key for the repeatingSection or its children

**H3 — Verify Intolerable scrub for low-risk submission**

- [ ] For the submission where Likelihood=1, Consequence=1 (Trivial), verify:
  - [ ] `answers_json` does NOT contain a key for the Mitigation entity ID
  - [ ] `answers_json` DOES contain the Likelihood and Consequence keys (they were visible)

**H4 — Verify Intolerable submission with Mitigation**

- [ ] For the submission where Likelihood=5, Consequence=5 (Intolerable), verify:
  - [ ] `answers_json` contains the Mitigation key with a non-empty string value

> **Note:** Use the `supabase-888` MCP `execute_sql` tool for programmatic DB inspection, or the Supabase Studio SQL editor. The template and submission entity IDs are in 15-PUSH-LOG.md.

**H — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Sign-Off Table

| Section | Description | Result (PASS / FAIL / DEFERRED) | Tester initials | Date | Notes |
|---------|-------------|----------------------------------|-----------------|------|-------|
| A | Builder: ConditionalLogicSection + PropertiesPanel | | | | |
| B | Builder: Rule editing (add / edit / delete) | | | | |
| C | Fill flow: D-03 per-instance require (FRA doors) | | | | |
| D | Fill flow: D-01 cascade strip (Site type) | | | | |
| E | Fill flow: D-02 PAS 79 Mitigation show/hide | | | | |
| F | Cycle detection (builder UAT) | | | | |
| G | End-to-end submit + answers_json verification | | | | |
| H | DB-side answers_json inspection (optional) | | | | |

---

## Decision ID Traceability

Every Phase 15 decision from CONTEXT.md exercised by this UAT:

| Decision | Description | UAT Steps |
|----------|-------------|-----------|
| D-01 | Preserve on hide, drop on submit (cascade strip) | D2, D5, D6, G3, H2 |
| D-02 | computedField as rule source (PAS 79 → Mitigation) | E1–E5, G1, G2, H4 |
| D-03 | Same-scope + ancestor-scope rules; per-instance sibling | C3–C6, A4 |
| D-04 | Collapsible CONDITIONAL LOGIC section in PropertiesPanel | A2–A5 |
| D-05 | visibilityRules attribute shape | A2, A4, A5 |
| D-06 | Fixed operator set filtered by source type | A5, B1 |
| D-07 | Action set: show/hide/require; hide wins | D1, E1, F1 |
| D-08 | Cycle detection at save/publish time | F1–F4 |
| D-09 | Performance contract: dependency map | (implicit in reactivity tests E2, C4) |
| D-10 | Operator semantics: literal string comparison | C4, E2 |

---

## Known Deferred Items

These items are intentionally out of scope for Phase 15 and do NOT block sign-off:

1. **Cross-instance references** (D-03 exclusion): "hide Door 2's gap if Door 1's condition is Poor" — excluded by D-03, requires instance-picker UI. Deferred to a future phase.
2. **Customer-surface rule editor**: AGENTS.md mandates the form builder be reusable across admin + client. The conditional logic editor is implemented surface-agnostically. Full customer-surface testing deferred to Phase 16 (client fill surface).
3. **Fork-on-fill + conditional logic interaction**: When a customer forks Matt's template and adds rules, the forked template carries the rules. Interaction tested in Phase 15 only for admin-created templates. Customer fork flow is Phase 16+.
