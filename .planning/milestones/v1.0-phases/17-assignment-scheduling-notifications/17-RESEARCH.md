# Phase 17: Assignment Scheduling + Notifications — Research

**Researched:** 2026-05-27
**Domain:** Daily Vercel Cron → n8n webhook reminders + recurrence generation on top of the Phase 16 `form_assignments` schema
**Confidence:** HIGH (every claim is grounded in existing repo code or official Vercel docs; the only `[ASSUMED]` item is Yellow Broom's preferred cadence vocabulary)

---

## Summary

Phase 17 is almost entirely **server-side scheduling glue** on top of Phase 16's schema. The repo already ships:

- a Vercel cron handler (`app/api/cron/expiry/route.ts`) that demonstrates the auth + service-role pattern Phase 17 must mirror,
- the n8n bridge (`lib/notifications/n8n-dispatch.ts`) — a typed discriminated union that already covers `expiry_alert` and `document_uploaded`; Phase 17 adds a new variant,
- the `form_assignments` shape with `due_date DATE`, `status`, `deleted_at`, plus the Phase 16 `instructions` column.

Net-new surface: **one migration (015)**, **one cron route (`/api/cron/assignment-scheduler`)**, **one `vercel.json` entry**, **one new n8n payload variant**, **a recurrence-generation function**, and **a small overdue-badge polish on UI Matt and his clients already see**.

**Primary recommendation:** Mirror `app/api/cron/expiry/route.ts` *verbatim* for auth + service-role client construction. Add the new payload variant to `NotificationPayload` in `lib/notifications/n8n-dispatch.ts` (do NOT create a parallel dispatcher). Use a **nullable JSONB `recurrence_rule` column on `form_assignments`** (option a), not a child table — the only realistic query is "for this completed assignment, generate the next one," which is a per-row lookup. Use `last_reminder_sent TEXT` (single column, locked in CONTEXT) — the lifecycle is monotonic (`NULL → '7d' → '1d' → 'overdue'`), so a JSONB struct buys nothing. **For the overdue UI, ship a server-side derived flag — there is NO database column for overdue.**

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Notification infrastructure**
- All reminders route through n8n to Proton Mail (`888FST@proton.me`). The n8n→Proton bridge is the only outbound email surface.
- NO direct Twilio / Resend integration in Phase 17 (deferred per `memory/deferred_work.md`).
- Cron lives on Vercel Cron (`vercel.json` / Vercel Functions). No third-party scheduler.

**Recurrence semantics**
- On `assignment.status='completed'` with a recurrence rule → generate next occurrence pinned to the *latest published* template_version of the master (or fork's own latest published version for customer-forked templates per Phase 16 D-08).
- Generated row inherits: `client_id`, `template_id`, `assigned_by`, `instructions`.
- Frequency vocab v1: `weekly`, `monthly`, `quarterly`, `annually`. No RRULE.

**Overdue semantics**
- `overdue ⇔ due_date < CURRENT_DATE AND status != 'completed' AND deleted_at IS NULL`.
- Surfaces as visual flag on `/admin/clients/[id]` Assigned Forms tab and `/client/assignments`. Derived state, NOT a DB column.

**Reminder schedule**
- Cadence: 7d before due, 1d before due, on overdue (transition day).
- Dedup via `form_assignments.last_reminder_sent TEXT NULL` (`'7d' | '1d' | 'overdue'`).
- Revoked (`deleted_at IS NOT NULL`) never reminds. Completed never reminds.

**Multi-tenancy invariants**
- All new tables/columns honour cross-org RLS (Phase 16 `tests/rls/multi-tenancy.spec.ts` is the gate).
- `client_id` derives server-side, never from client payload.

### Claude's Discretion
- Recurrence storage shape (column vs. child table) — researched in Q3 below, **column wins**.
- Dedup column shape (TEXT vs JSONB struct) — researched in Q8 below, **TEXT wins**.
- Time-zone handling for "overdue today" — researched in Q6 below.

### Deferred Ideas (OUT OF SCOPE)
- SMS reminders / Twilio.
- Custom RRULE / RFC 5545.
- Bulk reschedule / pause-all admin UI.
- Per-user reminder preferences.
- iCal export.
- Phase 18 FRA seed template work.
</user_constraints>

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Constraint | Source | How Phase 17 honours it |
|------------|--------|--------------------------|
| "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before any Next.js API | AGENTS.md preamble | Cron route is a plain `route.ts` GET handler — same shape as the existing `app/api/cron/expiry/route.ts`. No new Next.js APIs introduced. |
| Polymorphic owner_id contract is sacred | AGENTS.md "Form template ownership" | Phase 17 makes **zero** changes to `form_templates`. All schema changes target `form_assignments` (new `recurrence_rule` + `last_reminder_sent` columns). |
| No mocks in shipped code | MEMORY.md "feedback_no_demo_mocks_in_code" | The dispatcher already handles missing env vars gracefully (`console.warn` + `ok:true` in dev). Do not introduce a `mock_dispatch.ts` — extend the real `n8n-dispatch.ts` discriminated union. |
| Proton Mail is the ONLY outbound channel | MEMORY.md "email_infra.md" | n8n owns delivery. The Phase 17 function only POSTs the payload; routing-to-Proton is n8n's responsibility, not the cron's. |

---

## Open Questions Resolved

### Q1 — Vercel Cron syntax + Next.js 16 integration

**Resolution:** Add a second entry to `vercel.json` `crons[]` array. Authenticate by comparing the `Authorization` header (sent automatically by Vercel as `Bearer ${CRON_SECRET}`) against the env var. Handler is a plain App Router `GET` function — no special signature.

**Critical facts** [CITED: https://vercel.com/docs/cron-jobs, https://vercel.com/docs/cron-jobs/manage-cron-jobs, last updated 2026-04-21]:

1. `vercel.json` schema:
   ```json
   {
     "crons": [
       { "path": "/api/cron/expiry", "schedule": "0 6 * * *" },
       { "path": "/api/cron/assignment-scheduler", "schedule": "0 7 * * *" }
     ]
   }
   ```
2. **Auth pattern Vercel itself documents:**
   ```ts
   const authHeader = request.headers.get('authorization');
   if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```
3. **Timezone:** always UTC. UK is currently BST (UTC+1) in summer, GMT (UTC+0) in winter — see Q6 for handling.
4. **Hobby plan:** cron jobs can only run **once per day** and Vercel may invoke any time within the specified hour. The project is on Pro (existing 6 AM expiry cron has run reliably), so minute-precision applies — but design as if hourly drift were possible (idempotency required).
5. **No retry on failure** — Vercel never retries a failed cron. Idempotency is required because the system "can occasionally deliver the same cron event more than once."
6. **No redirects:** the cron handler must not 3xx — the cron job completes without further requests.
7. **App Router route handler signature** [VERIFIED: `app/api/cron/expiry/route.ts:5`]:
   ```ts
   export async function GET(request: Request) { /* ... */ }
   ```
   No need for `NextRequest` import — `Request` works. (The existing expiry cron uses plain `Request`; mirror that.)

**Suggested schedule:** `0 7 * * *` (07:00 UTC daily). One hour after expiry cron so the two never overlap function quota. In UK summer that's 08:00 BST; in UK winter 07:00 GMT — both well after Matt's morning open.

[CITED: Vercel Cron docs] [VERIFIED: existing `vercel.json` + `app/api/cron/expiry/route.ts`]

### Q2 — n8n webhook contract

**Resolution:** Extend the existing `NotificationPayload` discriminated union in `lib/notifications/n8n-dispatch.ts` with a new `assignment_reminder` variant. Same auth (`X-Webhook-Secret` header, value from `N8N_WEBHOOK_SECRET`), same `N8N_WEBHOOK_URL`, same `dispatchNotification(payload)` call.

**The exact contract** [VERIFIED: `lib/notifications/n8n-dispatch.ts:27-57`]:

- Single endpoint: `process.env.N8N_WEBHOOK_URL`
- Single secret: `process.env.N8N_WEBHOOK_SECRET`
- Method: `POST`
- Headers: `Content-Type: application/json`, `X-Webhook-Secret: <secret>`
- Body: `JSON.stringify(payload)` where `payload` carries a `type` discriminator (`"expiry_alert" | "document_uploaded"` today; Phase 17 adds `"assignment_reminder"`)
- Return shape: `{ ok: boolean; status?: number; error?: string }`
- Behaviour when env vars missing in dev: `console.warn` + returns `{ ok: true, status: 0 }` (dispatch skipped, never throws)
- Behaviour when env vars missing in production: returns `{ ok: false, error: '…' }` — caller's responsibility to handle.

**Failure logging precedent** [VERIFIED: `app/api/cron/expiry/route.ts:113-122`]:
On `result.ok === false`, the expiry cron inserts a row into `workflow_errors` (workflow_name, error_message, payload) and **skips the dedup write** so the next cron tick retries. Phase 17 must mirror this exactly — DO NOT write `last_reminder_sent` if the dispatch failed.

**Phase 17 must extend the union, not branch off:**
```ts
// lib/notifications/n8n-dispatch.ts — add this variant
| {
    type: "assignment_reminder"
    cadence: "7d" | "1d" | "overdue"
    client_email: string
    client_name: string
    template_name: string
    due_date: string           // ISO date yyyy-mm-dd
    assignment_url: string     // absolute URL to /client/assignments/[id]
    instructions: string | null
  }
```

n8n routes by `type` discriminator (matches Phase 5 precedent). No new env vars needed; `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` are already wired.

### Q3 — Recurrence rule storage shape

**Recommendation: nullable JSONB column on `form_assignments`** (option a). Reject child table (option b).

**Rationale (driven by the three real query patterns the CONTEXT lists):**

| Query pattern | With JSONB column | With child table |
|---|---|---|
| "List overdue" — `due_date < today AND status != 'completed' AND deleted_at IS NULL` | Same query whether or not row recurs — recurrence is irrelevant to overdue. | Same. |
| "List upcoming next 30d" | `WHERE due_date BETWEEN today AND today+30` — recurrence is irrelevant. | Same. |
| "Generate next occurrence when prior completes" | `SELECT id, recurrence_rule FROM form_assignments WHERE id = $completed_id` — one row, one JSONB read. Decision lives next to the row that triggered it. | Two-step: read assignment, then `SELECT * FROM assignment_schedules WHERE assignment_id = $id`. Extra join, extra RLS surface. |

A child table also introduces a second RLS-policy maintenance burden (which is the kind of surface area Phase 16's RLS test was added to police). The column wins on every dimension.

**Concrete shape** (suggested for migration 015):
```sql
ALTER TABLE form_assignments
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
COMMENT ON COLUMN form_assignments.recurrence_rule IS
  'Optional recurrence trigger. NULL = one-off assignment. When non-null, the cron generates a next occurrence on completion. Shape: { "frequency": "weekly"|"monthly"|"quarterly"|"annually" }. v1 supports a fixed vocab only; RFC 5545 RRULE is out of scope.';
```

**Generated occurrence semantics:**
- The new row's `due_date` is computed by adding the frequency to the *completed* assignment's `due_date` (NOT today). Matt set the cadence relative to the prior due date.
- The new row inherits `recurrence_rule` — the chain continues until Matt clears it.
- The new row's `template_version_id` is re-pinned to the **latest published** version of `template_id` at generation time (per the locked decision).
- The new row's `last_reminder_sent = NULL`, `status = 'pending'`, `deleted_at = NULL`.

### Q4 — Schema migrations

**Resolution:** Next migration number is **015**. Phase 16 ended at 014.

**Verified directory listing** [VERIFIED: `ls supabase/migrations/`]:
```
001_initial_schema.sql
002_phase7_draft_report.sql
003_form_template_customer_ownership.sql
004_form_templates_rls_fixes.sql
005_template_versions_polymorphic_created_by.sql
006_documents_file_size.sql
007_services_columns.sql
008_proposals_audit_columns.sql
009_clients_contact_columns.sql
010_form_builder_foundation_reseed.sql
011_specialty_smoke_test_template.sql
012_phase15_conditional_smoke_test.sql
013_phase16_assignments_instructions.sql
014_phase16_customer_submissions.sql
```

**Recommended filename:** `015_phase17_assignment_recurrence_reminders.sql` — both new columns in one migration (the cron handler depends on both atomically; splitting them creates a deployable state where the cron crashes for one tick).

### Q5 — Latest-published version lookup

**Resolution:** Confirmed. The pattern in `app/client/templates/[id]/fill/page.tsx:51-58` is the canonical lookup. The recurrence generator must use it byte-for-byte:

```ts
// VERIFIED: app/client/templates/[id]/fill/page.tsx:52-59
const { data: version } = await supabase
  .from("template_versions")
  .select("id, schema_json")
  .eq("template_id", id)
  .not("published_at", "is", null)
  .order("version_number", { ascending: false })
  .limit(1)
  .maybeSingle();
```

For Phase 17's purpose (we only need the `id` to wire into the new `template_version_id`), simplify to `.select("id")`. The exact filter chain — `.not("published_at", "is", null)` + `.order("version_number", { ascending: false })` + `.limit(1)` + `.maybeSingle()` — is also what `app/admin/assignments/actions.ts` uses for the initial assign action [VERIFIED: `16-RESEARCH.md` lines 800-805 reference].

**`.maybeSingle()` vs `.single()`:** Use `maybeSingle()`. If a template has no published version (edge case — shouldn't happen for a master, theoretically possible for an orphan fork), `single()` throws; `maybeSingle()` returns `null` and lets the cron log + skip instead of failing the whole batch.

### Q6 — Time-zone handling

**Recommendation: accept the UTC-midnight drift as a known ≤1-day error window for v1.** Do not server-side-compute UK local date.

**Rationale:**
- UK is BST (UTC+1) from late March to late October, GMT (UTC+0) the rest of the year.
- The cron is scheduled `0 7 * * *` UTC — that's 08:00 BST in summer, 07:00 GMT in winter. Either way the cron runs well into Matt's morning.
- The "overdue today" check uses `due_date < CURRENT_DATE` in Postgres. Postgres `CURRENT_DATE` is **server-timezone-dependent**, which on Supabase defaults to UTC. So a UK assignment due on `2026-06-15` is marked overdue from `2026-06-16T00:00:00Z` = `2026-06-16T01:00:00 BST`. A 1-hour drift. Worst case (winter, midnight border): a UK user who completes a form at `00:30 GMT` on the due date may see it flagged overdue if the cron ran 30 minutes earlier. Realistically a non-issue — Matt is not assigning forms with end-of-day deadlines.
- All existing date formatting in the app **already uses `en-GB` locale** [VERIFIED: `app/client/assignments/_components/assignment-card.tsx:32`, `app/admin/assignments/page.tsx:48`, `app/client/assignments/[id]/page.tsx:14`]. The overdue *display* is already UK-localised; only the *boundary computation* drifts.

**If we ever need true UK-locale logic** (defer to Phase 18+):
```sql
-- Future: switch to UK local date for the overdue boundary
WHERE due_date < (NOW() AT TIME ZONE 'Europe/London')::date
```
Document this as a deferred refinement in the migration comment.

**Existing precedent:** `app/api/cron/expiry/route.ts:28-37` builds JS `Date` objects via `new Date()` (UTC at the server) and `.toISOString().split('T')[0]` to produce yyyy-mm-dd. Phase 17 should mirror this exactly — don't introduce a divergent date model.

### Q7 — Frequency vocabulary

**Recommendation: keep the locked vocab `weekly | monthly | quarterly | annually`.** This matches realistic FRA / Site Risk reminder cadences for UK fire-safety compliance:

| Frequency | Typical use |
|---|---|
| `annually` | Fire Risk Assessment review (BS 9999, Regulatory Reform (Fire Safety) Order 2005 — "suitable and sufficient" review minimum yearly) |
| `quarterly` | Site Risk inspection on higher-risk premises |
| `monthly` | Fire-door / emergency-light functional checks (BS 5266, BS EN 16763) |
| `weekly` | Fire-alarm point test (BS 5839 routine attendance) |

The Yellow Broom (Phase 4) seed catalogue has not been shipped to the repo yet — there is no `tests/` or seed file to cross-reference [VERIFIED: `grep -i 'weekly\|monthly\|quarterly\|annually' tests/` returns nothing relevant; `lib/data/services-seed.ts` is hours/services, not form cadence]. [ASSUMED] confirmation of the BS-standards mapping above — Matt or Finley should sign off in UAT.

**Defer:** "fortnightly" (2-weekly), "biennially" (every 2 years), arbitrary day-counts. Add only if Matt asks; not a v1 blocker.

### Q8 — Dedup column shape

**Recommendation: `last_reminder_sent TEXT NULL` (single column, locked in CONTEXT).** Do not switch to JSONB.

**Rationale:**

The reminder cadence is **monotonic** within an assignment lifecycle:
```
NULL  →  '7d'  →  '1d'  →  'overdue'  (terminal until status changes)
```

A reminder at 7d is only relevant once; once we move past the 7-day window, the 7d cadence is permanently irrelevant for that assignment. Same for 1d. Same for overdue (once overdue, stays overdue until status flips to completed).

**JSONB `{ sevenDay: ts, oneDay: ts, overdue: ts }` adds nothing useful:**
- "Was 7d sent?" — `last_reminder_sent IN ('7d', '1d', 'overdue')` is equivalent (everything past 7d implies 7d was sent or skipped).
- Network-blip partial-success: the cron already handles this by **not writing `last_reminder_sent` on dispatch failure** (Pattern from `app/api/cron/expiry/route.ts:120-122`). The next tick re-attempts the cadence. No timestamp needed.
- Postgres TEXT comparison is faster than JSONB extraction; the cron does this comparison for every active row.

**The only edge case JSONB would solve:** if Matt re-opens a completed assignment back to `pending` (which D-03 explicitly forbids: "Once status = 'completed' the row becomes immutable"). Not a real scenario.

**Locked migration shape:**
```sql
ALTER TABLE form_assignments
  ADD COLUMN IF NOT EXISTS last_reminder_sent TEXT;
COMMENT ON COLUMN form_assignments.last_reminder_sent IS
  'Latest reminder cadence dispatched for this assignment. NULL = none yet. Lifecycle: NULL → 7d → 1d → overdue. Terminal at overdue until status changes. Updated AFTER the n8n dispatch succeeds (failure leaves the column unchanged so the next cron tick retries).';
```

---

## Patterns to Follow

### Pattern 1: Cron route handler — copy `expiry/route.ts` shape

Mirror `app/api/cron/expiry/route.ts` byte-for-byte for the boilerplate. Specifically:

- Auth header check happens **first**, returns 401 before any DB work.
- Use the bare `@supabase/supabase-js` `createClient(URL, SERVICE_ROLE_KEY)` — NOT `lib/supabase/server.ts` (no auth context inside a cron). [VERIFIED: `app/api/cron/expiry/route.ts:22-25`]
- Wrap each item in a per-row try-flow; on dispatch failure, write `workflow_errors` and `continue` (next item). Never throw and abort the batch.
- Return JSON summary `{ success, processed, notificationsSent }` so the Vercel cron logs are auditable.

### Pattern 2: Recurrence generation — pure function, called from a single site

Make the recurrence generator a **pure async function** (not a server action) so it can be unit-tested without faking Next.js request context:

```ts
// lib/scheduler/generate-next-occurrence.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateNextOccurrence(
  supabase: SupabaseClient,
  completedAssignment: { id: string; client_id: string; template_id: string;
                        assigned_by: string | null; instructions: string | null;
                        due_date: string | null; recurrence_rule: unknown }
): Promise<{ ok: true; newAssignmentId: string } | { ok: false; reason: string }> {
  // ... see Code Example 2 below
}
```

Called from exactly **two** sites — the cron's completed-pass, AND the existing submit action (`app/client/assignments/actions.ts:submitAssignedFillByIdAction:181`) after `transitionAssignmentStatus(..., "completed")`. Wiring the trigger into the submit path makes recurrence feel instant for the user; the cron pass is a safety net for assignments completed before this code shipped or where the inline call failed.

### Pattern 3: Overdue derivation — server-side, never a DB column

Overdue is computed in three places:
1. **The cron** — to decide whether to fire the `overdue` reminder cadence.
2. **`/client/assignments` AssignmentCard** — already implemented at `app/client/assignments/_components/assignment-card.tsx:39-42`. The `isOverdue()` helper there is the canonical pattern; reuse it.
3. **`/admin/clients/[id]` Assigned Forms tab** — needs a matching badge.

The `isOverdue` helper [VERIFIED: `app/client/assignments/_components/assignment-card.tsx:39-42`]:
```ts
function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}
```

**Don't add a new helper file** — this is 3 lines, copy it inline if not already present in the target file. **Don't `LATERAL JOIN` an `is_overdue` column** in the queries; the existing query shape (RSC + JS filter) is fine at the project's 7-8-client scale.

### Pattern 4: Mirror Phase 5's idempotency strategy

The expiry cron's dedup is `notifications_sent UNIQUE(document_id, alert_window, notification_type)`. Phase 17's dedup is `form_assignments.last_reminder_sent` (a single TEXT column on the assignment itself). **Critical idempotency rule:**

> Update `last_reminder_sent` AFTER the n8n call returns `ok: true`. If the dispatch fails, leave the column unchanged; the next cron tick retries.

This matches [VERIFIED: `app/api/cron/expiry/route.ts:113-122`] exactly.

### Pattern 5: Wire reminder URLs absolutely, not relatively

The n8n payload's `assignment_url` must be **absolute** (`https://…/client/assignments/[id]`) because the email recipient clicks it from Proton Mail, not from inside the app. Read the base URL from `process.env.NEXT_PUBLIC_SITE_URL` or `process.env.VERCEL_URL` with a fallback. **Don't synthesise from request headers** — the cron's request comes from Vercel internally and `request.url` is the cron path, not the public origin.

---

## Pitfalls to Avoid

### P1 — Hallucinating an n8n integration helper that doesn't exist

There is exactly **one** n8n entry point in the codebase: `lib/notifications/n8n-dispatch.ts` exporting `dispatchNotification(payload)` and the `NotificationPayload` union. There is no `lib/notifications/n8n-client.ts`, no `lib/n8n/`, no `lib/integrations/n8n.ts`. [VERIFIED: `grep dispatchNotification|N8N_WEBHOOK` returns 4 files; only `lib/notifications/n8n-dispatch.ts` is the helper. The other 3 are consumers.]

**Code-level guard:** Plan tasks must explicitly say "extend the union in `lib/notifications/n8n-dispatch.ts`" — never "create a new n8n helper". Verify the file exists before authoring the plan.

### P2 — Hallucinating Vercel cron handler conventions

There is **no** special export name like `cron`, `scheduled`, or `handler` for Vercel cron in Next.js App Router. It is a plain `export async function GET(request: Request)` in `app/api/.../route.ts`. The cron-ness is purely declared in `vercel.json`. [CITED: Vercel cron quickstart, last updated 2026-03-20]

**Code-level guard:** Plan tasks must reference `app/api/cron/expiry/route.ts:5` as the template. Anyone proposing `export const config = { schedule: ... }` or similar Vercel-Edge-Functions-style declarative syntax is wrong — that's not how Vercel Cron works.

### P3 — `redirect()` in the cron (don't)

Vercel Cron jobs **do not follow redirects** [CITED: Vercel manage-cron-jobs]. A `redirect()` call in a cron handler aborts the invocation silently. Cron handlers must `return new Response(...)` or `NextResponse.json(...)` only.

**Code-level guard:** No `redirect` import in the cron file. The existing `app/api/cron/expiry/route.ts` doesn't import `redirect` — neither should the new one.

### P4 — Mistaking the dedup column for a counter

`last_reminder_sent` is a **state machine pointer**, not a count. A common mistake: "increment last_reminder_sent" or "set it to '7d_sent' or 'all_sent'". Wrong. The values are the cadence names (`'7d'`, `'1d'`, `'overdue'`) and they form a monotone progression.

**Code-level guard:** Add a CHECK constraint OR a Vitest unit test that asserts the column only ever holds one of those four values (`'7d' | '1d' | 'overdue' | NULL`).

### P5 — Reading `form_assignments` rows the cron shouldn't touch

The cron must filter:
```ts
.is("deleted_at", null)           // never remind on revoked
.neq("status", "completed")       // never remind on completed
.not("due_date", "is", null)      // can't compute reminders for due-date-less assignments
```

Missing any one of these wastes function time and (worse) double-sends. The expiry cron has `eq("active", true)` for the same reason [VERIFIED: `app/api/cron/expiry/route.ts:51`]. Phase 17's equivalent guard is the three-filter chain above.

**Code-level guard:** First task in the cron plan should be the SELECT query; the verification step asserts all three filters are present.

---

## Code Examples

### Example 1 — `vercel.json` (extend, don't replace)

```json
{
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/expiry", "schedule": "0 6 * * *" },
    { "path": "/api/cron/assignment-scheduler", "schedule": "0 7 * * *" }
  ]
}
```

### Example 2 — Recurrence generator (`lib/scheduler/generate-next-occurrence.ts`)

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

type Frequency = "weekly" | "monthly" | "quarterly" | "annually";

interface RecurrenceRule { frequency: Frequency }

function addFrequency(date: Date, freq: Frequency): Date {
  const d = new Date(date);
  switch (freq) {
    case "weekly":    d.setDate(d.getDate() + 7); break;
    case "monthly":   d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "annually":  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export async function generateNextOccurrence(
  supabase: SupabaseClient,
  src: { id: string; client_id: string; template_id: string;
         assigned_by: string | null; instructions: string | null;
         due_date: string | null; recurrence_rule: unknown }
): Promise<{ ok: true; newAssignmentId: string } | { ok: false; reason: string }> {
  const rule = src.recurrence_rule as RecurrenceRule | null;
  if (!rule?.frequency) return { ok: false, reason: "no_recurrence_rule" };
  if (!src.due_date)    return { ok: false, reason: "no_due_date" };

  // Re-pin to LATEST PUBLISHED version (matches app/client/templates/[id]/fill/page.tsx:52-59)
  const { data: latest } = await supabase
    .from("template_versions")
    .select("id")
    .eq("template_id", src.template_id)
    .not("published_at", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return { ok: false, reason: "no_published_version" };

  const newDue = addFrequency(new Date(src.due_date), rule.frequency)
    .toISOString().slice(0, 10);

  const { data: created, error } = await supabase
    .from("form_assignments")
    .insert({
      client_id: src.client_id,                  // server-side carryover (T-16-04)
      template_id: src.template_id,
      template_version_id: latest.id,
      assigned_by: src.assigned_by,
      due_date: newDue,
      instructions: src.instructions,
      status: "pending",
      recurrence_rule: rule,                     // chain continues
      last_reminder_sent: null,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, reason: error?.message ?? "insert_failed" };
  return { ok: true, newAssignmentId: created.id };
}
```

### Example 3 — Reminder sender (`lib/scheduler/send-reminder.ts`)

```ts
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch";

export async function sendAssignmentReminder(args: {
  cadence: "7d" | "1d" | "overdue";
  client_email: string;
  client_name: string;
  template_name: string;
  due_date: string;
  assignmentId: string;
  instructions: string | null;
}) {
  const base = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return dispatchNotification({
    type: "assignment_reminder",
    cadence: args.cadence,
    client_email: args.client_email,
    client_name: args.client_name,
    template_name: args.template_name,
    due_date: args.due_date,
    assignment_url: `${base}/client/assignments/${args.assignmentId}`,
    instructions: args.instructions,
  });
}
```

### Example 4 — Cron handler (`app/api/cron/assignment-scheduler/route.ts`)

```ts
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { generateNextOccurrence } from "@/lib/scheduler/generate-next-occurrence";
import { sendAssignmentReminder } from "@/lib/scheduler/send-reminder";

export async function GET(request: Request) {
  // Mirror app/api/cron/expiry/route.ts auth pattern
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }
    // dev/preview: allow unauthenticated curl
  } else if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // PASS A — Reminders (active assignments only)
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const day7 = new Date(today); day7.setUTCDate(day7.getUTCDate() + 7);
  const day1 = new Date(today); day1.setUTCDate(day1.getUTCDate() + 1);

  const { data: active } = await supabase
    .from("form_assignments")
    .select(`id, client_id, due_date, status, instructions, last_reminder_sent,
             template:form_templates(name),
             client:clients(id)`)
    .is("deleted_at", null)
    .neq("status", "completed")
    .not("due_date", "is", null);

  let remindersSent = 0;
  for (const a of active ?? []) {
    let cadence: "7d" | "1d" | "overdue" | null = null;
    if (a.due_date === iso(day7)  && a.last_reminder_sent === null)      cadence = "7d";
    else if (a.due_date === iso(day1) && a.last_reminder_sent !== "1d" && a.last_reminder_sent !== "overdue") cadence = "1d";
    else if (a.due_date < iso(today) && a.last_reminder_sent !== "overdue") cadence = "overdue";
    if (!cadence) continue;

    // Fetch client contact (mirror app/api/cron/expiry/route.ts:87-100)
    const { data: contacts } = await supabase
      .from("client_users").select("name, email")
      .eq("client_id", a.client_id).limit(1);
    const contact = contacts?.[0];
    if (!contact?.email) continue;

    const tpl = Array.isArray(a.template) ? a.template[0] : a.template;
    const result = await sendAssignmentReminder({
      cadence,
      client_email: contact.email,
      client_name: contact.name ?? "there",
      template_name: tpl?.name ?? "Untitled form",
      due_date: a.due_date as string,
      assignmentId: a.id,
      instructions: a.instructions,
    });

    if (!result.ok) {
      await supabase.from("workflow_errors").insert({
        workflow_name: "assignment_reminder",
        error_message: result.error ?? "unknown",
        payload: { assignment_id: a.id, cadence },
      });
      continue; // do NOT update last_reminder_sent — retry next tick
    }

    await supabase.from("form_assignments")
      .update({ last_reminder_sent: cadence })
      .eq("id", a.id);
    remindersSent++;
  }

  // PASS B — Recurrence (completed, with recurrence_rule, no successor yet)
  // Successor detection: simple is fine — a completed row whose recurrence_rule is non-null
  // is processed once per cron tick; the inline trigger in submitAssignedFillByIdAction
  // is the primary path, this is the safety net. Idempotency: track via a child of the
  // completed row, OR add a column `recurrence_generated_at TIMESTAMPTZ` (lighter).
  const { data: completedRecurring } = await supabase
    .from("form_assignments")
    .select("id, client_id, template_id, assigned_by, instructions, due_date, recurrence_rule, recurrence_generated_at")
    .eq("status", "completed")
    .is("deleted_at", null)
    .not("recurrence_rule", "is", null)
    .is("recurrence_generated_at", null);

  let recurrencesGenerated = 0;
  for (const c of completedRecurring ?? []) {
    const res = await generateNextOccurrence(supabase, c);
    if (res.ok) {
      await supabase.from("form_assignments")
        .update({ recurrence_generated_at: new Date().toISOString() })
        .eq("id", c.id);
      recurrencesGenerated++;
    }
  }

  return NextResponse.json({ remindersSent, recurrencesGenerated });
}
```

### Example 5 — Migration 015

```sql
-- supabase/migrations/015_phase17_assignment_recurrence_reminders.sql
-- Phase 17: recurrence rule + reminder dedup columns on form_assignments.

ALTER TABLE public.form_assignments
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB,
  ADD COLUMN IF NOT EXISTS last_reminder_sent TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_generated_at TIMESTAMPTZ;

-- Optional safety: enforce the cadence vocab at the DB.
ALTER TABLE public.form_assignments
  ADD CONSTRAINT form_assignments_last_reminder_sent_check
  CHECK (last_reminder_sent IS NULL
         OR last_reminder_sent IN ('7d', '1d', 'overdue'));

COMMENT ON COLUMN public.form_assignments.recurrence_rule IS
  'Optional recurrence trigger. NULL = one-off. Shape: { "frequency": "weekly"|"monthly"|"quarterly"|"annually" }. Phase 17.';
COMMENT ON COLUMN public.form_assignments.last_reminder_sent IS
  'Latest reminder cadence dispatched. NULL → 7d → 1d → overdue. Updated AFTER successful n8n dispatch only. Phase 17.';
COMMENT ON COLUMN public.form_assignments.recurrence_generated_at IS
  'Timestamp when a successor row was generated for this completed assignment. NULL = not yet generated. Idempotency guard for the cron PASS B. Phase 17.';
```

> Note on the `recurrence_generated_at` column — not in the CONTEXT's explicit list but required for cron idempotency. The CONTEXT's Threat-model anchor row ("re-running the cron after a transient failure must re-send" — for reminders) is the inverse for recurrence: re-running must NOT re-generate. This column is the cheapest way to enforce that.

### Example 6 — Overdue badge for admin tab (`app/admin/clients/[id]/client-tabs.tsx`)

```tsx
// Inside the existing Assigned Forms tab render — adjacent to StatusPill
function OverdueBadge({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (!dueDate || status === "completed") return null;
  const overdue = new Date(dueDate) < new Date(new Date().toDateString());
  if (!overdue) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm
                     font-mono text-[9px] uppercase tracking-[0.25em] leading-none
                     text-[#e55a3a] bg-[#e55a3a]/10">
      Overdue
    </span>
  );
}
```

Use the **same `#e55a3a` red** that `app/client/assignments/_components/assignment-card.tsx:83` already uses — keep the colour palette consistent.

---

## Library / Tooling Notes

### Vercel Cron
- **Authentication:** `Authorization: Bearer ${CRON_SECRET}` header sent automatically. [CITED: Vercel manage-cron-jobs]
- **Schedule field:** standard 5-part cron expression, UTC, no `MON`/`JAN`-style aliases, no day-of-month + day-of-week together.
- **Local execution:** there is no `vercel dev`-native cron trigger. Hit the route manually with `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/assignment-scheduler` for local testing.
- **Hobby vs Pro:** Hobby = once/day, hour-level accuracy. Pro = minute-level. The project is on Pro (existing 6 AM cron). [CITED: Vercel cron-jobs accuracy section]
- **No retry on failure.** Cron handlers must be idempotent — Vercel itself warns about possible duplicate delivery.

### n8n (via `lib/notifications/n8n-dispatch.ts`)
- Single endpoint + secret. Discriminated union for payload routing.
- Failure surfaces via `workflow_errors` table.
- Phase 17 adds the `assignment_reminder` variant; the n8n side must add a routing branch for it (out-of-repo task — Matt/Finley own the n8n workflow JSON).

### Supabase Migrations
- Next migration number is **015**.
- Project does not auto-push migrations — push runs via a separate Plan/wave (Plan 05-2 and 16-08 used this pattern).
- DO NOT use TRIGGERs (project convention, zero existing triggers — confirmed by Phase 16 research).
- Postgres CHECK constraints cannot do cross-table subqueries — column-local CHECK is fine (we use one for the `last_reminder_sent` vocab).

### Vitest 3.x
- Already configured. The `tests/rls/` directory was added by Phase 16 — Phase 17 may add `tests/scheduler/` (mirror the pattern).
- For cron unit tests: factor `generateNextOccurrence` and the per-row reminder decision as pure functions so they can be tested without an HTTP harness.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The four-frequency vocab (`weekly` / `monthly` / `quarterly` / `annually`) is sufficient for Matt's FRA / Site Risk reminder cadences. The Yellow Broom seed catalogue isn't in the repo yet for cross-reference. | Q7 | LOW — schema is JSONB, so adding `"fortnightly"` later is a one-line change to the `Frequency` union; no migration required. |
| A2 | UTC-midnight drift for the overdue boundary (1 hour in BST, 0 in GMT) is acceptable. | Q6 | LOW — Matt is not using end-of-day deadlines. If complaints surface, swap to `(NOW() AT TIME ZONE 'Europe/London')::date`. |
| A3 | n8n's existing webhook can be extended with a new `type: "assignment_reminder"` branch without redesign. | Q2 | LOW — n8n's `X-Webhook-Secret` + JSON body is what the existing `expiry_alert` / `document_uploaded` types already use; routing by type is the established pattern. Confirm with Matt that he can wire the n8n branch. |
| A4 | The `recurrence_generated_at` column (added beyond CONTEXT's explicit list) is the right way to guarantee the cron doesn't double-generate when both the inline submit trigger and PASS B see the same completed row. | Q3 / Example 5 | LOW — alternative is a child table mapping `assignment_id → successor_id`, which is heavier. The column is reversible. |
| A5 | Vercel cron auth uses ONLY the `Authorization: Bearer` header — no signed JWT, no HMAC of body. | Q1 | LOW — the existing `app/api/cron/expiry/route.ts` works under this contract, and Vercel docs confirm. |

---

## BLOCKING Issues for the Planner

**None.** Every open question has a defensible recommendation grounded in either repo code or official Vercel docs. The single `[ASSUMED]` item (A1, frequency vocab) is a Matt-confirm-in-UAT, not a planning blocker — the schema is forward-compatible.

---

## Sources

### Primary (HIGH confidence)
- `app/api/cron/expiry/route.ts` — full cron handler precedent (auth + service-role + per-row dispatch + workflow_errors + idempotency)
- `lib/notifications/n8n-dispatch.ts` — exact n8n payload + dispatch contract
- `supabase/migrations/001_initial_schema.sql` lines 72-98, 177-196, 281-289 — form_assignments + notifications_sent + workflow_errors schema + RLS
- `supabase/migrations/013_phase16_assignments_instructions.sql` and `014_phase16_customer_submissions.sql` — migration shape precedent
- `app/client/templates/[id]/fill/page.tsx:51-59` — latest-published-version lookup pattern (canonical)
- `app/client/assignments/_components/assignment-card.tsx:39-42` — `isOverdue` helper (canonical)
- `app/client/assignments/actions.ts` — Phase 16's transitionAssignmentStatus + redirect-outside-try/catch patterns
- `app/admin/assignments/page.tsx:35-44` — admin overdue colour-code precedent (`#e55a3a`)
- `vercel.json` — current cron declaration shape
- `.planning/phases/16-multi-tenancy-fork-on-fill/16-RESEARCH.md` — multi-tenancy invariants, patterns, anti-patterns
- Vercel Cron docs: [Cron Jobs overview](https://vercel.com/docs/cron-jobs), [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Quickstart](https://vercel.com/docs/cron-jobs/quickstart) (last updated 2026-04-21 / 2026-03-20)

### Secondary (MEDIUM confidence)
- `.planning/phases/05-document-upload-expiry-alerts/05-CONTEXT.md` — Phase 5 decisions D-04/D-05 (n8n + expiry cron originals)
- `.planning/phases/17-assignment-scheduling-notifications/17-CONTEXT.md` — the locked decisions this research builds on

### Tertiary (LOW confidence)
- BS-standards mapping for FRA / fire-alarm / fire-door cadences (Q7) — general knowledge; Matt to confirm in UAT.

## Metadata

**Confidence breakdown:**
- Vercel cron contract: HIGH — verified against current Vercel docs + working `/api/cron/expiry` route
- n8n payload contract: HIGH — exact shape verified in `lib/notifications/n8n-dispatch.ts`
- Recurrence storage: HIGH — query-pattern analysis is exhaustive
- Dedup column: HIGH — monotonic state machine + Phase 5 precedent
- Time-zone: MEDIUM — recommendation is "accept drift," depends on Matt being OK with ≤1h boundary error
- Frequency vocab: MEDIUM — domain assumption (BS standards) not verified against a primary source

**Research date:** 2026-05-27
**Valid until:** 2026-06-26 (30 days)
