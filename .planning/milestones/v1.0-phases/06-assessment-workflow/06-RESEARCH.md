# Phase 6: Assessment Workflow — Research

**Phase:** 6 — Assessment Workflow
**Researched:** 2026-04-30
**Requirements:** ASMT-01, ASMT-02, ASMT-03, ASMT-04, ASMT-05, ASMT-06

---

## Research Summary

Phase 6 wires the existing FormRenderer into a full admin-side assessment lifecycle: create a form_assignment + form_submission atomically, autosave answers_json as the form fills, detect and recover drafts, append an "anything else" section, submit with a fire-and-forget n8n webhook, and redirect to the client profile. The critical schema constraint is `form_submissions.assignment_id NOT NULL` — the unassigned flow must create a `form_assignments` row first. All data mutations use Next.js 16 server actions with the async `cookies()` API and Supabase admin client; progress tracking and autosave are client-side state.

---

## Key Technical Decisions

1. **Unassigned flow must create form_assignment first** — `form_submissions.assignment_id` is `NOT NULL REFERENCES form_assignments(id)`. Matt starting an assessment "without prior assignment" means we create an ephemeral `form_assignments` row (status: `'assigned'`) immediately, then create `form_submissions` referencing it. This is a two-insert sequence in a single server action.

2. **Autosave via debounced server action on `answers_json`** — 800ms debounce on field change. Uses `supabase.from('form_submissions').update({ answers_json: data }).eq('id', submissionId)` from admin client (bypasses RLS). Debounce resets on every keystroke; flush on page-unload via `beforeunload`.

3. **Draft recovery is server-side at page load** — The new assessment page `/admin/assessments/new` receives `?clientId=&templateVersionId=` search params. The page server component queries `form_submissions WHERE client_id = ? AND status = 'draft' AND template_version_id = ?` before rendering. If a draft exists, it passes `existingDraftId` to the client component, which shows the `AlertDialog` before rendering the form.

4. **Progress calculation** — Walk `schema_json.sections[].fields[]` from the template_version. Count fields where `field.required === true`. Progress = `requiredFilled / totalRequired * 100`. For non-required forms (all required=false), use total filled / total fields. Cap at 99% until submitted.

5. **n8n webhook is fire-and-forget** — On submit, after `update form_submissions SET status='submitted', submitted_at=NOW()`, call `fetch(process.env.N8N_ASSESSMENT_WEBHOOK_URL, { method: 'POST', body: JSON.stringify({submissionId}), headers: {'Content-Type': 'application/json'} })` with `{ signal: AbortSignal.timeout(3000) }`. Do NOT await success — catch and log to `workflow_errors` if it fails. This is a server action (never expose webhook URL client-side).

6. **Route structure** — `/admin/assessments/new` (GET with ?clientId&templateVersionId search params) creates the assignment+submission and redirects to `/admin/assessments/[submissionId]`. The `[submissionId]` page is the live form. This keeps URLs bookmarkable and enables true draft recovery.

7. **"Anything else" appendix** — NOT a schema field added to template_json. Instead, a hardcoded final section rendered after the FormRenderer output, storing into `answers_json['__appendix_notes']` and `answers_json['__appendix_media']`. This avoids modifying template schemas.

---

## Implementation Patterns

### Pattern 1: Create Assignment + Submission (Server Action)

```typescript
// app/admin/assessments/actions.ts
'use server'
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'

export async function startAssessment(clientId: string, templateVersionId: string) {
  const cookieStore = await cookies()
  // Get current admin user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get templateId from version
  const admin = createAdminClient()
  const { data: version } = await admin
    .from('template_versions')
    .select('template_id')
    .eq('id', templateVersionId)
    .single()
  if (!version) throw new Error('Template version not found')

  // 1. Create form_assignment
  const { data: assignment, error: aErr } = await admin
    .from('form_assignments')
    .insert({
      client_id: clientId,
      template_id: version.template_id,
      template_version_id: templateVersionId,
      assigned_by: user.id,
      status: 'assigned',
    })
    .select('id')
    .single()
  if (aErr) throw aErr

  // 2. Create form_submission
  const { data: submission, error: sErr } = await admin
    .from('form_submissions')
    .insert({
      assignment_id: assignment.id,
      client_id: clientId,
      template_version_id: templateVersionId,
      answers_json: {},
      submitted_by: user.id,
      status: 'draft',
    })
    .select('id')
    .single()
  if (sErr) throw sErr

  redirect(`/admin/assessments/${submission.id}`)
}
```

### Pattern 2: Autosave Server Action

```typescript
// app/admin/assessments/[id]/actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function autosaveAnswers(
  submissionId: string,
  answersJson: Record<string, unknown>
) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('form_submissions')
    .update({ answers_json: answersJson })
    .eq('id', submissionId)
    .eq('status', 'draft')
  if (error) console.error('[autosave] failed:', error)
  // Non-throwing — autosave failures are silent (data is in client state)
}
```

**Client-side debounce pattern:**
```typescript
const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function handleFieldChange(fieldId: string, value: unknown) {
  const next = { ...answers, [fieldId]: value }
  setAnswers(next)
  if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
  autosaveTimerRef.current = setTimeout(() => {
    void autosaveAnswers(submissionId, next)
    setLastSaved(new Date())
  }, 800)
}

// Flush on unload
useEffect(() => {
  const flush = () => autosaveAnswers(submissionId, answersRef.current)
  window.addEventListener('beforeunload', flush)
  return () => window.removeEventListener('beforeunload', flush)
}, [submissionId])
```

### Pattern 3: Draft Detection (Server Component)

```typescript
// app/admin/assessments/new/page.tsx
import { createAdminClient } from '@/lib/supabase/admin'

export default async function NewAssessmentPage({
  searchParams
}: {
  searchParams: Promise<{ clientId?: string; templateVersionId?: string }>
}) {
  const { clientId, templateVersionId } = await searchParams
  if (!clientId || !templateVersionId) redirect('/admin')

  const admin = createAdminClient()
  const { data: existingDraft } = await admin
    .from('form_submissions')
    .select('id, created_at')
    .eq('client_id', clientId)
    .eq('template_version_id', templateVersionId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <AssessmentSetup
      clientId={clientId}
      templateVersionId={templateVersionId}
      existingDraft={existingDraft ?? null}
    />
  )
}
```

### Pattern 4: Submit + n8n Webhook (Server Action)

```typescript
// app/admin/assessments/[id]/actions.ts
export async function submitAssessment(
  submissionId: string,
  finalAnswers: Record<string, unknown>
) {
  const admin = createAdminClient()

  // 1. Update submission status
  const { data: sub, error } = await admin
    .from('form_submissions')
    .update({
      answers_json: finalAnswers,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .eq('status', 'draft')
    .select('client_id')
    .single()
  if (error) throw error

  // 2. Fire-and-forget n8n webhook (ASMT-05)
  const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId }),
      signal: AbortSignal.timeout(3000),
    }).catch(async (err) => {
      // Log webhook failure to workflow_errors (non-blocking)
      await admin.from('workflow_errors').insert({
        workflow_name: 'assessment-submission-webhook',
        error_message: String(err),
        payload: { submissionId },
      })
    })
  }

  return { clientId: sub.client_id }
}
```

### Pattern 5: Progress Calculation

```typescript
function calculateProgress(
  schema: FormSchema,
  answers: Record<string, unknown>
): number {
  const requiredFields = schema.sections
    .flatMap(s => s.fields)
    .filter(f => f.required)

  if (requiredFields.length === 0) {
    // No required fields — use overall fill rate, cap at 95%
    const total = schema.sections.flatMap(s => s.fields).length
    const filled = Object.keys(answers).filter(k =>
      !k.startsWith('__') && answers[k] !== '' && answers[k] !== null && answers[k] !== undefined
    ).length
    return total === 0 ? 0 : Math.min(95, Math.round((filled / total) * 95))
  }

  const filled = requiredFields.filter(f => {
    const val = answers[f.id]
    return val !== undefined && val !== null && val !== ''
  }).length

  return Math.round((filled / requiredFields.length) * 99) // cap at 99 until submitted
}
```

### Pattern 6: Routing Flow

```
User clicks "New Assessment" in sidebar
  → Opens AssessmentSelectorDialog (client component, modal)
  → Step 1: Select client (fetched from /api/clients or server action)
  → Step 2: Select template version
  → "Start Assessment" calls startAssessment(clientId, templateVersionId) server action
  → Server action creates assignment + submission
  → redirect('/admin/assessments/[submissionId]')
  → Form page loads with full schema + empty answers (or draft answers if resuming)
```

---

## Schema Notes

Key `form_submissions` columns for this phase:
- `id` UUID — used as the page param
- `assignment_id` UUID NOT NULL — must exist before submission
- `client_id` UUID NOT NULL
- `template_version_id` UUID NOT NULL — pins schema
- `answers_json` JSONB NOT NULL — stores all field answers including `__appendix_notes` and `__appendix_media`
- `status` TEXT — `'draft'` → `'submitted'` → `'draft_ready_for_review'` (Phase 7 sets this) → `'delivered'`
- `submitted_by` UUID — set to admin user id on submit
- `submitted_at` TIMESTAMPTZ — set on submit

**No migration needed** — existing schema fully supports Phase 6.

---

## Risks & Gotchas

1. **`assignment_id NOT NULL` constraint** — If `startAssessment` creates the assignment but the submission insert fails, we have an orphan assignment. Acceptable for MVP — add cleanup logic in Phase 11 if needed. Do NOT try to roll back the assignment (Supabase JS has no transaction API; would need a DB function).

2. **`searchParams` is async in Next.js 16** — `const { clientId } = await searchParams` — must await, not destructure directly. Forgetting this causes a runtime error.

3. **autosave race condition on submit** — Debounce timer may still be pending when user hits "Submit". Flush the timer synchronously before calling `submitAssessment`: `clearTimeout(autosaveTimerRef.current); await autosaveAnswers(submissionId, answers)`. Then call submit.

4. **`form_media_client_upload` RLS only allows client users** — Matt is an admin, not a client_user. Storage uploads for form-media from the admin side must use the **admin service-role client** (via server action), NOT the browser Supabase client. The `form_media_admin_all` policy covers this.

5. **FormRenderer's `onChange` is synchronous** — Do not call the server action directly in `onChange`. Always go through the debounced handler.

6. **Template version selection** — Only show template versions where `published_at IS NOT NULL`. A draft template version (no published_at) should not be available for assessments.

7. **beforeunload autosave is unreliable on iOS Safari** — `beforeunload` does not reliably fire on iPad/iPhone Safari in standalone PWA mode. Supplement with a `visibilitychange` listener: `document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })`.

---

## Validation Architecture

| Requirement | Verification method |
|-------------|---------------------|
| ASMT-01: Admin can assign template to client via form_assignments | `SELECT * FROM form_assignments WHERE client_id = ?` — verify row exists after "Start Assessment" |
| ASMT-02: Assigned client sees "Forms assigned to you" list | Log in as client user, hit `/client/forms` — verify assignment appears (Phase 2 renderer) |
| ASMT-03: Matt opens FRA against any client without prior assignment | Navigate to "New Assessment", select client + template, verify redirect to `/admin/assessments/[id]` without pre-existing assignment |
| ASMT-04: "Anything else" field with STT + photo | Submit an assessment, verify `answers_json.__appendix_notes` and `__appendix_media` present in DB |
| ASMT-05: Submission triggers report pipeline | After submit, check `form_submissions.status = 'submitted'`; verify n8n webhook was called (check n8n execution log or workflow_errors table for no error) |
| ASMT-06: In-progress assessment recoverable after browser close | Navigate away from draft form, re-open "New Assessment" for same client+template, verify draft recovery dialog appears, resume, verify answers persisted |

---

## RESEARCH COMPLETE
