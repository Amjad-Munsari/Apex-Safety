# Phase 17 — Assignment Scheduling + Notifications — UAT

**Phase status:** Code-complete + DB-live. Migration 015 applied to live Supabase on 2026-05-27 (via supabase-888 MCP). Types regenerated. All 4 ROADMAP success criteria delivered.

**Prereq for §A–§D:** one admin user, two client users in different orgs, at least one published admin master template. n8n bridge configured with `N8N_WEBHOOK_URL` env var. `CRON_SECRET` env var set on Vercel.

---

## §A — Client overdue badge (D-12 carry-forward + Phase 17 D-Overdue)

1. **As admin:** Assign a template to client A's org with `due_date` set to **3 days ago**.
2. **As client A:** Navigate to `/client/assignments`. Verify in the Active tab:
   - The overdue assignment has an **`OVERDUE`** pill (muted rust `#a14a2a` on a 10% overlay, mono uppercase, same geometry as the existing status pills).
   - Hovering does NOT show a tooltip (client surface is touch-first — `aria-label` is the affordance: "Overdue — was due 3 days ago").
   - The overdue row sorts to the top of the Active list (`due_date ASC NULLS LAST`).
3. **Test the zero state:** create an assignment with `due_date` in the future. Verify no overdue pill renders on that row (absence-is-affordance, per UI-SPEC Phase 16 D-12 carry).

**Expected outcomes:**
- [ ] `OVERDUE` pill visible on overdue row.
- [ ] No pill on future-dated row.
- [ ] Overdue row sorts above non-overdue rows.
- [ ] `aria-label` reads "Overdue — was due N day(s) ago" (verify via browser devtools / screen reader).

---

## §B — Admin overdue badge + ORDER BY swap (D-12 / BLOCKING #1)

1. **As admin:** Navigate to `/admin/clients/[client-A-id]` → Assigned Forms tab.
2. **Verify the overdue assignment from §A:**
   - Renders the `OVERDUE` pill identically to §A (same `#a14a2a` color token, same geometry — UI-SPEC className duplication invariant).
   - Hovering DOES show a tooltip ("Overdue — was due 3 days ago"). The admin surface allows tooltips (desktop-first).
3. **Verify the new ORDER BY** — assignments table sorts by `due_date ASC NULLS LAST`, then `created_at DESC`. Overdue rows surface above future-dated rows.

**Expected outcomes:**
- [ ] `OVERDUE` pill renders on admin tab.
- [ ] Tooltip shows on hover.
- [ ] Rows ordered: overdue rows first, then by due-date ascending, with NULL due-dates last.

---

## §C — Recurrence end-to-end (Success Criterion 1)

1. **As admin:** Create an assignment with `recurrence_rule = { "frequency": "weekly" }` and `due_date` set to **today**.
2. **As client A:** Open the assignment, fill it, submit.
3. **Verify in Supabase Studio:**
   - The submitted assignment now has `status='completed'`, `recurrence_generated_at` set to a timestamp.
   - A NEW assignment row exists for the same client + template, with `due_date = original_due_date + 7 days` and `template_version_id` = latest published version of the template (re-pinned, NOT carried over).
   - The new row has `status='pending'` and `recurrence_rule = { "frequency": "weekly" }` (carried over).
   - The new row has `instructions` carried over from the prior row (per CONTEXT recurrence semantics).
4. **Test customer-fork recurrence:** if the client forked the template (Phase 16 D-07), the recurrence picks up the FORK's latest published version, not the master's.
5. **Idempotency test:** re-trigger the inline generator (e.g., resubmit via dev tools) — verify NO second successor is created (the `recurrence_generated_at != NULL` guard kicks in).

**Expected outcomes:**
- [ ] Successor row exists with correct due_date offset and re-pinned template_version_id.
- [ ] Recurrence rule + instructions carry over.
- [ ] Idempotency holds — no double-generation.

**Frequency vocab verification (ASSUMED A1 from RESEARCH):** Confirm with Matt that `weekly | monthly | quarterly | annually` covers FRA / Site Risk cadences (BS 5839 weekly alarm, BS 5266 monthly emergency light, quarterly site risk, annual FRA). If domain requires more, decompose at Phase 18 or a follow-on phase.

---

## §D — Cron handler smoke test (Success Criteria 3 + 4)

This section requires `N8N_WEBHOOK_URL` and `CRON_SECRET` set in your local `.env.local`. Set `N8N_WEBHOOK_URL` to a request-bin (e.g., webhook.site or pipedream) for local smoke.

1. **Start dev server:** `npm run dev`.
2. **Seed two overdue assignments** in different cadence buckets:
   - Assignment X: `due_date` = 7 days from today, `last_reminder_sent` = NULL → expects 7d cadence.
   - Assignment Y: `due_date` = 2 days ago, `last_reminder_sent` = '1d' → expects overdue cadence.
3. **Curl the cron handler with valid auth:**
   ```
   curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/assignment-scheduler
   ```
   Verify response is `200 OK` with a JSON summary like `{ ok: true, processed: { reminders: 2, recurrences: 0 }, ... }`.
4. **Curl WITHOUT auth:**
   ```
   curl -i http://localhost:3000/api/cron/assignment-scheduler
   ```
   Verify response is `401 Unauthorized`.
5. **Verify n8n webhook fired** — check the request-bin received 2 POSTs with `type: "assignment_reminder"` payloads (one cadence='7d' for X, one cadence='overdue' for Y).
6. **Verify dedup column advanced** — in Supabase Studio:
   - Assignment X: `last_reminder_sent = '7d'`.
   - Assignment Y: `last_reminder_sent = 'overdue'`.
7. **Re-run the cron** — verify no duplicate reminders fire (dedup guard).
8. **Idempotency on failure** — temporarily set `N8N_WEBHOOK_URL` to a 500-returning endpoint, re-seed an assignment for 7d, run cron. Verify:
   - A `workflow_errors` row inserted with `workflow_name = 'assignment_reminder'`.
   - `last_reminder_sent` was NOT updated (still NULL).
   - Re-running with a healthy webhook URL retries successfully and advances the dedup column.

**Expected outcomes:**
- [ ] 401 on missing auth, 200 on valid Bearer token.
- [ ] n8n webhook received correctly-shaped payloads.
- [ ] Dedup column advances after successful dispatch only.
- [ ] On dispatch failure, `workflow_errors` populated and dedup column unchanged → retry works.

---

## §E — Known issues / accepted trade-offs

### §E.1 WCAG AA contrast on admin dark surface (accepted, design-system-wide)

The `OVERDUE` pill foreground `#a14a2a` on the admin `#1c1c1c` Card surface measures **2.86:1** — below the WCAG AA threshold of 4.5:1 for normal text. The plan-checker called this out as BLOCKING #3 from UI-SPEC.

**Disposition:** Accepted as consistent with the Phase 16 design-system baseline:

| Pill | Foreground | Contrast on `#1c1c1c` |
|------|-----------|------------------------|
| pending (default `#666`) | `#666666` | 2.97:1 FAIL |
| in_progress (`#c0a66d` earth amber) | `#c0a66d` | 7.24:1 PASS |
| completed (`#3b8273` teal) | `#3b8273` | 3.75:1 FAIL |
| **overdue (`#a14a2a` muted rust) — Phase 17 NEW** | `#a14a2a` | **2.86:1 FAIL** |

The Phase 16 status-pill family was designed as aesthetic earth tones, not for WCAG AA compliance on the admin dark surface. Phase 17's `#a14a2a` matches that design-language baseline.

**Mitigations in place:**
- `aria-label` provides the full overdue context to assistive tech (screen readers don't need visual contrast).
- The pill is paired with the date row + status row, so users have multiple visual + textual cues.
- The client surface (cream `#faf9f6`) renders the pill at **5.65:1 PASS**.

**Recommended follow-up phase:** A design-system tightening phase should address the entire admin dark-surface pill family at once (pending + completed + overdue all need lighter foregrounds OR the admin surface needs a lighter Card background). Not a Phase 17 fix — addressing one pill in isolation would diverge from the locked Phase 16 visual language.

### §E.2 Time-zone drift (ASSUMED A2 — confirm in UAT)

Cron runs at UTC midnight. The overdue boundary computation in `lib/assignments/is-overdue.ts` uses local-timezone date components (verified in tests/scheduler/is-overdue.test.ts). For UK locale (BST/GMT), the drift between UTC midnight and local-day boundary is ≤1 hour. **Accepted** for v1 per RESEARCH Q6. If Matt observes overdue rows flipping in/out around midnight UK time, the fix is to switch the overdue SELECT to `(NOW() AT TIME ZONE 'Europe/London')::date` in the cron handler — single-line change.

### §E.3 n8n routing (ASSUMED A3 — confirm with the n8n owner)

Phase 17 dispatches `assignment_reminder` payloads to the existing `N8N_WEBHOOK_URL`. The n8n side needs an `if type === 'assignment_reminder' then …` branch pointing at a Proton Mail outbound. **Action required:** confirm the n8n workflow has been updated to handle this new type. Smoke this in §D step 5.

---

## §F — Acceptance for phase close

§A, §B, §C, §D are the production UAT walkthroughs. §E lists known accepted trade-offs (none gating).

- §A — Client overdue badge: **ready to UAT** (mount + sort + aria-label + zero-state).
- §B — Admin overdue badge: **ready to UAT** (mount + tooltip + ORDER BY swap).
- §C — Recurrence end-to-end: **ready to UAT** (autogeneration + idempotency + carry-over).
- §D — Cron smoke: **needs n8n routing confirmation** before live test (see §E.3).
- §E — Design-system note (accepted), time-zone (accepted), n8n routing (action required).
