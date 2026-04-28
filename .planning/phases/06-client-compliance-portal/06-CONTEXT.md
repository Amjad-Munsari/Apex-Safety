# Phase 6: Client Compliance Portal - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing client portal UI (`app/client/`) to live Supabase data. A client who logs in via magic-link sees their compliance status, downloads documents and delivered reports, and gets a meaningful onboarding view if no documents exist yet. The portal is mobile-responsive (tablet primary, phone secondary).

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout
- **D-01:** Dashboard (`/client`) shows summary cards with counts + worst status per area (compliance, reports, hours, documents). Each card links to its detail page.
- **D-02:** Compliance detail page (`/client/compliance`) groups documents by category with RAG status badges (current/expiring/expired) and expiry dates.
- **D-03:** Categories are placeholder-seeded (Fire Certificates, Electrical Safety, Emergency Systems, General H&S) until Matt provides his taxonomy. Future improvement: Matt can add/remove categories without a deploy.

### Empty/Onboarding State
- **D-04:** New clients with zero documents and zero reports see a branded welcome view with a checklist of what to expect ("Documents & certificates", "Assessment reports", "Compliance tracking") and 888 Safety contact info.
- **D-05:** Welcome view disappears automatically on first document upload or first report delivery — trigger is `documents.length === 0 && reports.length === 0`.

### Document Access Flow
- **D-06:** Tapping a document row opens a preview modal (browser PDF viewer / embedded iframe) with a download button. Not direct download on tap.
- **D-07:** Expired documents are hidden from the main compliance view but accessible in an "Archive" or "History" section deeper in the UI.
- **D-08:** All document downloads use short-lived signed Storage URLs generated server-side (1-hour expiry for in-portal viewing).

### Data Wiring
- **D-09:** Portal pages use async Server Components for data fetching (Supabase queries via `createServerClient`). Client Components only for interactive parts (PDF preview modal, download triggers).
- **D-10:** Auth guard in portal layout: `getUser()` → if no user, redirect `/auth/login`. If user is admin role, redirect `/admin`. Proxy.ts handles session refresh on every request.
- **D-11:** RLS handles all multi-tenant isolation — no application-level client_id filtering needed beyond what RLS provides.

### Claude's Discretion
- Data wiring approach (D-09): User deferred to Claude's judgement. Chose hybrid Server Components + Client Component islands as the natural Next.js 16 pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Schema
- `.planning/research/ARCHITECTURE.md` §Component Map §3 (Client Portal Module) — defines portal routes, RLS guarantees, and what the module owns/doesn't own
- `.planning/research/ARCHITECTURE.md` §Storage Partitioning — bucket layout, signed URL patterns, Storage RLS policies
- `.planning/research/ARCHITECTURE.md` §Supabase Schema Skeleton — all table definitions referenced by portal queries

### Stack & Patterns
- `.planning/research/STACK.md` §Supabase Ecosystem — `@supabase/ssr` createServerClient patterns for Server Components
- `.planning/research/STACK.md` §Next.js 16 Migration Landmines — async request APIs, proxy.ts rename

### Requirements
- `.planning/REQUIREMENTS.md` §Client Compliance Portal (PORTAL) — PORTAL-01 through PORTAL-07

### Existing Code
- `app/client/` — existing hardcoded portal pages (dashboard, compliance, reports, billing)
- `app/client/layout.tsx` — client portal shell (light theme, sticky nav)
- `supabase/migrations/001_initial_schema.sql` — schema, RLS policies, storage buckets

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/client/layout.tsx` — client shell with light theme, sticky nav, footer. Already styled. Wire auth guard into it.
- `app/client/page.tsx` — hardcoded dashboard with compliance summary, hours, attention items. Replace hardcoded data with Supabase queries.
- `app/client/compliance/page.tsx` — hardcoded compliance view with category grouping and RAG badges. Already matches D-02 layout.
- `app/client/reports/page.tsx` — hardcoded reports list. Wire to `form_submissions` where `status = 'delivered'`.
- `app/client/billing/page.tsx` — hardcoded hours balance + transaction history. Wire to `clients.hours_balance` and `hours_transactions`.
- `components/ui/badge.tsx` — RAG status badges (reuse for current/expiring/expired)
- `components/ui/card.tsx` — summary cards on dashboard
- `components/ui/dialog.tsx` — modal for PDF preview (D-06)
- `hooks/use-mobile.ts` — mobile detection for responsive layout

### Established Patterns
- Light theme tokens: `bg-[#fbfaf5]`, white cards, `text-[#1a1a1a]` primary, status colors `#3b8273`/`#c0a66d`/`#8b2b21`
- Client Components marked with `"use client"` — used for interactive pages
- No Supabase client setup exists yet — `lib/supabase/server.ts` and `lib/supabase/client.ts` must be created (Phase 1 dependency)

### Integration Points
- `app/client/layout.tsx` — auth guard insertion point (Server Component, check session)
- `lib/supabase/server.ts` — must exist before portal can query Supabase (Phase 1 deliverable)
- `supabase/migrations/001_initial_schema.sql` — all tables and RLS policies already defined

</code_context>

<specifics>
## Specific Ideas

- Placeholder compliance categories: Fire Certificates, Electrical Safety, Emergency Systems, General H&S (inferred from Blank FRA template)
- Document future improvement in project docs: "Matt has ability to add/remove custom compliance categories"
- Archive/History section for expired documents — accessible but not prominent

</specifics>

<deferred>
## Deferred Ideas

- Matt-managed compliance categories (add/remove without deploy) — future improvement, not Phase 6 scope
- Real-time updates via Supabase Realtime (portal refreshes when Matt uploads) — evaluate in Phase 7 (notifications)

</deferred>

---

*Phase: 06-Client Compliance Portal*
*Context gathered: 2026-04-29*
