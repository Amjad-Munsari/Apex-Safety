# Phase 7: AI Report Pipeline — Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 6 (3 extended, 3 new)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/admin/assessments/actions.ts` (extend `runReportDraftGeneration` + `finalizeReport`) | server-action / service | event-driven + file-I/O | self (in-file extension) + `app/api/cron/expiry/route.ts:102-122` (dispatch + workflow_errors fallback) | exact |
| `app/admin/assessments/[id]/review/review-client.tsx` (extend) | component | request-response (React state + Server Action call) | self (in-file extension) | exact |
| `lib/notifications/n8n-dispatch.ts` (extend `NotificationPayload` union) | utility / typed dispatcher | request-response | self (extend the discriminated union) | exact |
| `lib/ai/exemplars/yellow-broom-fra.ts` (NEW) | utility / static data module | transform (string export) | `lib/form-builder/risk/pas79.ts:1-20` (pure data module exporting typed constants) | role-match |
| `lib/ai/exemplars/site-risk.ts` (NEW — stub) | utility / static data module | transform | same as above | role-match |
| `lib/ai/prompt-builder.ts` (NEW) | utility / pure function | transform | `lib/form-builder/expand-repeating-sections.ts:19-22` (pure schema+data → string/object transformer) | role-match |

---

## Pattern Assignments

### `app/admin/assessments/actions.ts` — extend `runReportDraftGeneration` (D-02, D-10)

**Analog (self):** `app/admin/assessments/actions.ts:405-512`
**Workflow-error wrap analog:** `app/api/cron/expiry/route.ts:111-122` + `app/admin/compliance/actions.ts:79-88`

**Existing prompt site to replace** (`actions.ts:466-472`) — the prompt is currently inlined as a single template literal. The planner should refactor this to call `buildReportPrompt(...)` from the new `lib/ai/prompt-builder.ts`:
```typescript
const { object } = await generateObject({
  model: openai('openai/gpt-4o-mini'),
  schema: reportSchema,
  prompt: `Act as a Fire Risk Assessor. Draft a professional report based on the following raw assessment answers:\n\n${JSON.stringify(expandedAnswers, null, 2)}\n\nDo NOT invent any hazards that are not explicitly stated in the input data. Summarize appropriately.`,
})
```

**Workflow-errors wrap pattern to apply (D-10)** — copy structure from `expiry/route.ts:111-122`:
```typescript
// existing pattern in expiry/route.ts (lines 111-122)
const result = await dispatchNotification(payload)
if (!result.ok) {
  console.error(`[cron/expiry] dispatch failed for doc ${doc.id}: ${result.error}`)
  await supabase.from("workflow_errors").insert({
    workflow_name: "expiry_alert",
    error_message: result.error ?? "unknown dispatch failure",
    payload: payload,
  })
  continue
}
```

**SCHEMA NOTE (critical correction to CONTEXT.md D-10/D-08 wording):**
The `workflow_errors` table (`supabase/migrations/001_initial_schema.sql:188-196`) has columns:
- `workflow_name TEXT NOT NULL` (NOT `workflow_type`)
- `error_message TEXT NOT NULL`
- `payload JSONB`
- `resolved BOOLEAN`, `created_at`, `deleted_at`
There is **no `severity` column**. CONTEXT D-10 says `workflow_type='ai_report_draft', severity='high'` — the planner MUST translate this to:
- `workflow_name: 'ai_report_draft'`
- Optionally embed severity inside `payload.severity` if Matt wants it surfaced later
- D-08's `workflow_type='report_delivery_email'` → `workflow_name: 'report_delivery_email'`

The wrap goes around the `generateObject` call inside `runReportDraftGeneration`. Concrete shape:
```typescript
try {
  const { object } = await generateObject({ /* ... existing call ... */ })
  // ... existing success path (lines 474-491) ...
} catch (err: any) {
  // D-10: log to workflow_errors BEFORE flipping status / rethrowing
  await adminClient.from("workflow_errors").insert({
    workflow_name: "ai_report_draft",
    error_message: err?.message ?? String(err),
    payload: { submission_id: submissionId, stack: err?.stack ?? null, severity: "high" },
  })
  // D-10: flip status so Review page can show retry CTA instead of empty-state
  await adminClient
    .from("form_submissions")
    .update({ status: "ai_draft_failed" })
    .eq("id", submissionId)
  revalidatePath(`/admin/assessments/${submissionId}/review`)
  throw new Error(`Failed to generate report draft via AI: ${err.message || String(err)}`)
}
```

**Exemplar injection (D-02):**
```typescript
import { YELLOW_BROOM_EXEMPLAR } from "@/lib/ai/exemplars/yellow-broom-fra"
import { buildReportPrompt } from "@/lib/ai/prompt-builder"

// replace inline prompt string with:
const prompt = buildReportPrompt({
  exemplar: YELLOW_BROOM_EXEMPLAR,
  exemplarLabel: "YELLOW BROOM 2023 FRA, anonymised",
  expandedAnswers,
})
```

---

### `app/admin/assessments/actions.ts` — extend `finalizeReport` (D-05, D-07, D-08)

**Analog (self):** `app/admin/assessments/actions.ts:673-757`
**Dispatch-with-fallback analog:** `app/admin/compliance/actions.ts:36-97` (`sendManualExpiryReminder`)

**Existing signed-URL pattern to copy for the 7-day client URL** (`actions.ts:751-754`):
```typescript
const { data: signedUrlData } = await adminClient
  .storage
  .from("reports")
  .createSignedUrl(fileName, 60 * 5) // 5 minute link
```

**D-07 + D-08 wiring — insert AFTER the status flip succeeds (`actions.ts:743-748`), BEFORE the existing 5-min signed-URL return:**
```typescript
// after the status='completed' update succeeds (line 745)
// D-07: separate 7-day signed URL for client email
const { data: clientSigned } = await adminClient
  .storage
  .from("reports")
  .createSignedUrl(fileName, 60 * 60 * 24 * 7) // 7-day link for client

// D-08: dispatch via n8n with workflow_errors fallback (NEVER rolls back the PDF)
const payload = {
  type: "report_ready" as const,
  client_email: contactEmail,
  client_name: client?.name ?? "there",
  report_url: clientSigned?.signedUrl ?? "",
  assessment_date: assessmentDate,
  report_storage_path: fileName,
}
const dispatchResult = await dispatchNotification(payload)
let deliveryEmailFailed = false
if (!dispatchResult.ok) {
  deliveryEmailFailed = true
  await adminClient.from("workflow_errors").insert({
    workflow_name: "report_delivery_email",
    error_message: dispatchResult.error ?? "unknown dispatch failure",
    payload: { ...payload, severity: "high" },
  })
  // do NOT throw — PDF is the artefact of record (D-08)
}
```

**Contact email lookup pattern** (copy from `cron/expiry/route.ts:87-100`):
```typescript
const { data: clientUsers } = await adminClient
  .from("client_users")
  .select("name, email")
  .eq("client_id", submission.client_id)
  .limit(1)
const contact = clientUsers?.[0]
const contactEmail = contact?.email
```

**Return shape extension:** existing `return { success, downloadUrl }` (line 756) becomes `return { success, downloadUrl, deliveryEmailFailed }` so the client can surface the non-blocking toast from D-08.

**D-06 unit-test contract:** assert `dispatchNotification` is not called by `runReportDraftGeneration` (i.e., the `after()` callback in `submitAssessmentAction`). The draft path must only write `draft_report_json` + status.

---

### `app/admin/assessments/[id]/review/review-client.tsx` — extend with D-04 + D-11

**Analog (self):** `review-client.tsx:1-221` — already wires `generateReportDraft`, `finalizeReport`, severity colour map, editable draft state.

**Server Component data extension required** (`app/admin/assessments/[id]/review/page.tsx:8-12`):
```typescript
// current (page.tsx:8-12) — fetches submission only
const { data: submission } = await adminClient
  .from("form_submissions")
  .select(`*`)
  .eq("id", id)
  .single()
```

Extend to also fetch the pinned schema (for field labels) and field_media STT rows for the D-04 raw-answers panel:
```typescript
// add a second fetch (two-step pattern — never FK-join)
const { data: version } = await adminClient
  .from("template_versions")
  .select("schema_json")
  .eq("id", submission.template_version_id)
  .single()

// STT transcripts for the raw-answers panel (D-04)
const { data: audioMedia } = await adminClient
  .from("field_media")
  .select("field_id, storage_path, transcript")
  .eq("submission_id", id)
  .eq("media_type", "audio")
```
Pass `version.schema_json` and `audioMedia` as props alongside `submission`.

**D-04 raw-answers panel** — add a collapsible above the Executive Summary block (current lines 102-112). Pattern:
- Default `open=false` when `submission.draft_report_json` exists
- Default `open=true` (one-time auto-expand) when draft is freshly generated — drive via a `defaultOpen` prop
- Each row: `[field label] · [value or STT transcript text]`
- Walk `schema_json.entities` flat, look up `submission.answers_json[entityId]`, fall back to `audioMedia` row where `field_id === entityId`

**D-11 retry CTA** — extend the existing empty-state block (current lines 73-90). When `submission.status === 'ai_draft_failed'`, render a distinct "Retry draft" CTA instead of (or in addition to) the existing "Generate AI Draft" copy:
```typescript
// inside the !draft branch
const failed = submission.status === "ai_draft_failed"
return (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <h2 className="font-serif text-2xl text-white">
      {failed ? "AI Draft Failed" : "No AI Draft Yet"}
    </h2>
    <p className="text-white/50 text-sm max-w-md text-center">
      {failed
        ? "The previous AI generation failed. See /admin/month-summary for the logged error, then retry."
        : "The assessment has been submitted. Click below to generate an AI draft from the raw answers."}
    </p>
    <Button id="generate-draft-btn" onClick={handleGenerate} disabled={generating} className="bg-white text-black hover:bg-white/90 mt-4">
      {generating ? "Generating..." : failed ? "Retry Draft" : "Generate AI Draft"}
    </Button>
  </div>
)
```

**Delivery-failed toast (D-08):**
```typescript
// inside handleApprove, after finalizeReport returns
if (result.deliveryEmailFailed) {
  toast.warning("Report saved, email retry queued")
} else {
  toast.success("PDF generated and saved!")
}
```

---

### `lib/notifications/n8n-dispatch.ts` — extend `NotificationPayload` union (D-07)

**Analog (self):** `lib/notifications/n8n-dispatch.ts:3-29` — discriminated union with `type` field; existing `dispatchNotification` (lines 37-67) is provider-agnostic and forwards the union shape verbatim to n8n.

**Existing union pattern** (lines 3-29) to copy:
```typescript
export type NotificationPayload =
  | {
      type: "expiry_alert"
      client_email: string
      client_name: string
      document_name: string
      expiry_date: string
      days_until_expiry: number
    }
  | {
      type: "document_uploaded"
      // ...
    }
  | {
      type: "assignment_reminder"
      cadence: "7d" | "1d" | "overdue"
      // ...
    }
```

**Add the D-07 variant** (literal text from CONTEXT §D-07):
```typescript
  | {
      type: "report_ready"
      client_email: string
      client_name: string
      report_url: string         // 7-day signed URL
      assessment_date: string    // en-GB formatted, matches PDF header
      report_storage_path: string // for n8n logging / dedup
    }
```

`dispatchNotification` body (lines 37-67) requires **no change** — it `JSON.stringify`s the entire payload and posts to `N8N_WEBHOOK_URL` with the `X-Webhook-Secret` header. Email subject (per CONTEXT §specifics: `"Your Fire Risk Assessment is ready — {client_name}"`) is rendered n8n-side from the payload fields.

---

### `lib/ai/exemplars/yellow-broom-fra.ts` (NEW — D-02)

**Analog:** `lib/form-builder/risk/pas79.ts:1-20` — pure data module, project header comment, exported typed constants, no side effects.

**Imports pattern** (pas79.ts:1-7):
```typescript
// lib/form-builder/risk/pas79.ts
// 888 Safety & Training Platform
//
// TODO: PAS 79 band boundaries are practitioner convention (RESEARCH Assumption A1) —
// Matt must verify against BSI PAS 79-1:2020 before Phase 14 ships.
```

**Export shape to use** (per CONTEXT D-02 — string export, ≤ 2KB, labelled JSON matching `reportSchema`):
```typescript
// lib/ai/exemplars/yellow-broom-fra.ts
// 888 Safety & Training Platform
//
// Few-shot exemplar for AI report drafting (Phase 7 D-02).
// Source: YELLOW BROOM 2023 FRA, anonymised (client → "Acme Properties Ltd",
// site → "12 Example Street"). Hazard structure and recommended-action tone
// preserved verbatim from Matt's signed-off report. Keep ≤ 2KB.

export const YELLOW_BROOM_EXEMPLAR = `{
  "executiveSummary": "...",
  "hazards": [
    { "location": "...", "description": "...", "severity": "Medium", "recommendedAction": "..." }
  ],
  "complianceStatus": "Action Required"
}` as const
```

**Critical contract:** content must match `reportSchema` shape (actions.ts:455-464) exactly. Do NOT include real client identifiers.

---

### `lib/ai/exemplars/site-risk.ts` (NEW — D-02 stub)

**Analog:** same as yellow-broom-fra.ts. CONTEXT §deferred says the real Site Risk example is blocked on Matt. Ship as a stub that exports the same name shape so the wiring is symmetric.

```typescript
// lib/ai/exemplars/site-risk.ts
// 888 Safety & Training Platform
//
// STUB — blocked on completed Site Risk example from Matt (07-CONTEXT §deferred).
// Populate when available; the consumer in lib/ai/prompt-builder.ts will pick
// the correct exemplar by template type.

export const SITE_RISK_EXEMPLAR: string | null = null
```

---

### `lib/ai/prompt-builder.ts` (NEW)

**Analog:** `lib/form-builder/expand-repeating-sections.ts:19-22` — pure function, takes schema + data, returns transformed shape, no I/O.

**Imports + signature pattern** (expand-repeating-sections.ts:19-22):
```typescript
export function expandRepeatingSections(
  schema: { entities: Record<string, { type: string; children?: string[]; attributes?: Record<string, unknown> }> },
  answers: Record<string, unknown>
): Record<string, unknown> {
```

**Shape to implement** (assembles persona + no-hallucination guard + exemplar + answers per CONTEXT §specifics and D-02):
```typescript
// lib/ai/prompt-builder.ts

const PERSONA = "You are a UK Fire Risk Assessor drafting an official report under the Regulatory Reform (Fire Safety) Order 2005. You are assisting Matt Robinson, the competent person, who will review every output before delivery."

const NO_HALLUCINATION = "Every hazard in your output MUST trace to an explicit statement in the input answers. If the data is silent on a topic, omit it — do not infer."

export function buildReportPrompt(args: {
  exemplar: string
  exemplarLabel: string  // e.g. "YELLOW BROOM 2023 FRA, anonymised"
  expandedAnswers: Record<string, unknown>
}): string {
  return [
    PERSONA,
    NO_HALLUCINATION,
    `Few-shot reference: ${args.exemplarLabel}`,
    args.exemplar,
    "Now draft a report from these answers:",
    JSON.stringify(args.expandedAnswers, null, 2),
  ].join("\n\n")
}
```

The persona and no-hallucination strings are locked text from CONTEXT §specifics — do NOT paraphrase.

---

## Shared Patterns

### Two-step pinned-template fetch (NEVER FK-join)
**Source:** `app/admin/assessments/actions.ts:240-259` and `actions.ts:413-436`
**Apply to:** Any new code path that reads `template_versions.schema_json` from a `form_submissions` row (the extended `runReportDraftGeneration` already follows it; the extended `ReviewPage` must too).
```typescript
const { data: submission } = await adminClient
  .from("form_submissions")
  .select("template_version_id, ...")
  .eq("id", submissionId).single()

const { data: version } = await adminClient
  .from("template_versions")
  .select("schema_json")
  .eq("id", submission.template_version_id).single()
```

### Auth gate on Server Actions
**Source:** `app/admin/assessments/actions.ts:504-509` (`generateReportDraft`) and `actions.ts:681-686` (`finalizeReport`)
**Apply to:** Any new exported Server Action.
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error("Unauthorized: Authentication required to ...")
```
The wrapped `runReportDraftGeneration` (internal, not exported) does NOT need this — it's called from authenticated entry points only.

### `workflow_errors` insert (D-08, D-10)
**Source:** `app/api/cron/expiry/route.ts:115-119` and `app/admin/compliance/actions.ts:82-86`
**Apply to:** Both the D-10 wrap around `generateObject` and the D-08 dispatch fallback in `finalizeReport`.
```typescript
await adminClient.from("workflow_errors").insert({
  workflow_name: "<literal-tag>",
  error_message: <string>,
  payload: <jsonb>,
})
```
**Schema constraint** — only `workflow_name`, `error_message`, `payload` exist as input columns. Embed `severity` inside `payload` if needed.

### Storage signed URL
**Source:** `app/admin/assessments/actions.ts:751-754`
**Apply to:** Both Matt's 5-min download URL (existing) and the new 7-day client URL (D-07).
```typescript
const { data: signedUrlData } = await adminClient
  .storage
  .from("reports")
  .createSignedUrl(fileName, 60 * 5) // or 60 * 60 * 24 * 7 for the client email
```

### `revalidatePath` after status flip
**Source:** `app/admin/assessments/actions.ts:487-489` and `actions.ts:747-748`
**Apply to:** Every new `update({ status })` write (including the new `ai_draft_failed` flip).
```typescript
revalidatePath("/admin/review-queue")
revalidatePath(`/admin/assessments/${submissionId}/review`)
```

### Discriminated-union `type` payload to n8n
**Source:** `lib/notifications/n8n-dispatch.ts:3-29` + consumer pattern at `app/admin/compliance/actions.ts:70-79`
**Apply to:** D-07 `report_ready` dispatch.
```typescript
const payload = { type: "report_ready" as const, /* fields per D-07 */ }
const result = await dispatchNotification(payload)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All six files have at least a role-match analog in the codebase. |

---

## Critical Corrections Surfaced During Mapping

The planner MUST reconcile these against CONTEXT.md before writing plans:

1. **`workflow_errors` schema mismatch.** CONTEXT D-08/D-10 reference `workflow_type` and `severity` columns. The actual table (`migrations/001:188-196`) has `workflow_name` + `error_message` + `payload` + `resolved`. Translate: `workflow_type` → `workflow_name`; `severity` → embed in `payload`. **No new migration is permitted** (CONTEXT D-09).
2. **Existing `submitAssessmentAction` already inserts `workflow_errors` rows** with `workflow_name: "assessment-submission-webhook"` (`actions.ts:389-393`). Follow the same `workflow_name` literal style (kebab-case OR snake_case — pick one; existing codebase mixes; D-10 uses snake_case `ai_report_draft`).
3. **`ReviewPage` Server Component** (`page.tsx:5-19`) currently only fetches `form_submissions.*`. D-04 raw-answers panel needs the pinned schema and `field_media` audio rows — extend the page fetch, not the client component.
4. **No existing `lib/ai/` directory.** First file in `lib/ai/exemplars/` will need to be created together with the directory.

---

## Metadata

**Analog search scope:** `app/admin/assessments/`, `app/admin/compliance/`, `app/api/cron/`, `app/admin/month-summary/`, `lib/notifications/`, `lib/form-builder/`, `supabase/migrations/`
**Files scanned (Read):** 8 ; **Files scanned (Grep/Glob):** 12
**Pattern extraction date:** 2026-05-29

---

## PATTERN MAPPING COMPLETE

**Phase:** 07 - ai-report-pipeline
**Files classified:** 6
**Analogs found:** 6 / 6

### Coverage
- Files with exact analog: 3 (the three "extend" files — self analogs)
- Files with role-match analog: 3 (the three new `lib/ai/` files)
- Files with no analog: 0

### Key Patterns Identified
- All AI/PDF mutations live in `app/admin/assessments/actions.ts` as Server Actions with `createClient().auth.getUser()` gates; admin writes go through `adminClient` (service-role) to bypass RLS-silent-zero-row failures
- `workflow_errors` rows are inserted inline at the failure site with literal `workflow_name`, `error_message`, `payload` columns — NEVER `workflow_type` or `severity` as standalone columns
- n8n dispatch is a discriminated union (`NotificationPayload`) sent verbatim to `N8N_WEBHOOK_URL`; add new variants by extending the union — no helper changes
- Pinned template fetches always use the two-step (submission → template_version) pattern; never FK-join

### File Created
`.planning/phases/07-ai-report-pipeline/07-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
