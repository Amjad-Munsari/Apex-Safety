---
phase: 13
slug: form-builder-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0 (unit/integration) + Playwright 1.51 (e2e) — both installed |
| **Config file** | `playwright.config.ts` (exists); `vitest.config.ts` missing — Wave 0 installs |
| **Quick run command** | `npx vitest run tests/form-builder/` |
| **Full suite command** | `npx vitest run && npx playwright test tests/form-builder/` |
| **Estimated runtime** | ~{N} seconds (planner to fill) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/form-builder/`
- **After every plan wave:** Run `npx vitest run && npx playwright test tests/form-builder/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds (planner to fill)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Planner/auditor fills this map from PLAN.md task IDs. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — missing; add with Next.js-compatible config
- [ ] `tests/form-builder/` directory — does not exist; create with test stubs
- [ ] `tests/form-builder/palette.test.ts` — stubs for BUILDER-01
- [ ] `tests/form-builder/properties.test.ts` — stubs for BUILDER-02
- [ ] `tests/form-builder/save-draft.test.ts` — stubs for BUILDER-03
- [ ] `tests/form-builder/version-pin.test.ts` — stubs for submission pinning
- [ ] `tests/form-builder/validate-schema.test.ts` — stubs for server-side schema validation
- [ ] `tests/form-builder/validate-values.test.ts` — stubs for server-side value validation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*Planner/auditor fills. If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
