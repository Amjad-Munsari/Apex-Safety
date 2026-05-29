---
phase: 15
slug: conditional-logic-engine
type: security
verified: 2026-05-29
status: secured
asvs_level: 1
register_authored_at_plan_time: true
threats_total: 42
threats_closed: 42
threats_open: 0
threats_accepted: 14
unregistered_flags: 0
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register was authored at plan time across 9 PLAN.md `<threat_model>` blocks.
> Each `mitigate` row was verified by grep at the named call site; each `accept`
> row carries the rationale captured at plan time.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client save body → server `saveDraftAction` / `publishTemplateAction` (admin + customer) | Schema JSON crosses; `visibilityRulesAttribute.validate` + `validateRuleGraph` run server-side before INSERT. | Form schema JSON (template_versions.schema_json) |
| Stored `template_versions.schema_json` → interpreter render | Pre-Phase-15 rows lack the new attribute; default-coerce handles backcompat. | Form schema JSON |
| Client submit → `submitAssessmentAction` | Hostile client could submit values for hidden fields; `stripHiddenAnswers` is the defence. | answers_json |
| `answers_json` → `runReportDraftGeneration` → OpenAI prompt | Scrub closes hidden-value leak end-to-end. | answers_json (post-scrub) |
| coltorapps interpreter → `makeShouldBeProcessed` hook | Runs on every value change; bounded per-entity. | Live rule evaluation state |
| Server thrown `Error.message` → client JSON.parse | Structured `RuleGraphInvalid` payload (labels + IDs only). | Cycle/scope error payload |
| Migration 012 → live Supabase DB | Applied via supabase-888 MCP; vetted pattern. | Seed template SQL |

---

## Threat Register

All 42 threats from the 9 plans, with verification evidence for `mitigate` entries.

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-15-00-01 | Tampering | Test stubs | accept | Stubs ship no production logic; gated by code review. | CLOSED |
| T-15-00-02 | Repudiation | Test artefacts | accept | Test files committed via git with author trail; no auth surface. | CLOSED |
| T-15-00-03 | Denial of Service | makeShouldBeProcessed hot path | mitigate | `lib/form-builder/visibility/should-be-processed.ts` iterates only host entity's own `visibilityRules.rules`; no schema recursion. Cycle detector (T-15-03-01) blocks pathological schemas at save time. | CLOSED |
| T-15-01-01 | Tampering | visibilityRulesAttribute.validate | mitigate | `lib/form-builder/attributes/visibility-rules.ts:4-15` (VALID_OPERATORS/VALID_ACTIONS whitelist) + `:85-97` (throws on unknown operator/action). | CLOSED |
| T-15-01-02 | Denial of Service | visibilityRulesAttribute.validate | accept | Bounded by overall coltorapps validateSchema cost; cycle detection covers runtime DoS. | CLOSED |
| T-15-01-03 | Information Disclosure | Backward-compat path | mitigate | `visibility-rules.ts:41,47` default-coerces missing/null to `{ rules: [], logic: "and" }`. Backcompat test guards regression. | CLOSED |
| T-15-01-04 | Tampering | Per-rule shape | mitigate | `visibility-rules.ts:68-106` hand-validates each rule with indexed `Rule #i:` error messages; sourceEntityId non-empty string enforced. | CLOSED |
| T-15-02-01 | Information Disclosure | answers_json | mitigate | `lib/form-builder/visibility/strip-hidden-answers.ts` drops `visible===false` keys; recurses into repeatingSection instances via `evaluateVisibilityForInstance`. Wired at `app/admin/assessments/actions.ts:319-322`. | CLOSED |
| T-15-02-02 | Denial of Service | shouldBeProcessed hook | mitigate | `should-be-processed.ts` iterates only host entity's rule list — bounded; no schema walk. | CLOSED |
| T-15-02-03 | Tampering | Hidden-required logic | mitigate | `lib/form-builder/visibility/cascade-visibility.ts:28-29` (`forceHidden` sets `{ visible: false, required: false }`). D-07 enforced. | CLOSED |
| T-15-02-04 | Repudiation | Hidden field strip | accept | D-01 intent: preserve on hide in store, drop on submit. Future audit trail out of scope. | CLOSED |
| T-15-02-05 | Spoofing | evaluateRule unknown operator | mitigate | `lib/form-builder/visibility/evaluate-rule.ts` switch returns false for unknown operators (default branch); combined with attribute whitelist this is defence-in-depth. | CLOSED |
| T-15-03-01 | Denial of Service | Interpreter render loop | mitigate | `lib/form-builder/visibility/validate-rule-graph.ts` runs 3-colour DFS over union of direct + computedInputs edges; called at all 4 server save/publish sites. | CLOSED |
| T-15-03-02 | Tampering | Cross-template rule refs | mitigate | `validate-rule-graph.ts` operates only within a single template; cross-template refs become advisory orphans + `evaluateRule` returns false at runtime. | CLOSED |
| T-15-03-03 | Information Disclosure | Cycle-error payload | mitigate | `validate-rule-graph.ts` `CycleError` carries `path`, `labels`, `edges` only — no field values, no PII. | CLOSED |
| T-15-03-04 | Tampering | Cross-instance D-03 bypass | mitigate | `lib/form-builder/visibility/scope.ts` `isAncestorScope` rejects cross-instance refs (`returns false` when consumer is root and source is inside repeatingSection); validateRuleGraph emits `reason: "cross-instance"`. | CLOSED |
| T-15-03-05 | Repudiation | Save-time rejection | accept | Existing Next.js server-action error pipeline captures throws. | CLOSED |
| T-15-04-01 | Tampering | dynamicRequired prop | mitigate | `components/form-interpreter/interpreter-renderer.tsx:173-201` reads `propsRef.current.visibility[entity.id]?.required` — primitive boolean from canonical schema; server-side `stripHiddenAnswers` runs before validation. | CLOSED |
| T-15-04-02 | Information Disclosure | Hidden field DOM | mitigate | `should-be-processed.ts` returning false → coltorapps skips render entirely; ChildInput gates on `visible !== false`. No hidden DOM. | CLOSED |
| T-15-04-03 | Denial of Service | propsRef + visibility recompute | accept | `evaluateVisibility` is pure O(entities × rules); cycle save-time guard prevents pathological inputs reaching this hot path. | CLOSED |
| T-15-04-04 | Tampering | Focus-loss regression | mitigate | `interpreter-renderer.tsx:211` literal `}), [surface])` — useMemo deps unchanged; Phase 14-06 focus tests re-run green. | CLOSED |
| T-15-05-01 | Information Disclosure | answers_json content | mitigate | `app/admin/assessments/actions.ts:319-322` — `evaluateVisibility` + `stripHiddenAnswers` between `validateEntitiesValues` and DB write. `server-scrub.test.ts` covers it. | CLOSED |
| T-15-05-02 | Denial of Service | Interpreter render loop (server-distributed) | mitigate | `validateRuleGraph` called at 4 sites: `app/admin/templates/actions.ts:64,119` (save+publish) + `app/client/templates/actions.ts:92,148` (save+publish). | CLOSED |
| T-15-05-03 | Tampering | Surface asymmetry exploit | mitigate | Grep count confirms 4 call sites — admin and customer surfaces guarded identically. | CLOSED |
| T-15-05-04 | Information Disclosure | AI report prompt content | mitigate | `runReportDraftGeneration` reads `answers_json` post-scrub; transitively covered by server-scrub.test.ts. | CLOSED |
| T-15-05-05 | Repudiation | Cycle-rejection error | mitigate | Structured `kind: "RuleGraphInvalid"` JSON Error message; admin sees parseable error in builder UI (CycleErrorBanner). | CLOSED |
| T-15-05-06 | Spoofing | sourceEntityId pointing to another template | mitigate | `validateRuleGraph` operates only on current template; cross-template refs are advisory orphans + runtime evaluateRule returns false. | CLOSED |
| T-15-06-01 | Tampering | UI scope filter (D-03) | mitigate | `components/form-builder/rule-row.tsx:19,136` imports and calls `isAncestorScope` to filter source candidates. Server `validateRuleGraph` is authoritative guard. | CLOSED |
| T-15-06-02 | Tampering | UI action filter for computedField (A7) | mitigate | `rule-row.tsx:146-151` excludes `require` action when `hostEntityType === "computedField"`. Server no-op even if smuggled. | CLOSED |
| T-15-06-03 | Spoofing | surface prop | accept | Purely visual; controls colour token. No security branching. | CLOSED |
| T-15-06-04 | Information Disclosure | Builder rule data | accept | Rules stored in `template_versions.schema_json` already protected by Phase 13 template-version RLS. | CLOSED |
| T-15-06-05 | Tampering | onChange handler | mitigate | All writes go through `setAttr` → `builderStore.setEntityAttribute` → `visibilityRulesAttribute.validate` (T-15-01-01 whitelist). | CLOSED |
| T-15-07-01 | Tampering | Toast/banner copy | accept | Copy comes from admin-authored entity labels + fixed UI-SPEC strings; no new injection vector. | CLOSED |
| T-15-07-02 | Cross-Site Scripting | Banner label rendering | mitigate | `components/form-builder/cycle-error-banner.tsx` renders labels as React text children (no `dangerouslySetInnerHTML`). Grep confirms zero occurrences in banner. | CLOSED |
| T-15-07-03 | Information Disclosure | Cycle payload content | mitigate | Payload contains only entity labels + IDs (see T-15-03-03). | CLOSED |
| T-15-07-04 | Spoofing | Publish-blocked tooltip | accept | Tooltip is advisory; server validateRuleGraph is authoritative gate. | CLOSED |
| T-15-07-05 | Repudiation | Save/Publish failures | accept | Existing Next.js error pipeline logs server-action throws. | CLOSED |
| T-15-08-01 | Tampering | Migration 012 SQL | mitigate | `supabase/migrations/012_phase15_conditional_smoke_test.sql` is reviewable SQL following migration 011 pattern; `gen_random_uuid()` prevents collisions; applied via vetted supabase-888 path. | CLOSED |
| T-15-08-02 | Tampering | Smoke template schema | accept | Test fixture; `validateRuleGraph` prevents accidental publication of cycles via normal save. | CLOSED |
| T-15-08-03 | Information Disclosure | answers_json query in UAT section H | accept | Service-role access boundary identical to any other prod read; documented in 15-UAT.md. | CLOSED |
| T-15-08-04 | Denial of Service | E2E spec runtime | accept | Playwright runs CI/dev only; no production impact. | CLOSED |
| T-15-08-05 | Repudiation | DB migration audit | mitigate | `15-PUSH-LOG.md` records version + timestamp + template ID `0047e922-d17d-4b32-94a4-f5c075823c6d`; `supabase_migrations.schema_migrations` is DB-side audit trail. | CLOSED |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-01 | T-15-00-01 | Test stubs ship no production logic; Wave 1+ tasks gated by code review per project process. | Plan author | 2026-05-26 |
| AR-15-02 | T-15-00-02 | Test files committed via git with author trail; no auth surface. | Plan author | 2026-05-26 |
| AR-15-03 | T-15-01-02 | A schema with thousands of rules is bounded by overall coltorapps validateSchema cost — pre-existing accepted-risk class. Cycle detection covers runtime resource-exhaustion. | Plan author | 2026-05-26 |
| AR-15-04 | T-15-02-04 | D-01 design intent is "preserve on hide in store, drop on submit"; a future audit trail of stripped values is out of scope for Phase 15. | Plan author | 2026-05-26 |
| AR-15-05 | T-15-03-05 | Save-rejection JSON Error already captured by Next.js server-action telemetry; no new audit surface required. | Plan author | 2026-05-26 |
| AR-15-06 | T-15-04-03 | `evaluateVisibility` recompute is pure O(entities × rules) — single-digit-millisecond for 100-entity / 50-rule forms. Bounded by save-time DAG validation. | Plan author | 2026-05-26 |
| AR-15-07 | T-15-06-03 | `surface` prop is purely visual (colour-token selection); no security-relevant branching. | Plan author | 2026-05-26 |
| AR-15-08 | T-15-06-04 | Rules stored in `template_versions.schema_json` already protected by Phase 13 template-version RLS. No new exposure. | Plan author | 2026-05-26 |
| AR-15-09 | T-15-07-01 | Banner/toast copy derives from admin-authored entity labels + fixed UI-SPEC strings; no new injection vector beyond existing label storage. | Plan author | 2026-05-26 |
| AR-15-10 | T-15-07-04 | Publish-blocked tooltip is advisory only; server-side `validateRuleGraph` reject is the authoritative gate even if a user re-enables the button. | Plan author | 2026-05-26 |
| AR-15-11 | T-15-07-05 | Existing Next.js error pipeline logs server-action throws; this plan adds a UI surface, not an audit boundary. | Plan author | 2026-05-26 |
| AR-15-12 | T-15-08-02 | Smoke template is a test fixture; deliberate cycles (UAT section E) are removed (section F) before any real submission. `validateRuleGraph` prevents accidental cycle publication via normal save. | Plan author | 2026-05-26 |
| AR-15-13 | T-15-08-03 | supabase-888 MCP requires service-role authenticated access; same boundary as any other prod read. Documented in 15-UAT.md. | Plan author | 2026-05-26 |
| AR-15-14 | T-15-08-04 | Playwright e2e spec runs on CI / dev only; no production impact. | Plan author | 2026-05-26 |

---

## Unregistered Flags

None. Every `## Threat Flags` / `## Threat Surface Scan` entry in the 9 SUMMARY.md files maps back to an existing T-15-XX-YY ID in the register.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-29 | 42 | 42 | 0 | gsd-secure-phase (State B — verify-from-artifacts) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (14 entries)
- [x] `threats_open: 0` confirmed
- [x] `status: secured` set in frontmatter
- [x] Every `mitigate` threat verified by grep / read at the named call site
- [x] No unregistered threat flags

**Approval:** verified 2026-05-29
