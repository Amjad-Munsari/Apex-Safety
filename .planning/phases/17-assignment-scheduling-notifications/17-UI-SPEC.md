---
phase: 17
slug: assignment-scheduling-notifications
status: draft
shadcn_initialized: true
preset: base-mira / baseColor:mist (inherited from Phase 16)
created: 2026-05-27
scope: delta-only (overdue badge on two Phase 16 surfaces)
---

# Phase 17 — UI Design Contract
## Assignment Scheduling + Notifications

> Delta spec. The entirety of Phase 17's user-facing UI is **one new badge** rendered on two
> already-shipped surfaces. No new routes, no new layouts, no new design tokens. All visual
> language inherits from `16-UI-SPEC.md`.

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| Overdue badge on `/admin/clients/[id]` Assigned Forms tab rows | New routes or pages |
| Overdue badge on `/client/assignments` Active tab cards | Admin queue table (`/admin/assignments`) — already has overdue colouring on the due-date column via Plan 16-03, no additional change |
| Sort behaviour confirmation (overdue first) | Reminder UI / notification preferences UI (no surface) |
| Accessible label pattern | SMS/email surfaces (n8n → Proton, no in-app render) |

The badge is a **derived visual state**. The DB has no `overdue` column. The condition is:

```
due_date < CURRENT_DATE
  AND status != 'completed'
  AND deleted_at IS NULL
```

---

## Design System

Inherited verbatim from `16-UI-SPEC.md`. No new tokens, components, or fonts introduced.

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn (base-mira, baseColor:mist, Tailwind v4) | Phase 16 |
| Surface theming | admin = dark `data-surface="admin"`, client = cream `data-surface="client"` | Phase 16 |
| Font (mono) | JetBrains Mono — used for all pill copy | Phase 16 |

No new shadcn components required. No registry installs. No third-party blocks.

---

## The Overdue Badge

### Locked copy

| Element | Copy | Notes |
|---------|------|-------|
| Pill label | `OVERDUE` | Uppercase mono — matches existing pill family (`PENDING`, `IN PROGRESS`, `COMPLETED`, `FORKED`). Single word; no count inside the pill. |
| Accessible label pattern (1+ day overdue) | `Overdue — was due {N} day{s} ago` | Sentence case for screen readers (`aria-label`). Pluralisation: `1 day` / `2 days`. |
| Accessible label pattern (0 days, same-day transition) | `Overdue — was due today` | Edge case: due_date === today, but cron has just transitioned. Use when `N === 0`. |
| Tooltip text (admin row, hover) | `Was due {N} day{s} ago` | Mirrors the existing admin overdue-date Tooltip pattern from Plan 16-03. Client cards: no tooltip required (mobile-first surface). |

**Rationale on copy:** The existing pill family uses single-word labels (`Pending`, `Completed`) and one two-word label (`In progress`). `OVERDUE` slots in cleanly. The day count moves into `aria-label` / tooltip rather than the pill text — keeps the pill scannable and matches the active-count pill's "no number in pill" convention seen in `active-pill.tsx` (which DOES show a count, but is dedicated to counting; the overdue pill is a status flag, not a counter).

### Locked colour token

| Token | Value | Reason |
|-------|-------|--------|
| Text | `#a14a2a` (rust) | Muted brick-rust in the editorial earth-tone family. Distinct from the existing `#e55a3a` destructive red (which Phase 16 reserves for the **due-date text** when overdue and for the "Revoke" destructive button). Using a separate, more muted token for the **pill** prevents red overload when the date text and the pill both appear on the same row. |
| Background | `#a14a2a/10` (10% opacity overlay) | Matches the bg-`/10` pattern used by every other pill in the family (`#c0a66d/10`, `#3b8273/10`, `#555/10`). |
| Border | none | Pill family has no borders — fill-only. |

**Verified against the existing palette:**

| Existing token | Used for | Conflicts? |
|----------------|----------|------------|
| `#666` / `#555/10` | Pending pill grey | No — different hue |
| `#c0a66d` / `#c0a66d/10` | In-progress amber, Forked tag, active-count pill | No — amber vs rust are visually distinct |
| `#3b8273` / `#3b8273/10` | Completed teal, route-index moniker | No — opposing temperature |
| `#e55a3a` | Destructive red: Revoke button, **overdue due-date text** | **Adjacent on the row.** The pill at `#a14a2a` reads as a lower-saturation cousin — they pair rather than clash. Keep `#e55a3a` on the date text (already shipped) and `#a14a2a` on the pill (new). |

### Visual spec — pill markup

Match the existing `StatusPill` from `app/client/assignments/_components/assignment-card.tsx:44-66`. Exact class string the executor must use:

```tsx
<span
  className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] text-[#a14a2a] bg-[#a14a2a]/10"
  aria-label={`Overdue — was due ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago`}
>
  OVERDUE
</span>
```

For the `daysOverdue === 0` edge case, the `aria-label` becomes `"Overdue — was due today"`.

**Geometry:** `px-2 py-0.5 rounded-sm` — identical to the status pill family. Mono `text-[9px] tracking-[0.25em]` — identical. No icon. No border.

---

## Mount Points

### Mount A — `/client/assignments` Active tab

**File:** `app/client/assignments/_components/assignment-card.tsx`

**Where in the card:** Row 2, the mono metadata row that already holds `DUE · {date}` + `<StatusPill>`. Insert the overdue pill **after** the existing `<StatusPill>` so the visual reading order is: date → current status → overdue flag.

**Gating condition:** `variant === "active"` AND `isOverdue(assignment.due_date)` AND `assignment.status !== "completed"`. The existing `isOverdue()` helper at lines 39-42 already returns the boolean we need — reuse it.

**Behavioural rules:**
- Render pill ONLY when overdue. When not overdue: render nothing (absence-is-the-affordance — same convention as `ActivePill` returning `null` for count=0).
- Completed tab (`variant === "completed"`): **never** render the overdue pill, even if `due_date < today`. A completed-but-was-late submission is not "overdue" — it's done.
- The existing mono `DUE · {date}` text already turns `text-[#e55a3a]` when overdue (lines 82-85). Keep that. The pill is additive, not a replacement.

**Result:** An overdue active assignment shows: red-tinted `DUE · 12 May 2026` + status pill (`PENDING` or `IN PROGRESS`) + `OVERDUE` pill, left-to-right.

### Mount B — `/admin/clients/[id]` Assigned Forms tab

**File:** `app/admin/clients/[id]/client-tabs.tsx` (in the existing `<TabsContent value="assignments">` per-row block — see Plan 16-03 Summary Task 2).

**Where in the row:** Insert the overdue pill in the metadata cluster, **after** the existing status pill, before the `<RevokeAssignmentButton>` action.

**Gating condition:** `row.status !== "completed"` AND `row.due_date && new Date(row.due_date) < new Date(new Date().toDateString())`. (Local helper, mirroring the client-side `isOverdue()`; do NOT duplicate the function — extract to `lib/assignments/is-overdue.ts` and import from both surfaces.)

**Surface adjustment:** None. The pill colour `#a14a2a` reads correctly on both the dark admin surface and the cream client surface — the `/10` bg overlay adapts to whichever surface paints behind it. The same pattern (`text-[#c0a66d] bg-[#c0a66d]/10`) is already used on both surfaces in Phase 16 without per-surface variants.

### Mount C — admin counter pill (NEW, optional, deferred-by-default)

The Plan 16-03 active-count pill (`app/admin/clients/_components/active-pill.tsx`) on the `/admin/clients` LIST page counts active assignments. Phase 17 does **not** introduce a parallel "overdue count" pill on that list. If product wants a per-row overdue dot on the clients list in a future phase, that's a separate spec. **Out of scope for Phase 17.**

---

## Sort Order

### `/client/assignments` Active tab

**Current query** (verified at `app/client/assignments/page.tsx:21-22`):

```ts
.order("due_date", { ascending: true, nullsFirst: false })
.order("created_at", { ascending: false })
```

This already surfaces overdue rows at the top of the Active list — oldest `due_date` (which, by definition, is the most overdue) comes first. **No query change required.** Confirm by walking through the data: an assignment due `2026-05-01` sorts before one due `2026-05-25`, and both sort before one due `2026-06-15`.

Decision: **keep the existing ORDER BY clause.** Overdue-first is an emergent property of `due_date ASC`.

### `/admin/clients/[id]` Assigned Forms tab

**Current query** (verified at Plan 16-03 Summary Task 2):

```ts
.order("created_at", { ascending: false })
```

This orders by recency of assignment creation, not by due_date. For Phase 17 the planner should **change this ORDER BY** to match the client surface:

```ts
.order("due_date", { ascending: true, nullsFirst: false })
.order("created_at", { ascending: false })
```

Rationale: the admin viewing a client's Assigned Forms tab benefits from overdue work surfacing first (it's the action they need to chase). This is a one-line ORDER BY swap in `app/admin/clients/[id]/page.tsx` — call it out as a Phase 17 mechanical change in the plan.

---

## Accessibility

- **Pill `aria-label`:** Mandatory. Pattern: `Overdue — was due {N} day{s} ago` (or `was due today` for N=0). The visible `OVERDUE` text alone is acceptable for sighted users, but the day-count context belongs to assistive tech.
- **Colour contrast:** `#a14a2a` on a 10% background overlay must pass WCAG AA against both surfaces.
  - On cream `#faf9f6`: text/bg pairing computed against the painted bg (`#faf9f6` + 10% rust overlay) — verify ≥ 4.5:1 during checker pass.
  - On dark `#1c1b24`: text/bg pairing against (`#1c1b24` + 10% rust overlay) — verify ≥ 4.5:1.
  - If either fails, bump the bg overlay to `/15` rather than changing the hue — keeps the pill family geometry consistent.
- **Tooltip (admin only):** Use the existing `Tooltip` shadcn primitive. Trigger via the pill itself (no asChild — same Phase 16 constraint per `active-pill.tsx`). Tooltip is non-essential — the `aria-label` carries the same information for keyboard / SR users.
- **Don't rely on colour alone:** The literal text `OVERDUE` plus the `aria-label` carries the meaning. Colour-blind users see the pill as a coloured tag distinct from the amber/teal/grey pills.

---

## State Matrix

| Assignment state | Active tab (client) | Assigned Forms tab (admin) | DUE date colour | Status pill | Overdue pill |
|------------------|---------------------|----------------------------|-----------------|-------------|--------------|
| Pending, due > today | shown | shown | muted `#8a857f` | `PENDING` grey | absent |
| Pending, due == today | shown | shown | muted `#8a857f` | `PENDING` grey | absent (due TODAY is not yet overdue per the `<` semantics) |
| Pending, due < today | shown | shown | rust `#e55a3a` | `PENDING` grey | **`OVERDUE` rust** |
| In progress, due < today | shown | shown | rust `#e55a3a` | `IN PROGRESS` amber | **`OVERDUE` rust** |
| Completed (regardless of due) | Completed tab only | shown (greyed) | muted | `COMPLETED` teal | **absent** |
| Revoked (`deleted_at NOT NULL`) | excluded from query | excluded from query | n/a | n/a | n/a |
| No due_date set | shown | shown | "no due date" text | normal status pill | absent (can't be overdue without a date) |

---

## Copywriting Contract Additions

Single new entry; everything else inherits from Phase 16.

| Element | Surface | Copy | Notes |
|---------|---------|------|-------|
| Overdue pill label | Both | `OVERDUE` | Locked. Uppercase. |
| Overdue pill aria-label (N ≥ 1) | Both | `Overdue — was due {N} day{s} ago` | Sentence case for SR readers. |
| Overdue pill aria-label (N = 0) | Both | `Overdue — was due today` | Same-day cron-transition case. |
| Overdue tooltip (admin only) | Admin | `Was due {N} day{s} ago` | Optional but recommended; uses existing Tooltip primitive. |

No new empty states. No new error toasts. No new destructive actions.

---

## Component Inventory Delta

| Component | Action |
|-----------|--------|
| `OverduePill` (new) | Create at `app/_components/overdue-pill.tsx` as a **shared** component (used by both admin and client surfaces). Pure presentational. Accepts a single prop `daysOverdue: number`. Returns the pill or `null` if `daysOverdue < 0` (defensive — caller should already gate, but keep the component robust). |
| `lib/assignments/is-overdue.ts` (new) | Extract the `isOverdue(dateStr: string \| null): boolean` helper that currently lives inline in `assignment-card.tsx`. Also export `daysOverdue(dateStr: string \| null): number` returning `Math.max(0, Math.floor((now - due) / DAY_MS))`. Both client surface and admin tab consume from here. |

No shadcn component installs. No new fonts. No new colour tokens added to `app/globals.css` — the `#a14a2a` is used inline via Tailwind arbitrary value `text-[#a14a2a] bg-[#a14a2a]/10`, matching the existing `#c0a66d` and `#3b8273` inline pattern from Phase 16.

---

## Time-Zone Note (cross-references Phase 17 CONTEXT open question 6)

The "overdue" derivation depends on what "today" means. The client surface evaluates this in the browser; the admin surface RSC evaluates it on the server (Vercel = UTC). For Matt/Yellow Broom (UK) and the cron (UTC), midnight UK ≈ midnight UTC except during BST (1h skew).

**UI-side rule:** Compare using `new Date(new Date().toDateString())` (the existing pattern in `assignment-card.tsx:41`) — this gives "today at local midnight." For the cron, see the planner's open question 6 resolution. This UI spec does **not** lock the cron's time-zone — only the visual contract.

---

## BLOCKING Issues

The planner must resolve these before execution:

1. **Admin Assigned Forms tab ORDER BY change.** The current `ORDER BY created_at DESC` does not surface overdue first. The planner must decide: (a) change the ORDER BY in `app/admin/clients/[id]/page.tsx` to `due_date ASC NULLS LAST, created_at DESC` to match the client surface, OR (b) leave the ORDER BY and let the visual rust pill do the work. **Recommendation: (a)** — matches the principle that "the most chase-worthy item floats first."

2. **Shared `lib/assignments/is-overdue.ts` extraction.** Today the helper is inline in `assignment-card.tsx`. Phase 17 needs the same logic on the admin row. Planner must confirm the file path and exported function signatures before two surfaces diverge.

3. **WCAG AA verification of `#a14a2a` on both surfaces.** Checker must run the contrast computation against the painted backgrounds (cream + 10% overlay; dark + 10% overlay). If either fails, fallback per the rule: bump overlay opacity to `/15`. The planner should add this as an acceptance criterion in the implementation plan.

4. **Tooltip on client surface — confirm: no.** This spec says the overdue pill on the client card does NOT carry a tooltip (the card is touch-friendly and tooltips don't fire on touch). The `aria-label` covers SR access. If product disagrees, this is a 5-min change.

No other blockers. Everything else is mechanical mounting on Phase 16 primitives.

---

## Registry Safety

| Registry | Blocks used in Phase 17 | Safety Gate |
|----------|------------------------|-------------|
| shadcn official | none new — reuses `Tooltip` already installed by Plan 16-03 | not required — no new installs |
| Third-party | none | not applicable |

No registry vetting required.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS (verify `#a14a2a` WCAG AA on both surfaces; fall back to `/15` overlay if needed)
- [ ] Dimension 4 Typography: PASS (reuses existing 9px mono / tracking-0.25em)
- [ ] Dimension 5 Spacing: PASS (reuses `px-2 py-0.5 rounded-sm` pill geometry)
- [ ] Dimension 6 Registry Safety: PASS (no new installs)

**Approval:** pending

---

## Pre-Population Sources

| Source | Decisions Used |
|--------|---------------|
| `17-CONTEXT.md` | Overdue semantics (LOCKED), surface scope, derived-not-stored constraint |
| `16-UI-SPEC.md` | Entire visual vocabulary (pill geometry, mono type scale, colour family) |
| `16-03-SUMMARY.md` | Admin Assigned Forms tab shape, RevokeAssignmentButton placement, current ORDER BY |
| `16-04-SUMMARY.md` | `/client/assignments` query, AssignmentCard structure, existing `isOverdue` helper |
| `app/admin/clients/_components/active-pill.tsx` | Tooltip pattern, absence-is-affordance precedent (count=0 returns null) |
| `app/client/assignments/_components/assignment-card.tsx` | StatusPill exact markup, `isOverdue()` helper to reuse, existing `#e55a3a` date colouring |
| `app/client/assignments/page.tsx` | Confirmed sort already orders overdue-first via `due_date ASC nullsFirst:false` |
| User input this session | 0 — all answered by upstream artifacts |
