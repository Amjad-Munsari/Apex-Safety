---
phase: 14
slug: custom-field-types
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: see `<validation_architecture>` block in `14-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see `tests/form-builder/progress.test.ts`) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `pnpm test -- --run tests/form-builder` |
| **Full suite command** | `pnpm test -- --run` |
| **Estimated runtime** | ~30s (form-builder slice); ~90s (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the slice touched
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (quick), 90 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner to fill) | (planner) | (planner) | BUILDER-01..05 / FORM-01..06 | (planner) | (planner) | unit/integration/manual | `pnpm test -- --run <path>` | ❌ W0 | ⬜ pending |

*Planner: populate this table per task during PLAN.md generation. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install dependencies: `leaflet@1.9.4`, `react-leaflet@5.x`, `@types/leaflet`, `browser-image-compression`, `heic2any`
- [ ] Copy Leaflet marker icon PNGs to `public/leaflet/` (Webpack icon fix)
- [ ] `tests/form-builder/entities/specialty-fields.test.ts` — entity factory smoke tests (signature/rating/multiPhoto/geolocation/repeatingSection/computed)
- [ ] `tests/form-builder/pas79.test.ts` — `computePAS79RiskLevel(L,C)` matrix coverage
- [ ] `tests/form-builder/progress.test.ts` — extend to count repeatingSection instances correctly
- [ ] `tests/form-interpreter/repeating-section-renderer.test.tsx` — add/remove instance, validation iterates instances[]
- [ ] `tests/form-interpreter/computed-field-renderer.test.tsx` — reactivity via `useInterpreterEntitiesValues`
- [ ] `tests/lib/storage/photo-upload.test.ts` — compression target 1.2–1.5 MB, EXIF auto-rotate, HEIC→JPEG path stubbed
- [ ] Server-action submit test extended to validate `repeatingSection.instances[].children`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signature canvas captures stroke and stores PNG to `form-media/{client_id}/signatures/...` | BUILDER-03, FORM-05 | Pointer events + canvas drawing | Build template w/ signature field → fill → sign → submit → verify object exists in Supabase Storage |
| Multi-photo upload from iOS Safari (HEIC) compresses to JPEG ≤ 1.5 MB | FORM-06 | Real device, real HEIC file | iPhone Safari → fill → attach HEIC photo → verify compressed JPEG saved |
| Geolocation captures on mobile vs desktop fallback (UA detect OR accuracy > 100m) | BUILDER-04 | Real geolocation permission prompt | Mobile (real GPS) → captures lat/lng; Desktop → fallback badge + map preview + click-to-set |
| STT (Web Speech API en-GB) on text + textarea renderers (FORM-02) | FORM-02, FORM-04 | Microphone permission, real speech | Chrome on desktop → mic button → speak → text appears; Safari iOS → disabled-with-message |
| Repeating section: FRA-doors scenario (add 3 instances, fill each, submit, AI report sees 3 hazards) | BUILDER-02 | Cross-system integration with AI pipeline | Build FRA-doors test template → fill 3 instances → submit → trigger AI draft → verify 3 hazards |
| Computed field PAS 79 colour mapping matches Matt's hand-written reports | BUILDER-05 | Domain validation by Matt | Print 25 combinations of (likelihood × consequence) → cross-check against Matt's reference matrix |
| `attachPhotos` affordance shows 📎 below field at fill time (not bottom-gallery) | FORM-05 | Visual design check | Build field with attachPhotos=true → fill → confirm 📎 appears below field, photo uploaded to `form-media/{client_id}/photos/...` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (leaflet install, PAS 79 unit tests, repeatingSection tests, photo compression tests)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
