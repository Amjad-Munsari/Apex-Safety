# Codebase Concerns

**Analysis Date:** 2026-04-29

## Tech Debt

**All page data is hardcoded — no backend integration exists:**
- Issue: Every page renders entirely from inline constants and JSX literals. There is zero Supabase client usage, zero `fetch` calls, zero server actions, and zero API routes in the entire codebase. The `@supabase/supabase-js` package is not even installed as a dependency (`package.json`). All client names, hours balances, compliance documents, reports, transactions, proposals, and service catalogues are static mock data embedded directly in page components.
- Files: `app/admin/page.tsx`, `app/client/page.tsx`, `app/client/compliance/page.tsx`, `app/client/reports/page.tsx`, `app/client/billing/page.tsx`, `app/proposals/new/page.tsx`
- Impact: The entire application is a UI prototype. No requirement from REQUIREMENTS.md is actually functional. Every page must be rewritten to fetch from Supabase when Phase 1 (auth + schema) is implemented.
- Fix approach: Install `@supabase/ssr`, create `lib/supabase/client.ts` and `lib/supabase/admin.ts` (with `import "server-only"`), then progressively replace hardcoded data with server-side queries in each page. Convert admin and client pages to server components where possible.

**Migration schema diverges from FOUND-04 requirements:**
- Issue: The migration `001_initial_schema.sql` is missing two tables required by FOUND-04: `field_media` and `workflow_errors`. It also lacks `deleted_at TIMESTAMPTZ` soft-delete columns on every table, which FOUND-04 explicitly requires.
- Files: `supabase/migrations/001_initial_schema.sql`
- Impact: When Phase 2 (forms) and Phase 5 (AI reports) begin, the schema will need a new migration to add `field_media` and `workflow_errors`. Soft-delete support must be retroactively added or the requirement must be de-scoped.
- Fix approach: Create migration `002_add_missing_tables.sql` adding `field_media`, `workflow_errors` tables, and `deleted_at TIMESTAMPTZ DEFAULT NULL` columns to all existing tables. Add RLS policies for both new tables. Update indexes.

**Monolithic page components with no extraction:**
- Issue: Page components contain all layout, data, and presentation logic in single files. `app/admin/page.tsx` is 585 lines of inline JSX. `app/proposals/new/page.tsx` is 642 lines with all step logic, data constants, helper functions, and rendering in one file.
- Files: `app/admin/page.tsx` (585 lines), `app/proposals/new/page.tsx` (642 lines), `app/client/page.tsx` (197 lines)
- Impact: When backend data replaces hardcoded values, these files will become unmaintainable. Component reuse is impossible (e.g., the RAG status badge is duplicated inline across admin and client pages with different color values).
- Fix approach: Extract repeated UI patterns into `components/` — specifically: `ClientTable`, `ExpiryList`, `RAGBadge`, `HoursBar`, `ProposalPipeline`, `WorkflowErrorRow`, `ComplianceDocRow`, `TransactionTable`. Extract proposal step logic into separate step components under `app/proposals/new/steps/`.

**Proposals CSS is a parallel design system (1,276 lines):**
- Issue: `app/proposals/proposals.css` defines an entirely separate design system with its own CSS custom properties (`--p-bg`, `--p-surface`, `--p-gold`, etc.) and class naming convention (`prop-*`), bypassing Tailwind and the shadcn component library used everywhere else. This creates two incompatible styling approaches.
- Files: `app/proposals/proposals.css` (1,276 lines), `app/proposals/layout.tsx`, `app/proposals/new/page.tsx`
- Impact: Maintaining two design systems doubles styling work. The proposal pages cannot use shadcn components consistently. Theme switching (dark/light) does not apply to proposal pages. Future proposals features must learn both systems.
- Fix approach: Migrate proposals to Tailwind + shadcn components incrementally. Map `--p-*` tokens to the existing `globals.css` theme variables. Replace `prop-*` classes with Tailwind utility classes and shadcn component variants.

## Known Bugs

**Sidebar links point to non-existent routes:**
- Symptoms: Clicking "Clients" (`/admin/clients`), "Assessments", "Documents", "Proposals", "Hours", or "Workflow errors" in the admin sidebar either navigates to a 404 page or does nothing (`href="#"`).
- Files: `components/app-sidebar.tsx` (lines 47, 60, 73, 86, 99, 111)
- Trigger: Click any sidebar item other than "Dashboard".
- Workaround: Only the Dashboard link (`/admin`) works. The `/admin/clients` route has no corresponding `app/admin/clients/page.tsx`.

**Hardcoded date "Saturday, 18 April 2026" in admin layout:**
- Symptoms: The admin header always displays "Saturday, 18 April 2026" regardless of the actual date.
- Files: `app/admin/layout.tsx` (line 37)
- Trigger: Load the admin dashboard on any day.
- Workaround: None. Must be replaced with `new Date().toLocaleDateString()`.

**Hardcoded greeting "Good morning, Matt" ignores time of day:**
- Symptoms: Admin dashboard always says "Good morning" regardless of time.
- Files: `app/admin/page.tsx` (line 21)
- Trigger: Load admin dashboard in the afternoon or evening.
- Workaround: None. Cosmetic but looks broken to the end user.

**Client dashboard hardcodes client identity:**
- Symptoms: Client layout always renders "Hallam House Care Home" with "Sarah Whitfield" as the user, regardless of who is logged in.
- Files: `app/client/layout.tsx` (lines 23-24, 62-63), `app/client/page.tsx` (lines 32-35)
- Trigger: Any client user loads the client portal.
- Workaround: None. All client data is static. Must be replaced with authenticated user/client context from Supabase auth.

**`credit_hours_from_paypal` function has no RLS or role check:**
- Symptoms: The SECURITY DEFINER function `credit_hours_from_paypal` can be called by any authenticated user because there is no policy or role check inside the function body.
- Files: `supabase/migrations/001_initial_schema.sql` (lines 368-380)
- Trigger: Any authenticated user could call `SELECT credit_hours_from_paypal(...)` to credit hours to any client.
- Workaround: The function is not yet wired to any application code. Must add `REVOKE EXECUTE ON FUNCTION credit_hours_from_paypal FROM PUBLIC` and grant only to `service_role`.

## Security Considerations

**No authentication or authorization exists:**
- Risk: The entire application runs without any auth. There is no middleware, no session management, no login page, and no route protection. Any visitor can access `/admin` and `/client` routes.
- Files: No `middleware.ts` or `proxy.ts` exists. No `lib/supabase/` directory exists.
- Current mitigation: None. The app is not deployed to production.
- Recommendations: Implement auth before any production deployment. Per STATE.md constraints: use `@supabase/ssr` (not `@supabase/auth-helpers-nextjs`), create `proxy.ts` (not `middleware.ts` per Next.js 16), and use `getUser()` server-side (never `getSession()`).

**No Supabase client library installed:**
- Risk: Without `@supabase/ssr` and `@supabase/supabase-js` as dependencies, no data layer security exists.
- Files: `package.json`
- Current mitigation: None. Hardcoded data means no real data is at risk.
- Recommendations: Install `@supabase/ssr` and `@supabase/supabase-js`. Create `lib/supabase/client.ts` (browser client), `lib/supabase/server.ts` (server component client), and `lib/supabase/admin.ts` (service role, `import "server-only"`).

**`.env.local` is present but not in `.gitignore` effectively:**
- Risk: `.env.local` exists in the working directory. While `.env*` is in `.gitignore`, the file was observed at the root. Verify it is not tracked by git.
- Files: `.env.local`, `.gitignore`
- Current mitigation: `.gitignore` has `.env*` pattern which should exclude it.
- Recommendations: Run `git ls-files --error-unmatch .env.local` to confirm it is not tracked. Never read or commit env files.

**RLS policies use `auth.jwt() -> 'app_metadata' ->> 'role'` without server-side enforcement:**
- Risk: The `app_metadata.role = 'admin'` claim is set via Supabase admin API, but without application-level middleware checking this claim server-side, the admin check relies entirely on RLS. If any query bypasses RLS (e.g., via service_role key leaking to client), all data is exposed.
- Files: `supabase/migrations/001_initial_schema.sql` (all admin policies)
- Current mitigation: RLS is enabled on all tables. Service role key does not exist in client code (no Supabase code exists at all).
- Recommendations: When auth is implemented, enforce admin role check in `proxy.ts`/middleware for all `/admin/*` routes. Never rely solely on RLS for route-level access control.

**`form_submissions.submitted_by` has no foreign key:**
- Risk: The `submitted_by UUID` column on `form_submissions` has no FK constraint, unlike most other user reference columns in the schema. This means orphaned references are possible.
- Files: `supabase/migrations/001_initial_schema.sql` (line 84)
- Current mitigation: No application code writes to this table yet.
- Recommendations: Add `REFERENCES auth.users(id)` FK constraint in a follow-up migration if this column should reference Supabase auth users.

## Performance Bottlenecks

**Admin dashboard renders all data client-side ("use client"):**
- Problem: The admin dashboard at `app/admin/page.tsx` is marked `"use client"` and renders 585 lines of static content on the client. When connected to real data, this means all data will be fetched client-side, increasing bundle size and time-to-interactive.
- Files: `app/admin/page.tsx` (line 1)
- Cause: Recharts `PieChart` requires client-side rendering, but the rest of the dashboard does not.
- Improvement path: Convert the dashboard to a server component. Extract only the compliance donut chart into a client component. Fetch data server-side via Supabase server client. This aligns with Next.js 16 best practices and reduces JavaScript sent to the browser.

**No code-splitting between admin and client portals:**
- Problem: The admin portal (dark theme, sidebar layout) and client portal (light theme, nav layout) share no layout boundary that would enable separate bundle loading. A user accessing `/client` still downloads sidebar, recharts, and admin-specific code.
- Files: `app/admin/layout.tsx`, `app/client/layout.tsx`, `app/layout.tsx`
- Cause: Root layout wraps everything with ThemeProvider and TooltipProvider. No dynamic imports or route-group isolation.
- Improvement path: Use Next.js route groups `(admin)` and `(client)` to isolate layouts and reduce shared bundle. Lazy-load Recharts with `next/dynamic`.

## Fragile Areas

**Proposal new page — all state in one component:**
- Files: `app/proposals/new/page.tsx`
- Why fragile: 642 lines of JSX with a 4-step wizard controlled by a single `useState(step)`. All service catalogue data, client data, form state, quantity management, computed totals, and rendering for all 4 steps live in one component. A change to any step risks breaking others.
- Safe modification: Extract each step into its own component under `app/proposals/new/steps/`. Extract `SERVICE_CATEGORIES` and `EXISTING_CLIENTS` into a shared data file or fetch from Supabase. Use a reducer or form library for multi-step state.
- Test coverage: None. No tests exist in the project.

**Admin dashboard — tightly coupled to mock data shape:**
- Files: `app/admin/page.tsx`
- Why fragile: Every table row, expiry item, hours bar, proposal count, and workflow error is written as inline JSX with hardcoded values. When converting to dynamic data, every section must be rewritten. There is no data abstraction layer to swap mock data for real queries.
- Safe modification: Create typed data-fetching functions (e.g., `getClients()`, `getUpcomingExpiries()`, `getPendingReports()`) that return the same shape as the current inline data. Wire these functions first, then swap implementations from hardcoded to Supabase queries.
- Test coverage: None.

**Client compliance page — duplicated status badge logic:**
- Files: `app/client/compliance/page.tsx`, `app/client/page.tsx`, `app/client/reports/page.tsx`
- Why fragile: The RAG status badge (CURRENT/EXPIRING/EXPIRED) is independently implemented with inline ternary color logic in 3 different files, each with slightly different color values and class structures. Changing the badge design requires edits in 3+ places.
- Safe modification: Extract a shared `<StatusBadge status="CURRENT" />` component to `components/status-badge.tsx`.
- Test coverage: None.

## Scaling Limits

**Single-file schema migration:**
- Current capacity: One migration file (`001_initial_schema.sql`) contains all tables, RLS policies, indexes, functions, and storage buckets (484 lines).
- Limit: As the schema evolves, a single monolithic migration becomes hard to debug if it fails partway through. Rollback requires manual intervention.
- Scaling path: Use numbered incremental migrations (`002_add_field_media.sql`, `003_add_soft_delete.sql`, etc.). Never modify `001_initial_schema.sql` after it has been applied to any database.

## Dependencies at Risk

**`@base-ui/react` — early-stage library:**
- Risk: `@base-ui/react@^1.4.1` is the successor to Radix UI primitives but is relatively new. The shadcn components in this project use `@base-ui/react` (e.g., `DropdownMenuTrigger` with `render` prop pattern), which differs from the older `@radix-ui/react-*` API. Documentation and community support are less mature.
- Impact: Breaking changes in minor versions could require component updates. Some shadcn patterns may not have been updated for base-ui yet.
- Migration plan: Pin exact version in `package.json` (change `^1.4.1` to `1.4.1`). Monitor base-ui changelog before upgrading. Fall back to `@radix-ui/react-*` packages if stability becomes an issue.

**No Supabase dependency despite being the core data platform:**
- Risk: `@supabase/ssr` and `@supabase/supabase-js` are not in `package.json`, even though Supabase is the chosen backend. The migration file exists but the app cannot connect to Supabase.
- Impact: Phase 1 cannot begin without installing these packages.
- Migration plan: `npm install @supabase/ssr @supabase/supabase-js`. Per STATE.md constraints, do NOT install the deprecated `@supabase/auth-helpers-nextjs`.

## Missing Critical Features

**No authentication system:**
- Problem: There is no login page, no session management, no middleware, and no route protection.
- Blocks: Every requirement from AUTH-01 through AUTH-07. All client-scoped data isolation (FOUND-05). Admin dashboard (ADMIN-*). Client portal (PORTAL-*).

**No data persistence layer:**
- Problem: No database client, no API routes, no server actions. All data is hardcoded.
- Blocks: Every dynamic feature. The entire v1 scope of 102 requirements.

**No testing infrastructure:**
- Problem: No test runner (Jest, Vitest, Playwright) is configured. No test files exist. No `test` script in `package.json`.
- Blocks: FOUND-07 (Storage URL auth test), every critical test listed in STATE.md. Cannot verify RLS, auth, or data isolation.

**No error handling or loading states:**
- Problem: No error boundaries, no loading skeletons for data fetches, no retry logic.
- Blocks: REPORT-12 (workflow error surfacing), graceful degradation on API failures.

## Test Coverage Gaps

**No tests exist in the entire project:**
- What's not tested: Everything. There are zero test files, no test runner configured, and no `test` script in `package.json`.
- Files: Entire codebase.
- Risk: When Phase 1 implements auth and RLS, there is no way to verify that cross-tenant data isolation works. The STATE.md lists 5 critical integration tests that must be wired (client isolation, Storage URL auth, admin.ts import guard, schema versioning, PayPal idempotency).
- Priority: High. Install Vitest 4.x + Playwright 1.51+ (per STATE.md constraint — never Jest). Create test infrastructure before any backend code lands.

---

*Concerns audit: 2026-04-29*
