# Admin-only UAT batch — checklist (resume 2026-06-03)

Run against **production**. Tick each box, jot pass/fail + notes inline, then report the list back.
Original test numbers kept (no renumber). Client-dependent tests (28, 29–32, 47–49) were removed.

Flags: 🚫 = blocked on n8n (skip until reactivated)  ·  ⏸ = deferred sub-item

---

## AI Proposals (Phase 9)

- [ ] **27. AI proposal draft (prod AI key gate)**
  - Open a proposal in the wizard; reach the "draft scope" step.
  - Trigger `draftProposalScope` (the AI draft action).
  - Verify: real AI-generated text (not canned/placeholder); reads like a genuine scope for the selected services.
  - Verify: uses the live OpenRouter key — identical boilerplate every time = fail.
  - Result:

---

## Form Builder Foundation (Phase 13) — ⚠️ creates data

- [ ] **33. Three-panel builder + 7 basic field types**
  - Open the builder (palette / canvas / properties).
  - Add each: text, number, date, select, textarea, checkbox, sectionGroup.
  - Verify: all 7 drop onto the canvas and are configurable.
  - Result:

- [ ] **34. Drag-drop reorder + section reparenting**
  - Reorder fields on the canvas (dnd-kit drag).
  - Drag a field into a sectionGroup, then out again.
  - Verify: order persists; reparenting works both directions.
  - Result:

- [ ] **35. Immutable versioning on save**
  - Save → note the version. Make a change and save again.
  - Verify: a new `template_versions` row is created; the prior version is unchanged.
  - Result:

- [ ] **36. Fill + submit a built form (version pinning)**
  - Open in the interpreter, fill, submit.
  - Verify: submission succeeds and is pinned to the exact `version_id` it was filled against.
  - Result:

- [ ] **37. Historical submission renders against original schema**
  - Edit the template (new version) AFTER the test-36 submission.
  - Re-open that older submission.
  - Verify: renders against its ORIGINAL schema, not the latest.
  - Result:

---

## Custom Field Types (Phase 14)

- [ ] **38. All 6 specialty fields build + render**
  - Add each: signature, rating, multi-photo, geolocation, repeating-section, computed.
  - Configure, save, open in the interpreter.
  - Verify: all 6 render correctly in both builder and interpreter.
  - Result:

- [ ] **39. Signature PNG + geolocation map + repeating bounds**
  - Sign → verify stored as PNG.
  - Geolocation → verify lat/lng captured on the Leaflet map (try mobile if possible).
  - Repeating section → verify min/max instance bounds enforced.
  - Result:

- [ ] **40. Computed PAS 79 risk band**
  - Fill likelihood × consequence inputs.
  - Verify: correct PAS 79 risk level with standard colour coding.
  - Result:

- [ ] **41. Per-field photo attach (attachPhotos)**
  - Toggle `attachPhotos` on a NON-photo field (e.g. text).
  - Verify: photo attachment becomes available on that field type too.
  - Result:

---

## Conditional Logic (Phase 15)

- [x] **42. Builder condition UI — show/hide/require rules**
  - Add a visibility rule: source field, operator, value, action (show/hide/require).
  - Verify: operators filter by source type; `isEmpty`/`isNotEmpty` hides the value input WITHOUT layout reflow.
  - Result: PASS — operators filter by source type (text→contains, numeric→>/<); is empty/is not empty hides value input without reflow. Note: `contains` only appears when an OTHER text field is the source (host excluded from its own source list). Select sources now offer a value dropdown of their options (fix this session).

- [x] **43. Runtime show / hide / require**
  - Fill the source field at runtime.
  - Verify: dependent field shows / hides / becomes required as configured.
  - Verify: hide wins over show; hiding a parent cascades to children.
  - Result: PASS — show/hide/require all behave at runtime; hide wins over show; hiding a section cascades to its child. Required this session: enabling conditional logic on sections (so cascade is reachable), child-selection fix in sections, select label display fix.

- [x] **44. Circular-dependency detection**
  - Create a rule cycle (A → B → A).
  - Verify: cycle banner appears ("Circular rule: A → B"); save is REJECTED.
  - Create an out-of-scope reference → verify a scope-error banner.
  - Result: PASS — A→B→A cycle rejected with toast + banner; root-references-inside-repeating scope error rejected with "Invalid rule scope" toast + banner on the consumer field. Required this session: repeating-section child nesting in the builder, drag-crash hardening, incomplete-rule pruning, clear schema-error messages, default labels/titles on new entities.

- [x] **45. Hidden answers scrubbed server-side**
  - Fill a field, then hide it via a rule, then submit.
  - Verify: the hidden field's answer is NOT persisted and never reaches the AI report prompt (server-side scrub).
  - Result: PASS — verified at DB level. Submission for The Steel City Hotel (2026-06-04 20:25) stored answers_json with only the "Has hazard?"=yes key; the hidden "Hazard details" value (SECRET-SCRUB-TEST) was entirely absent (key gone, not null). stripHiddenAnswers in submitAssessmentAction confirmed working.

---

## Multi-Tenancy (Phase 16) — ⚠️ creates data
*(deleted_at schema drift fixed in migrations 018/019 — this exercises the fix)*

- [ ] **46. Admin assigns a template to a client**
  - As admin, assign a published master template to a specific client.
  - Verify: assignment succeeds and appears (picker now populates — the 018 fix).
  - Result:

---

## Assignment Scheduling + Notifications (Phase 17)

- [ ] **50. Recurring assignment auto-generates**
  - Create a recurring assignment whose schedule is due.
  - Verify: the next occurrence auto-creates on schedule.
  - Result:

- [ ] **51. Due-date status + overdue pill**
  - View assignments with varied due dates (incl. one overdue, one with no due date).
  - Verify: sort by `due_date` ascending, nulls last.
  - Verify: overdue one shows the overdue pill; admin gets a tooltip (client surface does not).
  - Result:

- [ ] **52. 🚫 Reminder notifications (7d / 1d / overdue) deduped — BLOCKED on n8n**
  - (When n8n is back) confirm reminders at 7-day, 1-day, overdue marks, each sent once.
  - Skip for now — record as still-blocked.
  - Result:

---

## FRA Seed Template (Phase 18) — the real form, end-to-end

- [ ] **53. Seeded Blank FRA (Type 3) exists & is published**
  - Find Matt's real FRA Type 3 template (migration 016).
  - Verify: present, published, full 30-entity schema intact.
  - Result:

- [ ] **54. Fill the real FRA end-to-end**
  - Work through: conditional sections, PAS 79 risk matrix, Action Plan repeating section, signature, geolocation, photo fields.
  - Verify: fills and submits successfully.
  - ⏸ Also re-judge test 20 (draft quality) with this real FRA draft.
  - Result:

- [ ] **55. Real FRA submit → report webhook + AI pipeline** (webhook half 🚫 n8n)
  - Submit the seeded FRA.
  - Verify (should work): AI draft pipeline runs; a draft lands in the review queue.
  - Verify (🚫 blocked): n8n report webhook fires — note it, don't fail the test on it.
  - Result:
