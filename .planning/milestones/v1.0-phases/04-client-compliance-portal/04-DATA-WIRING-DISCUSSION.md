# Phase 6: Client Compliance Portal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 06-Client Compliance Portal
**Areas discussed:** Dashboard layout, Empty/onboarding state, Document access flow, Data wiring approach

---

## Dashboard Layout

### Q1: Compliance item grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Category sections | Group by compliance category with RAG badge per item | ✓ |
| Single sorted list | All documents in one flat list sorted by urgency | |
| Summary cards + detail page | Dashboard shows category cards with counts, tap for detail | |

**User's choice:** Category sections
**Notes:** None

### Q2: Dashboard vs separate compliance page

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard IS compliance | Main /portal page shows full compliance view | |
| Summary + separate page | Dashboard shows compact summary cards, detail at /portal/compliance | ✓ |

**User's choice:** Summary + separate page
**Notes:** None — matches existing route structure

### Q3: Dashboard summary card content

| Option | Description | Selected |
|--------|-------------|----------|
| Counts + worst status | Each card shows total count and highlights worst status | ✓ |
| Donut chart + counts | Mini donut chart per card showing RAG distribution | |
| Minimal — just status + link | One-line status + link | |

**User's choice:** Counts + worst status
**Notes:** None

### Q4: Placeholder categories

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder categories from FRA | Seed with inferred categories from Blank FRA template | |
| Generic 'Uncategorised' bucket | All docs in single group until Matt provides taxonomy | |
| Let Matt define from day one | Block portal grouping until Matt's answer | |

**User's choice:** (Free text) Keep placeholder categories for now; update documentation to note "possible improvement: Matt has ability to add/remove custom categories"
**Notes:** User wants this documented as a future capability, not Phase 6 scope

---

## Empty/Onboarding State

### Q1: First login experience

| Option | Description | Selected |
|--------|-------------|----------|
| Welcome + checklist | Branded welcome with checklist of what to expect | ✓ |
| Empty state per card | Normal dashboard layout with 'No documents yet' per card | |
| Single splash page | Full-width card with welcome message and contact info | |

**User's choice:** Welcome + checklist
**Notes:** None

### Q2: Welcome view transition trigger

| Option | Description | Selected |
|--------|-------------|----------|
| First document upload | Welcome replaced by real dashboard on any document or report | ✓ |
| Manual toggle by Matt | Matt marks client as 'onboarded' | |
| After all categories have docs | Welcome stays until every category has at least one document | |

**User's choice:** First document upload
**Notes:** None

---

## Document Access Flow

### Q1: Document access pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Tap to download | Tapping a row triggers signed URL download | |
| Preview modal first | Tapping opens modal with PDF preview + download button | ✓ |
| Detail page per document | Each document gets its own page with metadata + download | |

**User's choice:** Preview modal first
**Notes:** User also asked about storage bucket naming — confirmed buckets already created in migration (client-documents, reports, proposals)

### Q2: Expired document handling

| Option | Description | Selected |
|--------|-------------|----------|
| Visible + downloadable | Expired docs stay visible with red EXPIRED badge | |
| Visible but greyed out | Expired docs shown greyed out, still downloadable | |
| Hidden after expiry | Expired docs removed from client view | |

**User's choice:** (Free text) Hide but make them accessible somewhere deep
**Notes:** Hidden from main compliance view, accessible in an Archive/History section

---

## Data Wiring Approach

### Q1: Data fetching pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Server Components | Async Server Components query Supabase directly | |
| Client-side fetching | Client Components with useEffect/SWR | |
| Hybrid | Server Components for data, Client Components for interaction | |

**User's choice:** (Free text) "Whatever you think is best"
**Notes:** Claude chose hybrid (Server Components + Client Component islands) as the natural Next.js 16 pattern

### Q2: Auth session handling

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to login | If session expired, redirect to /auth/login | ✓ |
| Inline auth prompt | Show portal shell with 'Please sign in' card | |

**User's choice:** Redirect to login
**Notes:** None

---

## Claude's Discretion

- **Data wiring approach (D-09):** User said "whatever you think is best." Claude selected hybrid Server Components + Client Component islands — Server Components for data fetching, Client Components only for interactive parts (PDF modal, download triggers).

## Deferred Ideas

- Matt-managed compliance categories (add/remove without deploy) — future improvement
- Real-time portal updates via Supabase Realtime — evaluate in Phase 7
