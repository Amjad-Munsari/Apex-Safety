---
phase: 14
slug: custom-field-types
type: uat
created: 2026-05-26
status: pending
---

# Phase 14 — Manual UAT Script: Custom Field Types

> **Pre-condition:** All steps assume migration 011 is applied (Task 2 of Plan 14-08).
> Run `supabase db push` and confirm the "Specialty Fields Smoke Test" template exists in
> `form_templates` before starting. If any test fails, file as a gap-closure plan candidate.
> DO NOT mark Phase 14 complete until either all sections PASS or failures have an
> accepted-deferral note from the user.

---

## Pre-flight Checklist

Before starting any section, confirm all of these:

- [ ] Migration 011 applied — `SELECT name FROM form_templates WHERE name = 'Specialty Fields Smoke Test'` returns a row
- [ ] `npm run dev` (or `pnpm dev`) is running without errors
- [ ] Browser console is open (F12) on a fresh session — no pre-existing errors
- [ ] Signed in as admin (Matt or equivalent admin account)
- [ ] Chrome desktop available for STT steps (Sections B, C) — Safari iOS available for photo steps (Section C Step C4) via real device or BrowserStack

---

## Section A — Builder Palette + Properties Panel

*Tests that every Phase 14 specialty entity type appears in the builder palette, loads in the canvas, and surfaces the correct attribute editors in the properties panel.*

**A1 — Open the smoke template in the builder**

- [ ] Navigate to the admin templates list (`/admin/templates`)
- [ ] Locate "Specialty Fields Smoke Test" in the list
- [ ] Click to open the form builder
- [ ] Verify the canvas renders 11 root-level entity cards (site name, inspector notes, general observations, inspector signature, overall site safety rating, site condition photos, site GPS location, likelihood 1-5, consequence 1-5, PAS 79 risk level, fire doors register)
- [ ] Verify the "Fire doors register" repeatingSection card shows 3 indented child fields inside it (door location, door condition, gap mm) (D-01, D-02)

**A2 — Specialty palette section**

- [ ] Click the field palette (left panel)
- [ ] Confirm two labelled sections appear: "Basic Types" and "Specialty" (UI-SPEC §palette)
- [ ] Confirm "Basic Types" contains 7 buttons (Short Text, Long Text, Number, Date, Select, Checkbox, Section Group)
- [ ] Confirm "Specialty" contains 6 buttons: Signature, Rating, Multi-photo, Geolocation, Computed, Repeating Section (D-01)

**A3 — Add each specialty type from palette**

- [ ] Click "Signature" in the Specialty palette — confirm a signatureField card is added to the canvas
- [ ] Click "Rating" — confirm a ratingField card is added
- [ ] Click "Multi-photo" — confirm a multiPhotoField card is added
- [ ] Click "Geolocation" — confirm a geolocationField card is added
- [ ] Click "Computed" — confirm a computedField card is added
- [ ] Click "Repeating Section" — confirm a repeatingSection card is added

**A4 — Properties panel for each newly added specialty entity**

For each newly added entity from A3, select it on the canvas and verify the properties panel shows the correct attribute editors per UI-SPEC §"Properties Panel Extensions":

- [ ] **signatureField**: Label, Required toggle, Help Text, Attach Photos toggle
- [ ] **ratingField**: Label, Required toggle, Help Text, Max Rating (number input), Attach Photos toggle
- [ ] **multiPhotoField**: Label, Required toggle, Help Text, Max Photos (number input), Attach Photos toggle
- [ ] **geolocationField**: Label, Required toggle, Help Text, Attach Photos toggle
- [ ] **computedField**: Label, Formula (dropdown — "PAS 79"), Likelihood Input (entity selector), Consequence Input (entity selector), Attach Photos toggle — NO Required toggle (D-10)
- [ ] **repeatingSection**: Title, Description, Min Instances (number input), Max Instances (number input) — NO Attach Photos toggle (D-05)

**A5 — Computed field pre-populated inputs**

- [ ] Select the existing "PAS 79 risk level" computedField in the seeded template (not the newly added one from A3)
- [ ] Confirm the Formula field shows "PAS 79" (D-08)
- [ ] Confirm the Likelihood Input dropdown is pre-populated and "Likelihood (1-5)" is selected (D-09)
- [ ] Confirm the Consequence Input dropdown is pre-populated and "Consequence (1-5)" is selected (D-09)

**A6 — Repeating section pre-populated min/max**

- [ ] Select the existing "Fire doors register" repeatingSection
- [ ] Confirm Min Instances shows 1 and Max Instances shows 20 in the properties panel (D-03)

**A — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section B — Fill Flow, STT, and Signature

*Tests speech-to-text on text and textarea renderers, and the signature canvas upload flow.*

**B1 — Create assignment and open fill page**

- [ ] From `/admin/assessments/new`, create a new assignment using the "Specialty Fields Smoke Test" template against any client
- [ ] Confirm you land on the fill page with all fields visible
- [ ] Confirm the header progress bar starts at 0% (no required fields filled)

**B2 — STT on textField (D-14)**

- [ ] In the "Site name" field, type "Test Site Alpha" — confirm normal text input works
- [ ] Click the mic button (MicButton) on the "Inspector notes" field
- [ ] Speak: "The site is in good condition overall" — confirm the transcript appears appended to the text input (D-14, FORM-02)
- [ ] **Safari iOS:** If testing on Safari iOS, confirm the mic button shows a MicOff icon and a toast "Speech-to-text isn't available in this browser" (FORM-04)

**B3 — STT on textareaField (D-14)**

- [ ] Click the mic button on the "General observations" textarea (positioned bottom-right per UI-SPEC §textareaField)
- [ ] Speak a short sentence — confirm the transcript appears appended in the textarea
- [ ] Verify button is visually positioned at the bottom-right corner of the textarea frame (not inline with the label)

**B4 — Signature canvas + storage upload (D-16)**

- [ ] Click on the "Inspector signature" field
- [ ] Draw a signature on the canvas
- [ ] Click the "Done" / "Save" button
- [ ] Confirm a loading overlay or spinner appears briefly ("Saving signature...")
- [ ] Confirm the canvas transitions to a preview state showing the saved signature image
- [ ] Open Supabase Storage (admin panel → Storage → form-media bucket)
- [ ] Navigate to `form-media/{clientId}/signatures/{submissionId}/{fieldId}.png` — confirm the file exists
- [ ] Verify file extension is `.png` (D-16)

**B5 — field_media row created**

- [ ] Open Supabase Studio → `field_media` table
- [ ] Locate the row matching the submission and signature field
- [ ] Confirm `storage_path` matches the path verified in B4
- [ ] Confirm `media_type = 'image'`

**B — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section C — Rating, Multi-photo, and AttachPhotos Affordance

*Tests the star rating interaction contract, multi-photo upload pipeline (HEIC, EXIF, compression), and the per-field attachPhotos 📎 affordance.*

**C1 — Star rating interaction (UI-SPEC §ratingField)**

- [ ] Click the 4th star on "Overall site safety rating"
- [ ] Confirm score display shows "4 / 5"
- [ ] Click the 4th star again — confirm it deselects and shows "0 / 5" (re-click deselects; UI-SPEC contract)
- [ ] Click the 2nd star — confirm "2 / 5"
- [ ] Use keyboard arrow keys (left/right) to confirm WCAG keyboard navigation moves the selection

**C2 — attachPhotos affordance on rating field (D-05, D-06, FORM-05)**

- [ ] With the rating field rendered, confirm a 📎 "Attach Photo" affordance is visible below the field (not as a bottom-gallery)
- [ ] Click "+ Add Photo" on the rating field's affordance
- [ ] Pick a JPEG image from your filesystem
- [ ] Confirm a thumbnail appears in the affordance strip and the count badge updates to "1 attached"
- [ ] Confirm the photo uploads to `form-media/{clientId}/photos/{submissionId}/{fieldId}/{uuid}.jpg` (visible in Supabase Storage, D-17)

**C3 — Multi-photo grid (D-17)**

- [ ] Open the "Site condition photos" multiPhotoField
- [ ] Add 2 photos (any format on desktop)
- [ ] Confirm the photo grid renders 2 filled thumbnail cells + 1 "Add" cell
- [ ] Confirm a count below the grid shows "2 / 8"

**C4 — HEIC to JPEG conversion on iOS Safari (FORM-06)**

- [ ] On an iOS Safari real device (or BrowserStack), open the fill page
- [ ] On the "Site condition photos" field, tap "+ Add Photo" and select an HEIC photo from Photos app
- [ ] Confirm the photo uploads successfully (no error toast)
- [ ] In Supabase Storage, confirm the stored file is a `.jpg` (not `.heic`)
- [ ] Confirm file size is below 1.5 MB (check Storage metadata or browser Network tab)

**C5 — EXIF auto-rotation**

- [ ] Attach a known portrait-orientation photo (taken vertically with a phone camera) to any photo field
- [ ] Confirm the thumbnail in the grid displays in the correct upright orientation (not rotated 90 degrees sideways)
- [ ] If the photo renders sideways, mark this step FAIL and note the EXIF handling is broken

**C — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section D — Geolocation, Leaflet Map, Accuracy Badge

*Tests the geolocation capture flow, Leaflet OSM map, desktop accuracy badge, and click-to-pin affordance.*

**D1 — GPS capture on desktop (D-11)**

- [ ] Open "Site GPS location" on a desktop browser (Chrome or Firefox)
- [ ] Click the "Refresh" / "Capture location" button
- [ ] Confirm the browser prompts for geolocation permission; grant it
- [ ] Confirm the field transitions from a loading state to a success state showing lat/lng values and accuracy in metres

**D2 — Desktop accuracy badge (D-12)**

- [ ] After capture, confirm an amber-coloured "Desktop capture — verify pin on map" badge appears
- [ ] This badge should appear when (a) the user agent does not match mobile, OR (b) `accuracy > 100m`
- [ ] Confirm the badge text directs the user to verify the pin on the map below

**D3 — Leaflet map with OSM tiles (D-13)**

- [ ] Confirm the Leaflet map renders below the lat/lng display
- [ ] Confirm tiles are served from OpenStreetMap (check the tile URL in the Network tab — `tile.openstreetmap.org` or equivalent)
- [ ] Confirm a single marker is placed at the captured coordinates
- [ ] Confirm "© OpenStreetMap contributors" attribution is visible on the map

**D4 — Click-to-pin map interaction (D-13)**

- [ ] Click on a different location on the Leaflet map
- [ ] Confirm the marker moves to the clicked location
- [ ] Confirm the lat/lng display in the field header updates to match the new pin coordinates

**D5 — Mobile: no accuracy badge (D-12)**

- [ ] Open the fill page on a mobile browser (iOS Safari or Android Chrome) with a real GPS signal
- [ ] Capture location
- [ ] Confirm the amber desktop badge does NOT appear when accuracy is below 100m on a mobile UA
- [ ] (If accuracy is still > 100m due to poor signal, the badge correctly does appear — note the accuracy value)

**D — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section E — Computed PAS 79 Field + Reactive Recompute

*Tests the PAS 79 colour-banded badge and real-time reactivity when dependency fields change.*

**E1 — Trivial band (score 1)**

- [ ] Set "Likelihood (1-5)" to 1 and "Consequence (1-5)" to 1
- [ ] Verify the "PAS 79 risk level" computed badge shows score = 1 × 1 = 1
- [ ] Verify the label reads "Trivial" (or equivalent lowest-risk PAS 79 band)
- [ ] Verify the badge uses a **green** Tailwind class (e.g., `bg-green-100 text-green-900`) (D-10, UI-SPEC §computedField)

**E2 — Reactive update: change Likelihood**

- [ ] Change "Likelihood (1-5)" from 1 to 3 (Consequence still 1)
- [ ] Verify the badge updates **immediately** (no submit required) to score = 3 × 1 = 3
- [ ] Verify label corresponds to the PAS 79 band for score 3 (D-10)

**E3 — Amber band (score ~12)**

- [ ] Set Likelihood = 3, Consequence = 4 → score = 12
- [ ] Verify badge label is in the amber/moderate PAS 79 band
- [ ] Verify badge uses an **amber/yellow** Tailwind class (e.g., `bg-yellow-100 text-yellow-900`)

**E4 — Intolerable band (score 20)**

- [ ] Set Likelihood = 5, Consequence = 4 → score = 20
- [ ] Verify badge label is "Intolerable" (score 17-25 per PAS 79)
- [ ] Verify badge uses a **red** Tailwind class (e.g., `bg-red-100 text-red-900`) (D-10, UI-SPEC)

**E5 — Pending pill when inputs empty**

- [ ] Clear "Consequence (1-5)" (delete the value, leave blank)
- [ ] Verify the computed field shows a pending pill: "Fill in likelihood and consequence fields above to compute risk." (or equivalent) — not a score badge
- [ ] Verify no error is thrown (the field gracefully handles missing inputs)

**E6 — PAS 79 boundary validation by Matt (OPTIONAL — does not block Phase 14 close-out)**

- [ ] Matt should independently verify 5 sampled (Likelihood, Consequence) combinations against his BSI PAS 79-1:2020 reference copy
- [ ] Suggested sample: (1,1), (2,3), (3,3), (4,4), (5,5)
- [ ] If any boundary differs from the standard, file as a follow-up — mark this step "Pending Matt validation" and proceed

> **Note on Assumption A1:** The PAS 79 risk bands implemented in `lib/form-builder/pas79.ts` were derived from the published matrix during Phase 14 research. If Matt's copy shows different thresholds, this does NOT block Phase 14 close-out — file as a gap-closure item.

**E — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section F — RepeatingSection FRA-Doors Scenario

*Tests the canonical fire-doors use case: add/remove instances, validate min/max, and confirm D-04 storage contract in answers_json.*

**F1 — Empty state**

- [ ] Scroll to "Fire doors register" (D-01)
- [ ] Verify the section heading "Fire doors register" is visible
- [ ] Verify the empty state shows 0 instance cards
- [ ] Verify an "+ Add Fire doors register" button (or equivalent add-instance button) is present (D-03)

**F2 — Add 3 instances**

- [ ] Click "Add" 3 times
- [ ] Verify 3 instance cards appear, each numbered # 1, # 2, # 3
- [ ] Verify each card contains the 3 child inputs: "Door location" (textField), "Door condition" (selectField), "Gap (mm)" (numberField) (D-02)

**F3 — Fill all 3 instances**

- [ ] Instance 1: Door location = "Main entrance", Door condition = "Good", Gap = 4
- [ ] Instance 2: Door location = "Stairwell A", Door condition = "Marginal", Gap = 6
- [ ] Instance 3: Door location = "Server room", Door condition = "Poor", Gap = 12
- [ ] Confirm all child inputs accept the values without errors

**F4 — Collapse/expand an instance (D-03)**

- [ ] Click the chevron/collapse button on Instance 2
- [ ] Verify the instance body (child inputs) hides — only the instance header ("# 2") remains visible
- [ ] Click the chevron again — verify the body re-expands and values are preserved

**F5 — Remove an instance (D-03)**

- [ ] Click "Remove" on Instance 2
- [ ] Verify it disappears from the list
- [ ] Verify the remaining 2 cards renumber to # 1 and # 2
- [ ] Confirm Instance 1 still shows "Main entrance" and Instance 2 (formerly Instance 3) shows "Server room"

**F6 — Re-add the removed instance**

- [ ] Click "Add" once more
- [ ] Fill the new instance: Door location = "Back corridor", Door condition = "Marginal", Gap = 8
- [ ] Continue to F7

**F7 — Maximum instances guard (D-03)**

- [ ] Add instances until you have reached 19 total (or set the count to near-maximum)
- [ ] Try to click "Add" when the count is at 20
- [ ] Verify the Add button is disabled or shows the message "Maximum 20 instances reached." (maxInstances=20)

**F8 — Minimum instances validation**

- [ ] Remove all instances (bring count to 0)
- [ ] Attempt to submit the form (click the Submit button in the header)
- [ ] Verify a validation error appears: "Fire doors register requires at least 1 instance." (minInstances=1, D-04)
- [ ] Verify the submit is prevented

**F9 — D-04 answers_json storage contract**

- [ ] Re-add at least 2 instances; fill them
- [ ] Submit the form (proceed past any other validation errors — fill required fields minimally)
- [ ] Open Supabase Studio → `form_submissions` table → locate the submitted row
- [ ] Expand `answers_json`
- [ ] Verify the repeatingSection entity ID appears as a top-level key in answers_json
- [ ] Verify the value has shape: `{ "instances": [ { "<childEntityId>": <value>, ... }, ... ] }`
- [ ] Verify the instances array length matches the number of instances filled (D-04)
- [ ] Verify each instance object uses entity IDs as keys (not human-readable labels)

**F — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section G — Submit + AI Report Draft

*Tests the full submission pipeline: post-submit AI draft generation, repeatingSection expansion in the prompt, and PAS 79 score inclusion.*

**G1 — Full submission**

- [ ] Fill all required fields across all sections (at minimum: Site name, Inspector signature, Overall site safety rating, Site GPS location, Likelihood, Consequence, and at least 1 Fire doors register instance)
- [ ] Click the Submit button in the header
- [ ] Confirm a success toast ("Assessment submitted" or similar)
- [ ] Confirm navigation to the assessment review page or client page

**G2 — AI draft populated (after() background job)**

- [ ] Wait 10-30 seconds after submit for the after() background job to run
- [ ] Open (or refresh) `/admin/assessments/[id]/review`
- [ ] Verify the AI draft section is populated (executive summary + hazards list) — not a "Draft not yet generated" placeholder

**G3 — Door locations appear in draft (expandRepeatingSections, Plan 14-03)**

- [ ] Verify the AI draft contains references to the door locations filled in Section F
- [ ] Specifically, "Main entrance" and "Server room" (or equivalent from your F3/F6 data) should appear as hazard location strings or within the executive summary
- [ ] This confirms `expandRepeatingSections()` correctly flattened the `instances[]` into the AI prompt
- [ ] If all 3 door locations are absent from the draft, mark this step FAIL — it indicates the AI prompt builder did not traverse the repeatingSection

**G4 — PAS 79 risk score in draft**

- [ ] Verify the AI draft references the PAS 79 computed risk level (e.g., "Substantial", "Intolerable", or the score number)
- [ ] The computedField value should flow into the AI prompt as part of answers_json

**G5 — AttachPhotos reload behaviour (ACCEPTED DEFERRAL)**

- [ ] Before submitting in G1, attach at least 1 photo to the rating field's 📎 affordance (Section C Step C2)
- [ ] After the photo attaches, reload the browser tab
- [ ] Verify the photo thumbnail strip now shows 0 attached photos (expected — session-local rehydration is deferred)
- [ ] Open Supabase Studio → `field_media` → confirm the row still exists with the correct storage_path
- [ ] **Mark this step PASS with note:** "Reload-empty behaviour confirmed. Rehydration of attachPhotos strips on page reload is deferred to Phase 16+ (client-surface fill plan). field_media rows persist correctly in the DB."

**G — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Section H — Carry-Forward Regression

*Tests that Phase 13 "Basic Types Smoke Test" functionality is unbroken after Phase 14 changes.*

**H1 — Basic Types Smoke Test loads in builder**

- [ ] Navigate to admin templates list
- [ ] Open the "Basic Types Smoke Test" template (seeded in migration 010)
- [ ] Verify the form builder opens without JavaScript errors in the console
- [ ] Verify the canvas renders the 7 Phase 13 entities (sectionGroup + 6 others)
- [ ] Verify the sectionGroup still contains its nested textField child (backwards compat for Phase 13 coltorapps parent/child pattern)

**H2 — Fill and submit Basic Types template**

- [ ] From `/admin/assessments/new`, create an assignment for the Basic Types Smoke Test template
- [ ] Fill all required fields (Name in section, Inspection Date, Risk Level, Confirmed by assessor)
- [ ] Submit the form
- [ ] Verify the submit succeeds without errors
- [ ] Verify an AI draft is generated (as in G2)
- [ ] Confirm no regression vs Phase 13 behaviour (no focus loss, no select "uncontrolled to controlled" warning)

**H — RESULT:** [ ] PASS  [ ] FAIL  Notes: ___

---

## Sign-Off Table

| Section | Description | Result (PASS / FAIL / DEFERRED) | Tester initials | Date | Notes |
|---------|-------------|----------------------------------|-----------------|------|-------|
| A | Builder palette + properties panel | | | | |
| B | Fill flow, STT, signature upload | | | | |
| C | Rating, multi-photo, HEIC, attachPhotos | | | | |
| D | Geolocation, Leaflet map, accuracy badge | | | | |
| E | Computed PAS 79 banding + reactivity | | | | |
| F | RepeatingSection FRA-doors scenario | | | | |
| G | Submit + AI report draft | | | | |
| H | Carry-forward Phase 13 regression | | | | |

---

## Decision ID Traceability

Every Phase 14 decision from CONTEXT.md exercised by this UAT:

| Decision | Description | UAT Steps |
|----------|-------------|-----------|
| D-01 | repeatingSection as new entity type | A1, A2, A3, F1 |
| D-02 | Template children at fill time | A1, F2, F3 |
| D-03 | Min/max instances, collapse, remove | F4, F5, F7, F8 |
| D-04 | answers_json instances[] storage contract | F9 |
| D-05 | attachPhotos boolean attribute | A4, C2, G5 |
| D-06 | attachPhotos 📎 affordance (not bottom-gallery) | C2 |
| D-07 | Hardcoded PAS 79 formula | E1..E5 |
| D-08 | formula="pas79" string enum | A5 |
| D-09 | computedInputs entity ID mapping | A5 |
| D-10 | Read-only computed, colour banding | A4, E1..E5 |
| D-11 | geolocation on every device | D1 |
| D-12 | Desktop accuracy badge | D2, D5 |
| D-13 | Click-to-pin + Leaflet OSM | D3, D4 |
| D-14 | STT on text + textarea (en-GB) | B2, B3 |
| D-15 | Single form-media bucket (not form-signatures) | B4 |
| D-16 | Signature → form-media/{client}/signatures/... PNG | B4, B5 |
| D-17 | Photos → form-media/{client}/photos/... JPEG | C2, C3, C4 |

---

## Known Deferred Items

These items are intentionally out of scope for Phase 14 and do NOT block sign-off:

1. **G5 — AttachPhotos reload hydration:** Photo thumbnails disappear on page reload because the fill-page state is session-local. The `field_media` rows persist. Deferred to Phase 16+ (client-surface fill plan). Documented in `attach-photos-affordance.tsx` JSDoc.

2. **E6 — PAS 79 boundary validation:** Matt's independent cross-check of the colour bands against BSI PAS 79-1:2020. Does not block Phase 14 close-out — file as a follow-up if bands differ.

3. **Per-photo text labels (FORM-07):** `field_media` has no caption column; not implemented in Phase 14. Deferred until customer requests it.
