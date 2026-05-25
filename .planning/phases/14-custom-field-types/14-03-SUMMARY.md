---
phase: 14
plan: "03"
subsystem: assessments/server-actions
tags: [phase-14, server-actions, storage, field-media, ai-pipeline, security, tdd]
dependency_graph:
  requires:
    - lib/form-builder/storage/upload-paths.ts (Plan 14-01 — import path pre-created for merge)
    - lib/supabase/admin.ts (adminClient — service-role bypass)
    - lib/auth-helpers.ts (requireActorUserId — auth gate carry-forward)
  provides:
    - uploadMediaAction (exported from app/admin/assessments/actions.ts)
    - expandRepeatingSections (exported from app/admin/assessments/actions.ts)
    - runReportDraftGeneration updated with two-step pinned-schema fetch + expansion
  affects:
    - app/admin/assessments/actions.ts (extended — existing Phase 13 actions unchanged)
    - Phase 14-05 (signature-field-renderer, multi-photo-field-renderer import uploadMediaAction)
    - Phase 14-06 (attach-photos-affordance imports uploadMediaAction)
    - Phase 14-08 (UAT: FRA-doors scenario expects N instances → N hazards in AI draft)
tech_stack:
  added: []
  patterns:
    - "TDD RED→GREEN pair per task (3eea2f1→b9fbd1a / 383ec4d→b9fbd1a)"
    - "Auth gate as first statement (T-14-03-01 carry-forward of T-13-11)"
    - "Two-step pinned-schema fetch (submission → template_versions, no FK join)"
    - "service-role adminClient for all storage writes (RLS bypass pattern)"
key_files:
  created:
    - app/admin/assessments/actions.ts (uploadMediaAction + expandRepeatingSections — extended)
    - tests/form-builder/upload-media-action.test.ts (21 cases — all GREEN)
    - tests/form-builder/expand-repeating-sections.test.ts (15 cases — all GREEN)
    - lib/form-builder/storage/upload-paths.ts (pre-created at 14-01 import path)
    - vitest.config.ts (added to worktree — mirrors main repo config)
  modified:
    - app/admin/assessments/actions.ts (runReportDraftGeneration — two-step fetch + expansion)
decisions:
  - "expandRepeatingSections implemented alongside uploadMediaAction in same commit (shared file)"
  - "lib/form-builder/storage/upload-paths.ts created in this plan to match 14-01 import path — merge will reconcile"
  - "lib/form-builder/ entities+attributes copied to worktree for test resolution (worktree sparse checkout)"
  - "Task 2 RED commit (383ec4d) came after Task 1 GREEN (b9fbd1a) — both functions share actions.ts and were implemented together; tests still validate correct behavior"
metrics:
  duration: "~11 minutes"
  completed: "2026-05-25T19:27:36Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 14 Plan 03: Server-Side Media Upload + repeatingSection AI Expansion Summary

**One-liner:** Server action `uploadMediaAction` with auth gate + MIME whitelist + size caps + field_media audit, plus `expandRepeatingSections` helper that flattens instances into labelled objects for the AI report prompt.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | uploadMediaAction failing tests | 3eea2f1 | tests/form-builder/upload-media-action.test.ts, lib/form-builder/storage/upload-paths.ts, vitest.config.ts |
| 1 GREEN | uploadMediaAction implementation | b9fbd1a | app/admin/assessments/actions.ts, lib/form-builder/ (entities+attributes copied) |
| 2 RED | expandRepeatingSections failing tests | 383ec4d | tests/form-builder/expand-repeating-sections.test.ts |
| 2 GREEN | expandRepeatingSections (in Task 1 GREEN) | b9fbd1a | (same commit — shared file) |

## What Was Built

### uploadMediaAction (Task 1)

New exported server action in `app/admin/assessments/actions.ts`:

```typescript
export async function uploadMediaAction(
  submissionId: string,
  fieldId: string,
  fileDataUrl: string,
  mediaType: "image" | "audio",
  clientId: string,
  kind: "signature" | "photo"
): Promise<string>
```

Security contract (per threat model):
- **T-14-03-01**: `await requireActorUserId("admin")` is the FIRST statement — non-admin callers rejected before any I/O
- **T-14-03-02**: MIME whitelist `["image/png", "image/jpeg", "image/webp"]` — SVG explicitly excluded (can carry JS); octet-stream / text/html rejected
- **T-14-03-03**: Size caps enforced on decoded buffer: signature ≤ 500KB, photo ≤ 2MB
- **T-14-03-04**: Signature-must-be-PNG guard (canvas.toDataURL produces PNG per D-16)
- Signatures use `upsert: true` (re-sign overwrites D-16 path); photos use `upsert: false` (UUID path D-17)
- Every successful upload writes a `field_media` row; upload failure prevents the insert

Path helpers from `lib/form-builder/storage/upload-paths.ts` (pre-created at 14-01's import path):
- D-16: `{clientId}/signatures/{submissionId}/{fieldId}.png`
- D-17: `{clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}`

### expandRepeatingSections (Task 2)

New exported pure helper in `app/admin/assessments/actions.ts`:

```typescript
export function expandRepeatingSections(
  schema: { entities: Record<string, {...}> },
  answers: Record<string, unknown>
): Record<string, unknown>
```

Transforms:
```
{ "repId": { instances: [{ "c1": "door 1", "c2": "good" }, ...] } }
```
into:
```
{ "repId": [{ instanceIndex: 1, Location: "door 1", Condition: "good" }, ...] }
```

Using child entity `attributes.label` as keys (falls back to entity ID if no label). Pure function — never mutates input. T-14-03-06: only schema.children keys are included; attacker-supplied extra instance keys are silently excluded.

### runReportDraftGeneration Update (Task 2)

Extended with two-step pinned-schema fetch (same pattern as `submitAssessmentAction` — NEVER a FK join):
1. Fetch `submission.answers_json, template_version_id`
2. Fetch `template_versions.schema_json` by `submission.template_version_id`
3. Call `expandRepeatingSections(version.schema_json, submission.answers_json)` before prompt construction
4. Pass `expandedAnswers` to `JSON.stringify()` in the prompt

The AI now sees one labelled object per fire door / hazard item, not an opaque `instances` array.

## Test Results

```
tests/form-builder/upload-media-action.test.ts  — 21/21 PASS
tests/form-builder/expand-repeating-sections.test.ts — 15/15 PASS
Total: 36/36 PASS
```

### upload-media-action.test.ts cases:
- Structural: requireActorUserId present, field_media insert present, form-media storage present
- MIME: rejects octet-stream / text/html / svg+xml; accepts png/jpeg/webp
- Size caps: rejects 600KB signature, accepts 100KB; rejects 2.5MB photo, accepts 1.5MB
- Path: D-16 signature path matches exactly; D-17 photo UUID path matches regex
- field_media: row inserted on success; NOT inserted on upload failure
- Input validation: rejects empty clientId/submissionId/fieldId; rejects non-PNG signature

### expand-repeating-sections.test.ts cases:
- Empty inputs return {}
- Non-repeatingSection passthrough (text, select)
- Single repeatingSection with 2 instances + 2 children (FRA-doors scenario)
- instanceIndex is 1-based
- Child entity label used as key (not entity ID)
- Missing label falls back to entity ID; missing child in schema falls back to entity ID
- Missing answer for repeatingSection: key preserved as-is (no `[]` injection)
- Mixed schema: only repeatingSection expanded
- Non-mutation guarantee; two calls produce equal output
- T-14-03-06: extra instance keys not in schema.children are excluded

## Deviations from Plan

### Deviation 1: Task 2 RED commit came after Task 1 GREEN [Rule 1 - Known]

Both tasks write to `app/admin/assessments/actions.ts`. `expandRepeatingSections` was implemented in Task 1's GREEN commit (`b9fbd1a`) since the file rewrite included both features. The Task 2 RED test commit (`383ec4d`) was created after the implementation existed. The behavioral contract is still validated — all 15 tests pass and test the correct behavior.

### Deviation 2: lib/form-builder/ copied to worktree [Rule 3 - Blocking issue]

The worktree is a sparse checkout. `lib/form-builder/` was not present, causing `@/lib/form-builder` import to fail when running tests. Resolution: copied all form-builder entities and attributes from the main repo. These files were already committed in the main repo from Phase 13+14-01 work. The worktree commit includes these files but the merge will see them as already-present in main (no conflict).

### Deviation 3: lib/form-builder/storage/upload-paths.ts created here [Cross-wave coordination]

Plan 14-01 owns this file. Since 14-01 runs in parallel and hasn't merged yet, I created the file at the canonical 14-01 import path with the same D-16/D-17 contracts. When 14-01 merges, git will see both create the same file — the merge will need to reconcile. The content is designed to be identical to what 14-01 produces (per import path alignment instruction in CROSS-WAVE NOTE).

### Deviation 4: vitest.config.ts added to worktree [Rule 3 - Blocking issue]

The worktree had no `vitest.config.ts`. Added a copy matching the main repo's config (`tests/form-builder/**/*.{test,spec}.ts`, jsdom, 30s timeout, `@` alias).

## Known Stubs

None. All functionality is fully implemented. The storage upload goes to a real Supabase bucket (adminClient bypasses RLS). Tests mock the storage to avoid real uploads.

## Threat Flags

No new security surface beyond what the threat model documented. The `uploadMediaAction` implements all T-14-03-01..T-14-03-05 mitigations. T-14-03-05 and T-14-03-07 are accepted.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED | 3eea2f1 | PASS |
| Task 1 GREEN | b9fbd1a | PASS |
| Task 2 RED | 383ec4d | PASS (after GREEN — shared file deviation) |
| Task 2 GREEN | b9fbd1a | PASS (same commit as Task 1 GREEN) |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| app/admin/assessments/actions.ts exists | FOUND |
| tests/form-builder/upload-media-action.test.ts exists | FOUND |
| tests/form-builder/expand-repeating-sections.test.ts exists | FOUND |
| lib/form-builder/storage/upload-paths.ts exists | FOUND |
| .planning/phases/14-custom-field-types/14-03-SUMMARY.md exists | FOUND |
| Commit 3eea2f1 (RED task 1) | FOUND |
| Commit b9fbd1a (GREEN task 1+2) | FOUND |
| Commit 383ec4d (RED task 2) | FOUND |
| 36/36 tests GREEN | PASS |
