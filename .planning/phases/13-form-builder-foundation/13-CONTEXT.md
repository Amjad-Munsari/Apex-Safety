# Phase 13: Form Builder Foundation - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 replaces the existing hand-rolled dnd-kit form builder with a `@coltorapps/builder` foundation. It delivers: the 7 basic field-type entities, a three-panel builder UI (palette / canvas / properties), immutable schema versioning, and a coltorapps-interpreter-based renderer. The cutover is **big-bang** — the custom builder, the custom renderer, and the custom `FormSchema` shape are all removed in this phase, and the Phase 6 assessment fill flow moves onto the coltorapps interpreter.

**In scope:** coltorapps integration; 7 basic entities (text, number, date, select, textarea, checkbox, sectionGroup); builder UI; save→version→publish→preview flow; interpreter renderer; submission pinning; re-wiring assessment renderer call sites.

**Out of scope (later phases):** custom field types (Phase 14), conditional logic / `visibilityRules` (Phase 15), fork-on-fill / assignment (Phase 16), the full FRA reseed (Phase 18).

</domain>

<decisions>
## Implementation Decisions

### Builder Engine
- **D-01:** Adopt `@coltorapps/builder` + `@coltorapps/builder-react`. Rebuild the form builder on coltorapps' entity / attribute / builder-store / interpreter-store model. This replaces the hand-rolled builder that was shipped (outside the formal GSD phases) between Phases 3–12. Re-aligns with PROJECT.md's documented "Coltorapps for Phase 2 form builder" Key Decision — the custom build was the drift.
- **D-02:** `@dnd-kit/*` (already installed) is retained only as the drag layer *inside* the coltorapps builder UI — palette→canvas drop, reorder, reparent. coltorapps owns schema + state; dnd-kit owns pointer interaction.

### Cutover Strategy
- **D-03:** **Big-bang cutover within Phase 13.** Custom builder *and* custom renderer are both replaced in this phase — no parallel/feature-flagged transition. The Phase 6 assessment fill flow switches to the coltorapps interpreter immediately; re-wiring those renderer call sites is in Phase 13 scope.
- **D-04:** Accepted regression: signature / rating / multi-photo / geolocation / repeating field types are dropped at cutover and do **not** return until Phase 14. Forms/templates using them are unusable between Phases 13 and 14. This is an accepted cost — pre-launch dev/demo build.

### Existing Data
- **D-05:** **Drop & reseed.** Existing `form_templates` / `form_template_versions` / `form_submissions` / assessment rows (custom `FormSchema` shape) are disposable dev/demo data — wiped, not migrated. No `FormSchema`→coltorapps converter is built.
- **D-06:** Phase 13 reseeds only a minimal **basic-types smoke-test template** (7 basic types) to exercise the build→save→version→fill→submit loop. The real FRA reseed is Phase 18.
- ⚠️ **Planner/executor pre-condition:** confirm there is no production assessment data before wiping. Scale is ~7–8 clients, pre-launch — expected safe, but verify, don't assume.

### Schema Contract
- **D-07:** The live schema contract is migration `003` (+ `004`, `005`) — `owner_id` polymorphic, `owner_type IN ('admin','customer')`, `parent_template_id` for forks. The build prompt's draft SQL (`owner_type IN ('admin','client')`, `owner_id REFERENCES auth.users(id)`, table named `template_versions`) is **subordinate** and must NOT reshape the existing contract. Per AGENTS.md: don't reshape without re-checking with Finley.
- **D-08:** The `schema_json` column shape changes from custom `FormSchema` to coltorapps `{ entities, root }`. Because of drop & reseed (D-05) no mixed-shape version rows exist — the renderer only ever sees coltorapps shape. The immutable-version-pinning rule still holds: every submission pins to its `template_version_id` and renders against that version's schema, never the latest.

### Field Scope
- **D-09:** Strict — only the 7 basic entities per the build prompt (`textField`, `numberField`, `dateField`, `selectField`, `textareaField`, `checkboxField`, `sectionGroup`), including the `prefillSource` attribute on text/date fields. Custom field types, `visibilityRules`, and per-field photo attach are explicitly OUT of Phase 13.

### Claude's / Planner's Discretion
- **Field-component reuse** — whether to wrap the existing `components/forms/*-field.tsx` as coltorapps entity render components, or write fresh. Default lean: reuse them as the render layer where clean (they already match the 888 dark theme); only the builder engine + stores are net-new.
- **Builder route** — keep the existing `/admin/templates` + `/admin/templates/[id]` routes vs the build prompt's `/admin/form-builder/[templateId]`. Default lean: keep `/admin/templates` (nav + client surface already wired); the build prompt's path is not load-bearing.
- coltorapps **React 19.2.4 compatibility** is a researcher task. If incompatible it is a hard blocker to escalate before planning — no fallback engine has been chosen.
- API route shape for versions/submissions; server-side `validateSchema` + `validateEntitiesValues` wiring.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build spec
- `.planning/research/form-builder-build-prompt.md` — Spec of record for the whole Form Builder Module. Phase 13 == its "Phase 1 — Foundation" section. **Read first.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` § Phase 13 — Goal + success criteria
- `.planning/REQUIREMENTS.md` / ROADMAP § v2 — BUILDER-01..05 cluster (formal re-quote still pending)

### Architecture & contracts
- `AGENTS.md` — form-template ownership decision (Option 3, 2026-04-17); "form builder code MUST NOT be hardcoded to admin-only — keep the component reusable across surfaces."
- `supabase/migrations/003_form_template_customer_ownership.sql` — live `owner_id` / `owner_type` / `parent_template_id` contract (authoritative over the build prompt's draft SQL)
- `supabase/migrations/004_form_templates_rls_fixes.sql`, `supabase/migrations/005_template_versions_polymorphic_created_by.sql` — current RLS + version-row contract
- `.planning/PROJECT.md` § Constraints + Key Decisions — schema versioning from day one, Coltorapps decision, tablet-primary, eu-west-2 region lock

### Prior phase context
- `.planning/phases/02-form-prerequisites/02-CONTEXT.md` — renderer / media / draft-sync decisions. ⚠️ Its STT decision (D-01, OpenAI Whisper via OpenRouter) is STALE — commit d2651a4 replaced it with the Web Speech API (en-GB). The renderer/media/draft decisions still hold.
- `.planning/phases/03-template-system-schema-versioning/03-1-SUMMARY.md` — what Phase 3 claimed shipped (note: the actual builder code in the tree substantially exceeds this summary).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/forms/{checkbox,date,number,...}-field.tsx` — existing field UI components, already on the 888 dark theme; candidates to wrap as coltorapps entity renderers.
- `lib/supabase/templates.ts` — `getFormTemplates()` server-only query; keep the server-only access pattern.
- `lib/forms/fra-template.ts` — current FRA template (custom shape); reference material for the Phase 18 reseed, not used directly in 13.
- `@dnd-kit/{core,sortable,utilities}` — already installed; reuse as the drag layer.

### Established Patterns
- Server-only Supabase access via `createServerClient`; admin gate via `proxy.ts` middleware.
- Next.js 16.2.4 App Router, React 19.2.4, Tailwind 4.
- Sequential numbered SQL migrations in `supabase/migrations/`.

### Integration Points
- `app/admin/templates/` (list + `[id]` editor) — primary builder surface.
- `app/client/templates/` — client builder surface; must keep working (AGENTS.md reusability rule).
- The Phase 6 assessment flow consumes `components/forms/form-renderer.tsx` — call sites must be re-pointed to the coltorapps interpreter (D-03).
- **coltorapps is NOT installed** — `npm install @coltorapps/builder @coltorapps/builder-react`.

### Being Replaced (big-bang — D-03)
- `components/templates/{template-builder,field-palette,field-config,sortable-field}.tsx`
- `components/forms/form-renderer.tsx`
- `lib/types/form-builder.ts` (`FormField` / `FormSchema` / `FormTemplate` / `TemplateVersion` types)

</code_context>

<specifics>
## Specific Ideas

- Three-panel builder layout from the build prompt: field palette (left, draggable) / canvas with drop zones (centre) / properties panel (right, writes to builder store immediately).
- Save flow: serialise builder store → POST → new immutable `template_versions` row with `version_number = max + 1`. Publish sets `published_at` + `form_templates.status = 'published'`. Preview = interpreter-mode toggle on the canvas, no data saved.
- Critical rule (build prompt): a submission ALWAYS renders against its pinned `version_id` schema, never the current/latest.
- Full-stack validation: client-side `validateEntitiesValues` on submit; `validateSchema` + `validateEntitiesValues` again server-side before the DB write.

</specifics>

<deferred>
## Deferred Ideas

- Custom field types (signature / rating / multi-photo / geolocation / repeating / computed) on coltorapps — **Phase 14**.
- Per-field photo attach (`attachPhotos`) and speech-to-text on text fields — **Phase 14**. (STT already uses the Web Speech API per commit d2651a4 — no engine conflict to resolve.)
- Conditional logic / `visibilityRules` — **Phase 15**.
- Fork-on-fill, template assignment, client-built-from-scratch flows — **Phase 16**.
- Recurrence / scheduling / reminders — **Phase 17**.
- Full FRA template reseed in coltorapps shape — **Phase 18**.
- Builder route rename to `/admin/form-builder` — planner's discretion, not its own phase.

</deferred>

---

*Phase: 13-form-builder-foundation*
*Context gathered: 2026-05-20*
