---
status: testing
phase: E2E (all shipped phases — Modules 2 & 4 + Form Builder)
scope: full start-to-finish manual verification
environment: production (Vercel + live OpenRouter/n8n/Supabase/email delivery)
depth: exhaustive
source:
  - phases 04-07, 09-18 SUMMARY.md files
  - .planning/phases/07-ai-report-pipeline/07-VERIFICATION.md (5 human_needed items)
started: 2026-06-01
updated: 2026-06-02
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: DONE
name: "Admin batch complete"
expected: |
  ADMIN BATCH COMPLETE (2026-06-05). All admin-side tests pass except the
  n8n-blocked items. Tests 53, 54, 55 PASS (real FRA end-to-end: fill →
  submit → AI draft in review queue). Deferred test 20 (draft quality) also
  PASS, judged against the real FRA draft. Only outstanding: tests 9, 22, 52
  (all blocked on n8n demo/subscription) + the webhook half of 55. The 8
  client-dependent tests (28, 29-32, 47-49) remain removed for a later
  client-portal pass.
awaiting: n8n reactivation to close 9/22/52, OR a client-portal pass for the removed tests

## Resume notes (paused 2026-06-02 — resume 2026-06-03)
- MODE: batch, ADMIN-ONLY. Client-dependent tests (28, 29-32, 47-49) REMOVED 2026-06-03 — finishing the admin side first; revisit the client portal later. Remaining admin batch: 27, 33-46, 50-55 (original numbers kept, not renumbered).
- Tests 24, 25, 26 PASS (prev session). Don't re-present the batch one-by-one — wait for the user's results list, then record + dig into issues.
- Done this session: test 24 (workflow_errors display, pass) + workflow-error UI (sidebar nav, dashboard View Log, month-summary dropdown — commit f348da0). Tests 25/26 (proposal service-selection + pricing, pass) + proposal-header polish (commit 266ba88). Both pushed to origin/main.
- Still-blocked (n8n demo/subscription): tests 9 + 22 (already recorded), and test 52 (reminders). Re-run once n8n is reactivated. Test 55's webhook half may also hit this — but its AI-draft half should still run.
- Deferred: test 20 (draft quality) — re-judge with a real FRA draft during tests 53-55.
- Watch-item: field_media.transcript drift (Phase-7 "migration 017" never applied to prod) — see Observations.
- Decided (don't re-litigate): 16 services soft-deleted 2026-05-12 are kept as-is — see Observations (test 25).

## Tests

### A. Platform boot & admin auth

### 1. Cold Start — production app loads
expected: Open the prod URL in a fresh/incognito session. App loads, admin login page renders cleanly — no 500, no blank screen, no unstyled flash.
result: pass

### 2. Admin login
expected: Log in as Matt (admin). You land on /admin dashboard. Session persists on refresh.
result: pass

### B. Admin dashboard (Phases 10 & 12)

### 3. Dashboard cards show live data
expected: /admin dashboard cards (compliance summary, expiry panel, review-queue count) render real numbers from Supabase — not placeholders, zeros-everywhere, or "—" unless genuinely empty.
result: pass

### 4. Sidebar nav + theming
expected: Sidebar hover states and dropdown theming work; every nav link routes to a live page (no dead links, no crash).
result: pass

### C. Client management

### 5. Clients list
expected: /admin/clients lists the 8 Sheffield demo clients with their distinct placeholder contact emails.
result: pass

### 6. Client detail page (regression — the adminClient crash fix)
expected: Open /admin/clients/[id]. Page renders without the prior Server Components crash; shows client info, document list, and assessment history.
result: pass

### D. Document upload + notifications (Phase 5) — CREATES DATA + SENDS EMAIL

### 7. Upload a document on the client page
expected: From /admin/clients/[id], upload a file. It lands in the `documents` bucket and appears in the client's document list immediately.
result: pass

### 8. Upload modal also on /admin/compliance
expected: The same document-upload modal is reachable from /admin/compliance (not only the client page).
result: pass
note: "Modal is reachable AND (after fix) uploaded undated docs now render. Root cause was the undated-bucket bug (see gap, root_cause corrected). FIXED + verified by user on prod. Also added a 'No Expiry Date' filter tab on request (commit b99da4a)."
original_report: "The document looks like it is uploaded but there is an issue. The numbers show that it uploaded, but I can't see the actual document. → root cause: undated docs rendered in no table."

### 9. Client notified on upload (n8n → contact email)
expected: Uploading a document triggers an immediate notification email to the client via n8n; a `notifications_sent` row is written; the email arrives in the recipient inbox.
result: blocked
blocked_by: third-party
reason: "Emails are currently in demo mode and the n8n subscription needs to be renewed. Live email delivery cannot be exercised until n8n is reactivated."

### 10. Expiry alerts cron (30/14/7-day)
expected: A document with an expiry date surfaces on the expiry panel; the daily cron (/api/cron/expiry, 06:00 UTC) dispatches 30/14/7-day alerts once each (deduped via notifications_sent). Verify either by a near-expiry doc or by inspecting the last cron run.
result: pass
note: "Verified the /admin/expiries surface lists expiring docs correctly. Email-dispatch half deferred (n8n blocked, see test 9). ENHANCEMENT requested + done locally: added an 'Expiries' item to the admin sidebar (components/app-sidebar.tsx) — typechecks clean, pending commit/push."

### E. Compliance dashboard (Phase 4 admin side)

### 11. Compliance RAG + manual reminder dispatch
expected: /admin/compliance shows RAG (red/amber/green) status rows; rows are actionable; a manual reminder can be dispatched and is recorded.
result: pass

### F. Assessment workflow (Phase 6) — CREATES DATA

### 12. Open an FRA against a client
expected: Start an FRA — both the assigned flow and the on-site "unassigned" flow let you open a fresh assessment against a chosen client.
result: pass
note: "Both flows now work after migration 018 (deleted_at). On-site /admin/assessments/new always worked; assign-to-client now populates and assigns successfully (user confirmed). User flagged the assign UI needs polish — see cosmetic gap (test 12-ui)."

### 13. Speech-to-text on text fields
expected: The mic affordance on text/textarea fields dictates speech to text (Web Speech API, en-GB); a text-input fallback is always available.
result: pass

### 14. Photo capture + compression
expected: Attach photos (incl. an iPhone HEIC); EXIF is read, image compresses to ~1.2–1.5 MB, and lands in the `form-media` bucket.
result: pass

### 15. Autosave persists (regression — the silent-autosave fix)
expected: As you fill fields, "Saving… → Saved" reflects a real persisted write (through adminClient). Reload the page mid-fill — your answers, including the "anything else" field, are still there.
result: pass
note: "Was a blocker (Phase-13 coltorapps migration dropped main-form autosave + rehydration). FIXED across commits 8a747f8 (autosave + rehydrate) and af683dc (initial progress on mount). User verified on prod: (1) main fields persist on reload, (2) completeness bar correct after refresh, (3) typing focus not lost. See gap for full root cause + the pre-existing submit-drops-appendix observation."

### 16. Submit the assessment
expected: Submitting flips the assessment to `submitted` and kicks off the AI report pipeline (next section).
result: pass

### G. AI report pipeline (Phase 7) — the 5 human_needed items, LIVE

### 17. [VERIFY-1] End-to-end AI draft generation
expected: Within ~30s of submit, an AI draft populates and status flips to `draft_ready_for_review` (real OpenRouter + Supabase + n8n stack).
result: pass
note: "Live OpenRouter draft generated on prod; status flipped to draft_ready_for_review. First of the 5 previously-human_needed Phase-7 items verified live."

### 18. Review queue shows the draft
expected: /admin/review-queue lists the new item as `draft_ready_for_review`.
result: pass
note: "Queue works correctly. User saw cards but not their just-worked assessment (b7027dea) — because it is already status=completed and has correctly left the queue (queue filters status=draft_ready_for_review). Verified 6 real drafts ARE listed + join resolves. Not a bug."

### 19. [VERIFY-3] Review page — raw-answers panel auto-expand (D-04)
expected: The review page renders the raw STT/answers panel alongside the editable draft. The raw panel auto-opens the first time you visit a freshly-generated draft, and collapses cleanly on re-visit once a report is stored.
result: pass

### 20. [VERIFY-2] Draft quality (Matt's judgment)
expected: Draft tone matches your authoring style; no invented hazards; severities calibrated against the YELLOW BROOM reference.
result: pass
note: "PASS on re-judge (2026-06-05) — judged against the real FRA draft produced in test 55 (was skipped earlier for lack of a realistic FRA). User accepted the draft quality: tone/severities acceptable, no invented hazards flagged."

### 21. Approve → branded PDF in reports bucket
expected: Approving produces a branded PDF stored in the `reports` bucket; status advances to completed.
result: pass
note: "Approve generated a branded PDF in reports bucket + status completed; non-blocking email-failed toast as expected (n8n down, D-08 no-rollback honoured)."

### 22. [VERIFY-4] Delivery email + 7-day signed URL
expected: Client receives an email (subject "Your Fire Risk Assessment is ready — {client_name}") via n8n; the body link is a working Supabase signed URL that opens the PDF in a fresh, unauthenticated browser session.
result: blocked
blocked_by: third-party
reason: "n8n email blocked (demo/subscription) — same gate as test 9. User opted to skip. PDF generation + Matt download verified in test 21; the n8n email send + 7-day signed-URL open by an unauthenticated recipient cannot be exercised until n8n is reactivated."

### 23. Regenerate / edit draft paths
expected: From the review page you can edit the draft inline and trigger a manual regenerate; both behave correctly.
result: pass
note: "Edit + regenerate both work. User found regenerated draft only appeared after a manual refresh — useState(draft) seeded at mount, router.refresh() did not re-seed it. FIXED (commit 71901ce): generateReportDraft returns the draft; handleGenerate setDraft() updates local state immediately. CODE change → needs deploy + re-verify."

### 24. [VERIFY-5] workflow_errors row on /admin/month-summary (D-11c)
expected: Force a failure (e.g. temporarily invalid OPENROUTER_API_KEY) → /admin/month-summary lists a row: workflow_name='ai_report_draft', truncated error message, severity pill 'high', deep-link to the review page, and an en-GB timestamp. (Skip if you don't want to break a live key — mark skip.)
result: pass
note: "Verified the display against the 3 existing in-month report_delivery_email rows (DB-confirmed created 2026-06-01): count card shows 3 (red), table lists workflow_name (mono), truncated 'webhook returned 404' message, 'high' severity pill in red, en-GB timestamps. Deep-link sub-criterion NOT exercised by data — report_delivery_email payloads carry no submission_id (Submission col correctly shows '—'); would need an ai_report_draft failure (break the key) to test the live link. Not broken, just untested-by-data. ENHANCEMENTS shipped this session (see Enhancements): row-expand dropdown on the Month Summary errors table (full message + payload details + 'Open assessment review' link when submission_id present); dashboard '07 Workflow errors' card simplified to plain rows + a single 'View Log' button; sidebar 'Workflow Errors' + 'Month Summary' nav entries added; dashboard '08 This month' card 'View full summary' footer link. CODE change → needs deploy."

### H. Proposal pipeline (Phase 9) — CREATES DATA

### 25. Proposal builder — service selection
expected: The 4-step proposal wizard reads the live `services` catalog (3 Monthly Packages, 10 Services, 25 Training courses).
result: pass
note: "Wizard reads live from DB via fetchActiveServices() (services-server.ts) — deleted_at null + active filter; no hardcoded item list. Shows 38 live items = 3 Monthly Packages / 10 Services / 25 Training courses (matches the doc estimate). FINDING (see Observations): 16 rows soft-deleted in a single bulk op on 2026-05-12 — 13 legit unique offerings (FRA Type 1/3/4, Site Risk, Consulting Retainers 5/10/20h, 6 training courses) with NO live namesake, plus 2 genuine dedupes (PAT Testing, Emergency First Aid) and 1 test row. User DECISION 2026-06-02: keep the catalog as-is, do NOT restore — wizard loading from DB correctly is what matters. Latent code issue left as-is too (SERVICE_CATEGORIES hardcoded to 3 categories in lib/data/services.ts; would mis-bucket FRA/Testing categories under 'Services' IF ever restored)."

### 26. Pricing — overrides + VAT-inclusive total + save draft
expected: You can override per-line prices (incl. NULL "quote on request" items); the total is VAT-inclusive; save-as-draft works; draft can be deleted (hard delete).
result: pass
note: "User verified on localhost: per-line overrides (incl. quote-on-request NULL items), VAT-inclusive total, save-as-draft and hard delete all work. UI polish shipped during this test: removed redundant '888 SAFETY SOLUTIONS · PROPOSALS' header brand, widened stepper spacing + restored step labels (collapse to numbers <1024px), left-aligned the stepper (proposals.css + advanced-proposal-builder.tsx). CODE change → needs deploy."

### 27. AI proposal draft (prod AI key gate)
expected: draftProposalScope produces an AI draft in prod (real key). If the key were missing it would throw a clear actionable error rather than ship canned text.
result: pass
note: "PASS on re-verify (2026-06-05) after dev-server restart. Was a stale-env artifact, not a code bug — draftProposalScope returns canned text ONLY when process.env.OPENROUTER_API_KEY is falsy (dev fallback); the key was in .env.local but the dev server was started before it was added (env vars not hot-reloaded). Restarting `npm run dev` loaded the key and a real AI draft generated. No code change."

### J. Form builder foundation (Phase 13) — CREATES DATA

### 33. Three-panel builder + 7 basic field types
expected: The builder (palette / canvas / properties) lets you add all 7 basic entities: text, number, date, select, textarea, checkbox, sectionGroup.
result: pass
note: "User verified (2026-06-03)."

### 34. Drag-drop reorder + section reparenting
expected: dnd-kit reordering works on the canvas, and you can reparent a field into/out of a sectionGroup.
result: pass_with_issues
note: "User (2026-06-03): reorder + reparent work, but two drag-drop issues to fix (DEFERRED until batch done):
  (1) Can't drop a field BEFORE/in-front-of a section — dropping just above a section drops it INSIDE the section instead of placing it as a sibling above. Need a drop zone for 'sibling before the section'.
  (2) No visual hint while dragging that the item will land INSIDE a section — the section gives no highlight/indicator on hover-to-nest. Need a drop-inside affordance (e.g. highlight the section body / insertion indicator).
  (3) Sections should be draggable from the WHOLE box, not just the left side — extend the section's drag handle to the full header/box."
resolution: "IMPLEMENTED 2026-06-03 (commit pending) in components/form-builder/{builder-canvas,section-card}.tsx. (1) Before-section: handleDragEnd no longer force-nests on any drop onto a section. Nesting now happens ONLY via the section's inner 'Drop fields here' zone (a dedicated useDroppable, id `secdrop:<id>`); dropping on the section card itself reorders it as a root sibling, so a field can land before a section. (2) Visual hint: that inner droppable highlights (teal border+bg, 'Drop fields here' turns teal) while a drag is over it (isOver) — fixes the dead overSectionId state that was computed but never wired to UI. (3) Whole-box drag: the section HEADER ROW is now the drag handle (not just the grip); children keep their own handles in the inner zone so their drags aren't captured; action buttons stopPropagation on pointerdown. NOTE: 'whole box' = the header (the child drop-zone can't also be a drag handle without breaking nested child reordering). NEEDS interactive re-verify by user (drag UX can't be unit-verified); expect possible iteration on collision feel."
final: "ACCEPTED by user 2026-06-03 ('fine for now'). Final impl in builder-canvas.tsx + section-card.tsx: (a) custom pointer-first collision with overlap-threshold reorder — 70% fields / 90% sections (whole section incl. its drop-zone counts); a field never sibling-reorders against a section (nesting only). (b) fields nest via the section's inner zone (highlights teal). (c) a single FLAT SortableContext over root items + section children so native sibling-shift works ACROSS containers — dragging a field OUT of a section now shifts the root list like any reorder. (d) section header row is the drag handle. A teal insertion-line / no-shift variant was tried then reverted per user preference for the native shift. All debug instrumentation removed."

### 35. Immutable versioning on save
expected: Saving creates a `template_versions` row; re-saving creates the NEXT version without mutating the prior one.
result: pass
note: "User verified (2026-06-03)."

### 36. Fill + submit a built form (version pinning)
expected: You can fill and submit the built form via the interpreter; the submission is pinned to the exact version_id it was filled against.
result: pass
note: "User verified (2026-06-03)."

### 37. Historical submission renders against original schema
expected: After editing the template (new version), an older submission still renders against its ORIGINAL schema, not the latest.
result: pass
note: "PASS on re-verify (2026-06-05) after dev-server restart. The 404 was a stale-dev-server artifact (consistent with test 27's stale-env finding) — current code+data don't reproduce it: the 'View Report' link targets /admin/assessments/{id}/review (route exists, returns 307→login for unauth probes), and all 3 completed form_submissions have valid ids + existing pinned template_versions, so the review page's notFound() can't fire for an authed admin. After restart the historical submission renders against its original schema. No code change."

### K. Custom field types (Phase 14)

### 38. All 6 specialty fields build + render
expected: Signature, rating, multi-photo, geolocation, repeating-section, and computed fields each drag in, configure, save, and render in both builder and interpreter.
result: pass
note: "User verified (2026-06-04). SCOPE CHANGE: signatureField + ratingField were REMOVED 2026-06-04 at user request (commit 09b3247), so only the 4 remaining specialty types (multi-photo, geolocation, computed, repeating-section) were tested + pass. Also fixed during this block: specialty field cards showed raw type names (8bd70dd → friendly names) and the repeating-section card showed '(no label)' (now falls back to its Section Title). Schema sanitizer (cad86aa) lets older templates with the removed types still load."

### 39. Signature PNG + geolocation map + repeating bounds
expected: Signatures store as PNG; geolocation captures lat/lng on a Leaflet map (try on mobile); repeating sections honour min/max instance bounds.
result: pass
note: "User verified (2026-06-04). Signature half is N/A — signatureField removed 2026-06-04. Geolocation lat/lng + Leaflet map and repeating-section min/max bounds verified."

### 40. Computed PAS 79 risk band
expected: The computed field outputs the correct PAS 79 risk level with standard colour coding from its likelihood × consequence inputs.
result: pass
note: "User verified (2026-06-04)."

### 41. Per-field photo attach (attachPhotos)
expected: The attachPhotos toggle adds photo attachment to ANY field type, not just photo fields.
result: pass
note: "User verified (2026-06-04)."

### L. Conditional logic (Phase 15)

### 42. Builder condition UI — add show/hide/require rules
expected: In the builder you can add visibility rules per field (source field, operator, value, action = show/hide/require). Operators filter by source type; isEmpty/isNotEmpty hide the value input without reflow.
result: pass
note: "User verified (2026-06-05)."

### 43. Runtime show / hide / require
expected: Filling a source field shows, hides, or makes required the dependent field at runtime; hide wins over show; hiding a parent cascades to children.
result: pass
note: "User verified (2026-06-05)."

### 44. Circular-dependency detection
expected: Creating a rule cycle surfaces a cycle banner ("Circular rule: A → B"); an out-of-scope reference surfaces a scope-error banner. The save is rejected on a real cycle.
result: pass
note: "User verified (2026-06-05)."

### 45. Hidden answers scrubbed server-side
expected: Answers for hidden fields are scrubbed on submit — they don't persist and never reach the AI report prompt.
result: pass
note: "User verified (2026-06-05)."

### M. Multi-tenancy + fork-on-fill (Phase 16) — CREATES DATA

### 46. Admin assigns a template to a client
expected: Admin can assign a published master template to a specific client.
result: pass
note: "User verified (2026-06-05). Re-verify of the deleted_at schema-drift fix (migrations 018/019) — assign-from-client-page now works end to end."

<!-- Tests 47-49 (client fork-on-fill, client build-from-scratch, cross-org RLS)
     REMOVED 2026-06-03 — client-dependent, deferred to a later client-portal pass. -->

### N. Assignment scheduling + notifications (Phase 17)

### 50. Recurring assignment auto-generates
expected: A recurring form assignment auto-creates the next occurrence on schedule.
result: pass
note: "Verified end-to-end by Claude 2026-06-05 (no recurrence UI exists — DB column + cron only, so driven via SQL seed + live cron hit). Seeded assignment 2de445f9 (client 8a019534, template 0047e922) to status=completed, recurrence_rule={frequency:weekly}, due_date=2026-06-12, recurrence_generated_at=NULL. Hit /api/cron/assignment-scheduler on the running dev server → {recurrencesGenerated:1}. Successor row bb778f89 created CORRECTLY: due_date=2026-06-19 (prior +7d, NOT today), status=pending, recurrence_rule weekly carried over, template_version_id re-pinned to latest published v2 (719ab6b4), last_reminder_sent=NULL. Original 2de445f9 got recurrence_generated_at stamped. IDEMPOTENCY: re-ran cron → {recurrencesProcessed:0, recurrencesGenerated:0} — the guard prevents a second successor. NOTE: left two test rows on prod (completed 2de445f9 + pending successor bb778f89) for client 8a019534 — harmless demo data, can be soft-deleted if it clutters. Recurrence-vocab confirm-with-Matt (weekly/monthly/quarterly/annually per §C) still open."

### 51. Due-date status + overdue pill
expected: Assignments sort by due_date (ascending, nulls last); an overdue assignment shows the overdue pill (admin gets a tooltip, client surface does not).
result: pass
note: "User verified (2026-06-05): sort + overdue pill + admin tooltip all work. UI ADJUSTMENT requested + done same session — PENDING and OVERDUE pills side-by-side looked too alike. FINAL design (user iterated twice): (1) suppress the redundant PENDING pill when overdue (keep a meaningful 'In progress'); (2) OVERDUE pill kept in its ORIGINAL subtle rust-tint design (#a14a2a on #a14a2a/10); (3) REMOVED the admin hover-tooltip entirely; (4) the 'Was due N days ago' detail now renders as plain visible rust text in the card (no hover needed — touch-friendly). Applied to: app/_components/overdue-pill.tsx (reverted to subtle), app/admin/clients/[id]/client-tabs.tsx (tooltip removed, plain pill + 'Was due N days ago' line, unused Tooltip import dropped), app/client/assignments/_components/assignment-card.tsx (hide-pending-when-overdue + 'Was due N days ago' line). /admin/assignments queue renders only a status pill (no overdue pill) so untouched. Typecheck clean on all 3 files. CODE change → needs deploy. NOT committed yet."

### 52. Reminder notifications (7d / 1d / overdue) deduped
expected: Clients receive automated reminders at 7-day, 1-day, and overdue marks via n8n, each sent once (deduped).
result: [pending]

### O. FRA seed template (Phase 18) — the real form, end-to-end

### 53. Seeded Blank FRA (Type 3) exists & is published
expected: Matt's real FRA Type 3 template is present as a published template (from migration 016), with its full 30-entity schema.
result: pass
note: "User verified (2026-06-05). FRA Type 3 present + published on /admin/templates; full ~30-entity schema loads in the builder (5 sections + conditional sub-sections, PAS 79 computed field, Action Plan repeating section, geolocation + photo fields). Confirmed live via the fill-page DOM during the white-strip debugging too."

### 54. Fill the real FRA end-to-end
expected: Open the seeded FRA, work through conditional sections, the PAS 79 risk matrix, the Action Plan repeating section, signature, geolocation, and photo fields — fill and submit successfully.
result: pass
note: "User verified (2026-06-05). Worked through conditional sub-sections (policy remediation / obstruction details / detection upgrade plan show on the right driver answers), PAS 79 likelihood×consequence risk band, Action Plan repeating section (add/remove instances), geolocation + photo fields; submit succeeded (status → submitted). Signature half N/A — signatureField removed 2026-06-04 (its orphan section also cleaned by the sanitizer cascade this session). NOTE: surfaced + fixed a major layout bug during this test — a white strip / phantom document scroll on the fill page (and all admin pages); root cause was a flex min-height:auto scroll leak parking the document mid-scroll; fixed by pinning the admin shell to the viewport (position:fixed inset-0) + min-h-0 containment + html/body overflow lock. Committed 774df5d."

### 55. Real FRA submit triggers the report webhook + AI pipeline
expected: Submitting the seeded FRA fires the n8n report webhook AND runs the AI draft pipeline (the modern submit path), landing a draft in the review queue.
result: pass
note: "User verified (2026-06-05). AI-draft half PASS — submitting the real FRA ran the AI pipeline (live OpenRouter) and the draft landed in /admin/review-queue (Awaiting Review → Begin Review). n8n report-webhook half remains blocked (demo/subscription, same gate as tests 9/22) — not exercised. Draft-quality (deferred test 20) judged here too: user accepted the draft — see test 20."

## Summary

total: 47  # was 55; 8 client-dependent tests (28, 29-32, 47-49) removed 2026-06-03 (admin-only focus)
passed: 44  # 2026-06-05: admin batch complete — 53/54/55 + deferred 20 now pass
issues: 0
pending: 0  # admin batch fully resolved (remaining gaps are n8n-blocked, see below)
skipped: 0  # was 1 (test 20) — re-judged + passed against the real FRA draft
blocked: 3  # 9, 22, 52 — all n8n demo/subscription; re-run on reactivation
cosmetic: 1  # test 12 assign-modal polish — fixed, pending re-verify
removed: 8  # 28, 29, 30, 31, 32, 47, 48, 49 — client-dependent, deferred to a later client-portal pass

## Gaps

- truth: "An uploaded document is visible/viewable in the document list after upload"
  status: failed
  reason: "User reported: The document looks like it is uploaded but there is an issue. The numbers show that it uploaded, but I can't see the actual document. Clarified: the document row does NOT appear in the list at all (case 1) — the upload count/badge increments but no document row renders. Surface: /admin/compliance (test 7 on the client detail page passed, so likely specific to the compliance list rendering or its query, not the upload/storage write itself)."
  severity: major
  test: 8
  artifacts: ["app/admin/compliance/page.tsx:52-60 — expired/expiring/current buckets all require a non-null expiry_date; undated docs counted in docs.length (All) but rendered in no table"]
  missing: ["a render path for documents with expiry_date = null"]
  root_cause: "CORRECTED (my deleted_at hypothesis was WRONG — this page's documents query has no deleted_at filter). Real cause: documents with expiry_date=null fall into none of the expired/expiring/current buckets, so they're counted in the 'All' tab (docs.length) but never rendered. Verified: the user's 3 uploads today all have expiry_date=null."
  resolution: "FIXED in code (commit 2f7c0fa). Added an 'undated' bucket + 'No Expiry Date' DocTable in the All tab. CODE change → needs the Vercel redeploy before it shows. NEEDS USER RE-VERIFY after deploy: undated uploads now appear under 'No Expiry Date' on /admin/compliance."

- truth: "Admin can assign a published template to a client; client can fork/fill an assigned template"
  status: failed
  reason: "ROOT CAUSE CONFIRMED (schema drift): prod form_templates has NO deleted_at column (cols: id, name, template_type, owner_id, owner_type, is_published, created_at, parent_template_id). No migration in supabase/migrations/ ever adds it, but code + generated types assume it. Queries that filter/select form_templates.deleted_at error out; the code doesn't check the error, so data falls back to [] / breaks."
  severity: major
  test: 12
  affects_tests: [12, 46, 47, 48]
  artifacts:
    - "app/admin/clients/[id]/page.tsx:84-88 — publishedTemplates query (.eq is_published true .is deleted_at null) errors → empty Assign-Template picker"
    - "app/client/templates/[id]/fill/page.tsx:36-44 — selects deleted_at from form_templates and checks template.deleted_at → errors (blocks fork-on-fill / client fill)"
    - "lib/supabase/database.types.ts — form_templates type includes deleted_at though prod column is absent"
  data_state: "4 templates exist; 3 published incl. FRA seed 'Fire Risk Assessment (Type 3) — Single Premises' (id 00000000-0000-4000-a000-000000000018). Data is fine — the query is the problem."
  fix_options:
    - "A (recommended): new migration adds `deleted_at timestamptz NULL` to form_templates; apply to prod. Aligns code+types+convention, fixes all affected screens at once."
    - "B: strip the deleted_at filter/select from the form_templates queries in code (more churn; types already expect the column)."
  workaround: "Assign from /admin/templates/[id] → 'Assign to clients' (template pre-selected, client list query is on clients which has deleted_at)."
  missing: ["form_templates.deleted_at column on prod (no migration authored)"]
  resolution: "FIXED 2026-06-01. migration 018_form_templates_soft_delete adds deleted_at timestamptz NULL + partial index — APPLIED TO PROD (verified: publishedTemplates query now returns 3 published templates incl. FRA seed). Hardened publishedTemplates fetch to log errors (commit 5f3a962). Pushed; redeploy in flight. NEEDS USER RE-VERIFY of the assign-from-client-page flow (DB fix is live now)."

- truth: "A created assignment actually appears in the assignment lists (admin + client)"
  status: fixed_pending_verify
  reason: "User: assign 'shows the success notification but nothing is actually assigned'. ROOT CAUSE: same deleted_at schema drift, now on form_assignments (and a full audit found documents + form_submissions missing it too). The INSERT works (no deleted_at in insert) so the success toast is correct; every list query filters .is(deleted_at,null) → errors → []. Verified 10 assignment rows exist in prod incl. the user's new one (5490e532, today)."
  severity: blocker  # feature appears completely non-functional to the user
  test: 12
  affects_tests: [12, 46, 47, 48, 50, 51]
  full_audit: "Tables code filters/sets deleted_at on — present: clients, services, form_templates(018). MISSING→added in 019: form_assignments, documents, form_submissions. Not-used (left alone): proposals, template_versions, field_media."
  resolution: "FIXED 2026-06-01. migration 019_soft_delete_columns_drift_fix adds deleted_at + partial indexes to form_assignments/documents/form_submissions — APPLIED TO PROD. Verified the clients/[id] assignment query (join + deleted_at filter) now returns the user's assignment. Committed f2b484a, pushed. No code change needed (column existing fixes the existing filters). NEEDS USER RE-VERIFY: assignment now shows in the Assigned Forms tab."

- truth: "The main assessment form autosaves while filling and restores on reload"
  status: failed
  reason: "ROOT CAUSE CONFIRMED. The Phase-13 coltorapps migration regressed main-form autosave. assessment-client.tsx only autosaves the appendix (__appendix_notes / __appendix_media) — verified: the one draft with saved data has ONLY those 2 keys. The real FRA fields live in InterpreterRenderer's coltorapps store, which (a) is never autosaved during filling (persists only on submit) and (b) is created with no initialData, so even saved values wouldn't rehydrate on reload. Net: fill main form → reload → everything gone."
  severity: blocker
  test: 15
  artifacts:
    - "app/admin/assessments/[id]/assessment-client.tsx:62-72,99-113 — triggerAutosave only wired to appendix changes"
    - "components/form-interpreter/interpreter-renderer.tsx:85-104 — useInterpreterStore has no initialData; onEntityValueUpdated never autosaves"
    - "interpreter-renderer has no initialValues/onValuesChange props"
  fix_plan: "(1) InterpreterRenderer: accept initialValues + onValuesChange props; seed store via useInterpreterStore(..., { initialData: { entitiesValues: initialValues }, events: {...} }); fire onValuesChange(getEntitiesValues()) inside onEntityValueUpdated. (2) assessment-client: pass answers_json minus __appendix_* as initialValues; in onValuesChange, debounce-autosave the MERGE of main values + appendix (autosaveAnswers overwrites the whole answers_json, so the merge is mandatory or one half wipes the other). Mirror to /client fill surfaces that reuse InterpreterRenderer."
  risk: "InterpreterRenderer is focus-loss-sensitive (Pitfall 6, components memoised on [surface] via propsRef). onValuesChange must NOT widen useMemo deps or trigger remounts — update a ref + debounce, like onProgressChange already does. Needs human verify on prod (focus + persistence)."
  also_used_by: ["/client/templates/[id]/fill", "/client/assignments/[id]/fill"]
  resolution: "FIXED in code (commit 8a747f8, pushed; typecheck + production build clean). InterpreterRenderer gained initialValues (seeds store via initialData.entitiesValues) + onValuesChange (ref-routed from onEntityValueUpdated). assessment-client rehydrates from answers_json minus appendix keys and debounce-autosaves the merge of main + appendix. CODE change → needs deploy. NEEDS USER RE-VERIFY on prod: (a) fill main fields → reload → they persist; (b) typing focus is NOT lost on keystroke."
  followup_fix: "User verified persistence works (editing restores values). Reported the completeness bar showed 0 after refresh until a field was touched — onEntityValueUpdated only fires on changes, not on mount. FIXED (commit af683dc): emit initial progress once on mount. Needs deploy + re-verify."
  observation: "Pre-existing + NOT changed by this fix: submitAssessmentAction overwrites answers_json with main-only scrubbed values, so the appendix (__appendix_notes/media) is dropped at submit time and never reaches the AI report. Flag for a separate decision."

## Cosmetic / UI polish

- truth: "The Assign Template modal (components/admin/assign-template-modal.tsx) UI is polished and clear"
  status: fixed_pending_verify
  reason: "User listed 4 issues: (1) hovering does nothing, (2) dropdown too small for the text, (3) bad colour contrast, (4) after selecting a template its ID showed instead of its name."
  severity: cosmetic  # except #4 which was a functional display bug
  test: 12
  file: "components/admin/assign-template-modal.tsx"
  resolution: "FIXED (commit 7557958, pushed; redeploy in flight). #4: added base-ui items map to Select.Root so SelectValue renders the name. #2: trigger w-full/h-10 + content max-h-64. #1: added data-highlighted: hover variants (base-ui highlights via data-highlighted, not :focus). #3: lighter popup bg (#222), white-on-teal highlight, clearer placeholder. NEEDS USER RE-VERIFY after deploy."
  related: "Same latent id-vs-name bug exists in components/admin/upload-document-modal.tsx client picker (value=id, displays name) — NOT yet fixed; flag when we hit document-upload selects again."

## Enhancements (requested during UAT — done)

- request: "Add Expiries page to the sidebar"
  status: done
  detail: "components/app-sidebar.tsx — added Expiries nav item (commit 208c3e3)."

- request: "From an assigned form, allow starting a new assessment (only Revoke existed)"
  status: done_pending_verify
  detail: "client-tabs.tsx Assigned Forms — added 'Start assessment' action linking to /admin/assessments/new?clientId=..&templateVersionId=.. (commit 2f7c0fa). Threaded template_version_id through query + AssignmentRow type. CODE change → needs deploy. Follow-up idea (NOT done): link the resulting submission back to the assignment so it auto-marks completed."

- request: "Workflow-error surfaces — make errors easy to find + inspect (surfaced from test 24)"
  status: done_pending_verify
  detail: "Verified on localhost. (1) Month Summary errors table: whole row is a click-to-expand dropdown revealing full message + payload (client/date/type/storage path) + 'Open assessment review' link when submission_id present (app/admin/month-summary/_components/workflow-errors-table.tsx). (2) Dashboard '07 Workflow errors' card: reverted per-row links — rows are plain data, one section-level 'View Log' button to /admin/errors. (3) Navigation: added sidebar 'Workflow Errors' (with live count) + 'Month Summary' entries (components/app-sidebar.tsx); previously /admin/month-summary was URL-only. (4) Dashboard '08 This month' card: added 'View full summary' footer link (header kept single-line to avoid the cramped-wrap bug the user caught). Considered+rejected a per-error dedicated page and a cross-surface deep-link/highlight (reverted the /admin/errors anchor). CODE change → needs deploy."

- request: "Completed assessments vanish from the review queue with no way to find them (a submitted/approved report 'disappeared' — surfaced from test 18)"
  status: done_pending_verify
  detail: "Added a 'Completed' tab to /admin/review-queue (Awaiting Review | Completed, with counts) via ?tab=, plus getCompletedReports() (status=completed). Completed cards link to the review page ('View Report') to view/download the finalised report (commit de70c51, build clean). CODE change → needs deploy. NEEDS USER RE-VERIFY: their completed assessment (b7027dea) appears under the Completed tab."

## Observations (found during UAT — not yet tests)

- truth: "The live services catalog reflects Matt's full offering"
  status: decided_keep_as_is
  reason: "16 services soft-deleted in one bulk op at 2026-05-12 13:44:03 (same day as repo de-dup). 13 are legit unique offerings with no live namesake (FRA Type 1/3/4 £480/620/980, Site Risk £540, Consulting Retainer 5/10/20h £425/800/1500, + Basic Fire Awareness, DSE Assessment, Fire Marshal, Fire Warden, First Aid 3-day, Manual Handling). 2 are genuine dedupes (PAT Testing, Emergency First Aid — live namesakes exist). 1 is a test row (Test service — DELETE ME). Live catalog = 38 active (3 Monthly Packages / 10 Services / 25 Training)."
  decision: "User 2026-06-02: KEEP as-is, do NOT restore. The proposal wizard loads correctly from the DB; that's the acceptance bar. (If Matt later wants FRA/retainer lines back: un-delete the 13 AND extend/derive SERVICE_CATEGORIES in lib/data/services.ts — currently hardcoded to 3 categories, would mis-bucket the FRA/Testing categories under 'Services'.)"
  severity: info


- truth: "field_media.transcript column exists on prod (per Phase 7 plan 07-09 'Migration 017 adds field_media.transcript')"
  status: drift_found
  reason: "Prod check during the test-12 investigation: field_media.transcript does NOT exist on prod, and no 017 migration is registered. The Phase-7 transcript migration was never applied. May affect test 14 (photo/media) and the AI report transcript path. Flagged for verification when we reach Section F/G."
  severity: TBD
  action: "Verify at test 14; if the STT transcript is meant to persist per-media, a 017 migration needs authoring + applying."
