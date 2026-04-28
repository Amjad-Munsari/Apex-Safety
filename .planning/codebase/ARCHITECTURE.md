# Architecture

**Analysis Date:** 2026-04-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 16 App Router                      │
│           `app/layout.tsx` (root layout)                     │
├────────────────┬──────────────────┬──────────────────────────┤
│  Admin Portal  │  Client Portal   │  Proposals (standalone)  │
│  `app/admin/`  │  `app/client/`   │  `app/proposals/`        │
│  (dark theme)  │  (light theme)   │  (dark, self-contained)  │
└───────┬────────┴────────┬─────────┴─────────┬────────────────┘
        │                 │                   │
        ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│               Shared Components + UI Library                 │
│  `components/ui/` (shadcn/ui base-mira)                     │
│  `components/app-sidebar.tsx` (admin sidebar)                │
│  `components/theme-provider.tsx` (next-themes)               │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Shared Utilities + Hooks                    │
│  `lib/utils.ts` (cn helper)                                 │
│  `hooks/use-mobile.ts`                                       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ (planned — not yet wired)
┌─────────────────────────────────────────────────────────────┐
│           Supabase (Postgres + Auth + Storage)               │
│  `supabase/migrations/001_initial_schema.sql`               │
│  12 tables, RLS on all, 5 storage buckets                   │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root Layout | Font loading (Inter, Newsreader, JetBrains Mono), ThemeProvider + TooltipProvider wrapping | `app/layout.tsx` |
| Root Page | Redirect `/` to `/admin` | `app/page.tsx` |
| Admin Layout | Dark-themed shell with sidebar, top bar (search, date, upload), main content area | `app/admin/layout.tsx` |
| Admin Dashboard | "Single pane of glass" overview: clients table, expiries, compliance donut, hours, proposals, workflow errors, monthly stats | `app/admin/page.tsx` |
| Client Layout | Light-themed client portal shell with sticky nav, footer with consultant info | `app/client/layout.tsx` |
| Client Dashboard | Client-facing overview: compliance summary, hours balance, needs-attention list | `app/client/page.tsx` |
| Compliance Page | Document library grouped by category (Fire Safety, Electrical, Training, Water Hygiene, Structural) with status badges and download actions | `app/client/compliance/page.tsx` |
| Reports Page | List of assessment reports with status badges and download dropdowns | `app/client/reports/page.tsx` |
| Billing Page | Hours balance display + transaction history table | `app/client/billing/page.tsx` |
| Proposals Layout | Thin layout wrapper importing `proposals.css` | `app/proposals/layout.tsx` |
| New Proposal Page | 4-step wizard (Client, Services, Draft, Send) with service catalogue, line items, AI-draft preview, e-signature send | `app/proposals/new/page.tsx` |
| AppSidebar | Admin navigation sidebar: Dashboard, Clients, Assessments, Documents, Proposals, Hours, Workflow errors | `components/app-sidebar.tsx` |
| ThemeProvider | next-themes wrapper with "D" hotkey toggle between light/dark | `components/theme-provider.tsx` |

## Pattern Overview

**Overall:** Next.js App Router with three distinct portal zones sharing a common component library

**Key Characteristics:**
- All page components are client-side rendered (`"use client"`) except root layout and admin layout (Server Components)
- No data fetching layer exists yet -- all data is hardcoded inline as static arrays/objects within page components
- Two completely separate visual identities: dark (admin + proposals) and light (client portal), managed via layout-level class application rather than theme switching
- Supabase schema is defined but not yet integrated with any frontend code

## Layers

**Presentation Layer (App Router Pages):**
- Purpose: Renders UI for three distinct user contexts (admin, client, proposals)
- Location: `app/`
- Contains: Page components, route layouts, global CSS
- Depends on: `components/`, `lib/`, `hooks/`
- Used by: End users via browser

**Shared Components Layer:**
- Purpose: Reusable UI primitives and application-level components
- Location: `components/`
- Contains: shadcn/ui primitives (`components/ui/`), app-level components (`components/app-sidebar.tsx`, `components/theme-provider.tsx`)
- Depends on: `lib/utils.ts`, `hooks/use-mobile.ts`, external packages (lucide-react, next-themes, cmdk, @base-ui/react)
- Used by: All page components

**Utilities Layer:**
- Purpose: Shared helpers and custom hooks
- Location: `lib/`, `hooks/`
- Contains: `cn()` classname merge helper, `useIsMobile()` hook
- Depends on: clsx, tailwind-merge
- Used by: Components and pages

**Data Layer (planned, not wired):**
- Purpose: Multi-tenant Postgres database with RLS, file storage
- Location: `supabase/migrations/`
- Contains: Schema definitions, RLS policies, storage bucket setup, helper functions
- Depends on: Supabase platform
- Used by: Will be used by Server Components, Server Actions, and API routes (not yet implemented)

## Data Flow

### Current State (Static/Prototype)

1. User navigates to `/` -- server-side redirect to `/admin` (`app/page.tsx`)
2. Admin layout renders sidebar + top bar shell (`app/admin/layout.tsx`)
3. Admin page renders hardcoded dashboard data inline (`app/admin/page.tsx`)

No API calls, no database queries, no server actions exist. All data is inline JSX.

### Planned Primary Request Path (Form Submission)

Based on `supabase/migrations/001_initial_schema.sql` and `.planning/ROADMAP.md`:

1. Admin assigns a form template to a client (`form_assignments` table)
2. User fills form on-site (tablet), attaching photos via `form-media` storage bucket
3. Submission writes to `form_submissions` with `answers_json` + `template_version_id`
4. n8n webhook triggers AI report generation (GPT-4 via OpenRouter)
5. Generated PDF stored in `reports` bucket, admin reviews via dashboard
6. Approved report delivered to client portal

### Planned Payment Flow

1. Client initiates hours purchase in portal (`app/client/billing/`)
2. PayPal Orders v2 checkout created
3. `PAYMENT.CAPTURE.COMPLETED` webhook fires
4. `credit_hours_from_paypal()` SQL function atomically credits hours (`supabase/migrations/001_initial_schema.sql:368-380`)
5. Receipt email sent via n8n

**State Management:**
- No global state management library is used
- React `useState` for local component state (e.g., proposal wizard step tracking in `app/proposals/new/page.tsx`)
- Theme state managed by next-themes via `components/theme-provider.tsx`
- Planned: Supabase auth session state (not yet implemented)

## Key Abstractions

**Portal Zones:**
- Purpose: Three independent user-facing applications sharing infrastructure
- Examples: `app/admin/`, `app/client/`, `app/proposals/`
- Pattern: Each zone has its own layout defining chrome (sidebar/header/footer), visual theme, and navigation. The root layout provides only font loading and global providers.

**shadcn/ui Component Library:**
- Purpose: Pre-built, customizable UI primitives
- Examples: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/sidebar.tsx`, `components/ui/dropdown-menu.tsx`
- Pattern: Uses `base-mira` style variant. Components use `@base-ui/react` headless primitives with Tailwind styling. Configured via `components.json` with path aliases.

**Multi-Tenant Schema:**
- Purpose: Isolate client data via Supabase RLS
- Examples: `supabase/migrations/001_initial_schema.sql`
- Pattern: `admin_users` have full access via `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`; `client_users` scoped to their `client_id` via subquery on every table. Storage RLS uses folder-name matching against client UUID.

## Entry Points

**Web Application:**
- Location: `app/layout.tsx` (root), `app/page.tsx` (redirect)
- Triggers: Any HTTP request to the application
- Responsibilities: Font loading, theme/tooltip providers, redirect to admin

**Admin Dashboard:**
- Location: `app/admin/page.tsx`
- Triggers: Navigation to `/admin`
- Responsibilities: Renders the operational overview for the consultant (Matt)

**Client Portal:**
- Location: `app/client/page.tsx`
- Triggers: Navigation to `/client`
- Responsibilities: Renders client-facing compliance dashboard

**Proposal Wizard:**
- Location: `app/proposals/new/page.tsx`
- Triggers: Navigation to `/proposals/new`
- Responsibilities: 4-step proposal creation flow (client selection, service catalogue, AI draft, e-sign send)

## Architectural Constraints

- **Next.js 16 breaking changes:** Per `AGENTS.md`, this version has breaking API changes. Must read `node_modules/next/dist/docs/` before writing code. `proxy.ts` must exist, all request APIs must be async, `revalidateTag` signature updated, no `middleware.ts` file allowed.
- **Multi-tenancy via RLS:** All client data access must go through Supabase with RLS enforced. Admin client (`lib/supabase/admin.ts`) must use `server-only` guard to prevent client-side import (per ROADMAP Phase 1 success criteria).
- **No middleware:** Next.js 16 removed `middleware.ts`. Auth guards must use a different pattern (likely `proxy.ts` or Server Component checks).
- **Global state:** No module-level singletons or shared mutable state exist. Each page manages its own state locally.
- **Circular imports:** None detected -- the dependency graph is strictly `app/ -> components/ -> lib/hooks/`.

## Anti-Patterns

### Hardcoded Data in Page Components

**What happens:** All dashboard data (clients, expiries, compliance stats, proposals, reports, billing transactions) is hardcoded as static arrays and inline JSX within page components.
**Why it's wrong:** When the data layer (Supabase) is wired, these pages will need significant refactoring. Data, presentation, and business logic are tangled together.
**Do this instead:** Extract data into Server Components or Server Actions that query Supabase, pass data as props to Client Components that handle interactivity. See planned pattern in `supabase/migrations/001_initial_schema.sql` for the data model.

### Monolithic Page Components

**What happens:** Single page files contain hundreds of lines of JSX with no extraction into sub-components. `app/admin/page.tsx` is 585 lines; `app/proposals/new/page.tsx` is 642 lines.
**Why it's wrong:** Makes pages difficult to test, reuse, and modify. Violates single-responsibility principle.
**Do this instead:** Extract repeated patterns (e.g., client rows, expiry items, stat cards) into named components. Place them in `components/` or co-locate as `_components/` within route directories.

### CSS Duplication Across Portal Zones

**What happens:** Both the admin and client portals define their own color schemes and typography inline via Tailwind classes (e.g., `bg-[#1c1c1c]`, `text-[#3b8273]`, `text-[#888]`). The proposals module uses a separate CSS file (`app/proposals/proposals.css`) with its own design token system.
**Why it's wrong:** Three sets of hardcoded color values make visual consistency updates error-prone.
**Do this instead:** Consolidate shared design tokens into CSS custom properties in `app/globals.css` (already partially done for the shadcn theme). The proposal CSS token system (`--p-gold`, `--p-surface`, etc.) is a good pattern to extend.

## Error Handling

**Strategy:** No error handling implemented (prototype stage)

**Patterns:**
- No try/catch blocks in any component
- No error boundaries defined
- No loading states beyond the proposal wizard's simulated drafting skeleton (`app/proposals/new/page.tsx:459-489`)
- No `error.tsx` or `loading.tsx` files in any route segment

## Cross-Cutting Concerns

**Logging:** None implemented. No logging library configured.
**Validation:** None implemented. Form inputs in the proposal wizard have no validation beyond a basic `canProceed` check on empty org name (`app/proposals/new/page.tsx:168`).
**Authentication:** Not implemented. The schema defines `admin_users` and `client_users` tables with Supabase Auth references (`supabase/migrations/001_initial_schema.sql`), but no auth code exists in the frontend. The client portal hardcodes a user name ("Sarah Whitfield") and the admin dashboard hardcodes "Matt Dineen".
**Theming:** Implemented via next-themes with `class` attribute strategy and "D" hotkey toggle (`components/theme-provider.tsx`). Light/dark CSS variables defined in `app/globals.css`. However, the admin portal forces dark mode via `className="dark"` on its container div (`app/admin/layout.tsx:13`).

---

*Architecture analysis: 2026-04-29*
