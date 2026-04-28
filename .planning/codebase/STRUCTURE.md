# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```
fire-safety-platform/
├── app/                        # Next.js App Router (all routes)
│   ├── layout.tsx              # Root layout (fonts, ThemeProvider, TooltipProvider)
│   ├── page.tsx                # Root page (redirects to /admin)
│   ├── globals.css             # Global styles, Tailwind config, CSS variables (light + dark)
│   ├── favicon.ico             # App favicon
│   ├── admin/                  # Admin portal zone (dark theme)
│   │   ├── layout.tsx          # Admin shell: sidebar + top bar + content area
│   │   └── page.tsx            # Admin dashboard ("single pane of glass")
│   ├── client/                 # Client portal zone (light theme)
│   │   ├── layout.tsx          # Client shell: sticky nav + footer (uses "use client")
│   │   ├── page.tsx            # Client dashboard (compliance summary, hours, attention items)
│   │   ├── billing/
│   │   │   └── page.tsx        # Hours balance + transaction history
│   │   ├── compliance/
│   │   │   └── page.tsx        # Document library grouped by compliance category
│   │   └── reports/
│   │       └── page.tsx        # Assessment reports list with download actions
│   └── proposals/              # Proposal wizard zone (dark, standalone layout)
│       ├── layout.tsx          # Thin wrapper importing proposals.css
│       ├── proposals.css       # Self-contained design token system + all proposal styles
│       └── new/
│           └── page.tsx        # 4-step wizard (Client > Services > Draft > Send)
├── components/                 # Shared React components
│   ├── .gitkeep
│   ├── app-sidebar.tsx         # Admin sidebar navigation (Dineen Fire & Safety branding)
│   ├── theme-provider.tsx      # next-themes wrapper with "D" hotkey toggle
│   └── ui/                     # shadcn/ui primitives (base-mira style)
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── chart.tsx
│       ├── command.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input-group.tsx
│       ├── input.tsx
│       ├── progress.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── hooks/                      # Custom React hooks
│   ├── .gitkeep
│   └── use-mobile.ts           # useIsMobile() — media query hook (768px breakpoint)
├── lib/                        # Shared utility functions
│   ├── .gitkeep
│   └── utils.ts                # cn() — clsx + tailwind-merge classname helper
├── public/                     # Static assets
│   ├── .gitkeep
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── supabase/                   # Supabase configuration
│   └── migrations/
│       └── 001_initial_schema.sql  # Full DB schema: 12 tables, RLS, indexes, storage buckets
├── .planning/                  # Project planning documents (not deployed)
│   ├── PROJECT.md
│   ├── REQUIREMENTS.md
│   ├── ROADMAP.md
│   ├── STATE.md
│   ├── config.json
│   ├── codebase/               # Architecture analysis docs (this directory)
│   └── research/               # Research outputs
│       ├── ARCHITECTURE.md
│       ├── FEATURES.md
│       ├── PITFALLS.md
│       ├── STACK.md
│       └── SUMMARY.md
├── .claude/                    # Claude Code configuration
│   └── settings.local.json
├── AGENTS.md                   # Next.js 16 breaking changes warning
├── CLAUDE.md                   # Points to AGENTS.md
├── README.md                   # Project readme
├── package.json                # Dependencies and scripts
├── package-lock.json           # Lockfile
├── tsconfig.json               # TypeScript config (paths: @/* -> ./*)
├── next.config.ts              # Next.js config (empty)
├── eslint.config.mjs           # ESLint config
├── postcss.config.mjs          # PostCSS config (Tailwind)
├── components.json             # shadcn/ui config (base-mira, lucide icons, @/ aliases)
├── vercel.json                 # Vercel deploy config (framework: nextjs)
├── .prettierrc                 # Prettier config
├── .prettierignore             # Prettier ignore rules
├── .gitignore                  # Git ignore rules
├── .mcp.json                   # MCP server config
├── .env.local                  # Environment variables (exists, not read)
└── next-env.d.ts               # Next.js type declarations (generated)
```

## Directory Purposes

**`app/`:**
- Purpose: All routes, layouts, and pages for the Next.js App Router
- Contains: Route segments organized by portal zone (`admin/`, `client/`, `proposals/`)
- Key files: `layout.tsx` (root), `globals.css` (theme variables), `page.tsx` (root redirect)

**`app/admin/`:**
- Purpose: Admin-facing dashboard for the fire safety consultant (Matt)
- Contains: Layout with sidebar/top-bar chrome, dashboard page with hardcoded data
- Key files: `layout.tsx` (dark theme shell), `page.tsx` (585-line dashboard)

**`app/client/`:**
- Purpose: Client-facing compliance portal
- Contains: Layout with light theme nav, sub-routes for dashboard/compliance/reports/billing
- Key files: `layout.tsx` (client chrome), `page.tsx` (client dashboard), `compliance/page.tsx`, `reports/page.tsx`, `billing/page.tsx`

**`app/proposals/`:**
- Purpose: Standalone proposal generation wizard for admin use
- Contains: Multi-step form with service catalogue, AI draft preview, e-signature send
- Key files: `new/page.tsx` (642-line wizard), `proposals.css` (1240-line design token system)

**`components/`:**
- Purpose: Shared React components used across all portal zones
- Contains: App-level components (sidebar, theme provider) and shadcn/ui primitives
- Key files: `app-sidebar.tsx`, `theme-provider.tsx`

**`components/ui/`:**
- Purpose: shadcn/ui design system primitives (base-mira style variant)
- Contains: 17 pre-built UI components generated via shadcn CLI
- Key files: `button.tsx`, `card.tsx`, `sidebar.tsx`, `dropdown-menu.tsx`

**`hooks/`:**
- Purpose: Custom React hooks shared across the app
- Contains: Mobile detection hook
- Key files: `use-mobile.ts`

**`lib/`:**
- Purpose: Shared utility functions
- Contains: Classname merge helper
- Key files: `utils.ts`

**`supabase/`:**
- Purpose: Database schema and migration files for the Supabase backend
- Contains: SQL migrations defining tables, RLS policies, indexes, storage buckets
- Key files: `migrations/001_initial_schema.sql` (484 lines)

**`.planning/`:**
- Purpose: Project planning, requirements, and research documents
- Contains: Requirements spec, 11-phase roadmap, project state, research outputs
- Key files: `ROADMAP.md` (388 lines), `REQUIREMENTS.md`, `STATE.md`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout -- fonts, providers, HTML shell
- `app/page.tsx`: Root page -- redirects to `/admin`
- `app/admin/page.tsx`: Admin dashboard entry point
- `app/client/page.tsx`: Client portal entry point
- `app/proposals/new/page.tsx`: Proposal wizard entry point

**Configuration:**
- `package.json`: Dependencies, scripts (`dev`, `build`, `start`, `lint`)
- `tsconfig.json`: TypeScript compiler config, path alias `@/*` -> `./*`
- `next.config.ts`: Next.js config (currently empty)
- `components.json`: shadcn/ui config (base-mira style, lucide icons, alias mappings)
- `postcss.config.mjs`: PostCSS with Tailwind plugin
- `.prettierrc`: Prettier formatting rules
- `eslint.config.mjs`: ESLint config
- `.env.local`: Environment variables (existence noted, not read)

**Core Logic:**
- `lib/utils.ts`: `cn()` function -- classname merge using clsx + tailwind-merge
- `hooks/use-mobile.ts`: `useIsMobile()` hook -- media query for 768px breakpoint
- `components/theme-provider.tsx`: Theme switching with next-themes + "D" hotkey

**Database:**
- `supabase/migrations/001_initial_schema.sql`: Complete schema with 12 tables, comprehensive RLS policies, 12 indexes, 5 storage buckets, `credit_hours_from_paypal()` function

**Styling:**
- `app/globals.css`: Global Tailwind imports, CSS custom properties for light/dark themes, shadcn token mapping
- `app/proposals/proposals.css`: Self-contained design token system (`--p-*` variables) and all proposal wizard styles

**Testing:**
- No test files exist. No test framework is configured.

## Naming Conventions

**Files:**
- Route pages: `page.tsx` (Next.js App Router convention)
- Route layouts: `layout.tsx` (Next.js App Router convention)
- Components: `kebab-case.tsx` (e.g., `app-sidebar.tsx`, `theme-provider.tsx`, `dropdown-menu.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-mobile.ts`)
- Utilities: `kebab-case.ts` (e.g., `utils.ts`)
- CSS: `kebab-case.css` (e.g., `globals.css`, `proposals.css`)
- SQL migrations: `NNN_description.sql` (e.g., `001_initial_schema.sql`)

**Directories:**
- Route segments: `kebab-case` (e.g., `admin/`, `client/`, `proposals/`)
- Feature groups: `kebab-case` (e.g., `billing/`, `compliance/`, `reports/`)
- Component categories: `kebab-case` (e.g., `ui/`)

**Exports:**
- Components: PascalCase named exports (e.g., `export function AppSidebar()`, `export function ThemeProvider()`)
- Pages: `export default function` with PascalCase name (e.g., `AdminDashboardPage`, `ClientDashboard`, `BillingPage`)
- Hooks: camelCase named exports (e.g., `export function useIsMobile()`)
- Utilities: camelCase named exports (e.g., `export function cn()`)

**CSS classes (proposals module):**
- BEM-like with `prop-` prefix: `prop-shell`, `prop-header`, `prop-step-wrapper`, `prop-btn-primary`

## Where to Add New Code

**New Page / Route:**
- Place in appropriate portal zone: `app/admin/[feature]/page.tsx`, `app/client/[feature]/page.tsx`
- Create a `layout.tsx` in the route segment only if the page needs unique chrome
- Mark as `"use client"` if the page needs interactivity (most pages will)

**New Shared Component:**
- Application-level component: `components/[component-name].tsx`
- If only used within one portal zone, consider co-locating in the route directory or using a `_components/` convention

**New shadcn/ui Primitive:**
- Run `npx shadcn@latest add [component]` -- it will place in `components/ui/`
- Do not manually create files in `components/ui/` -- use the CLI

**New Custom Hook:**
- Place in `hooks/use-[name].ts`
- Export as named function: `export function use[Name]()`

**New Utility Function:**
- Add to `lib/utils.ts` for small utilities
- Create `lib/[domain].ts` for domain-specific utilities (e.g., `lib/supabase.ts`, `lib/formatting.ts`)

**New Supabase Migration:**
- Place in `supabase/migrations/NNN_description.sql` (increment the number)
- Follow existing patterns: tables first, then RLS policies, then indexes

**New API Route / Server Action:**
- API routes: `app/api/[endpoint]/route.ts` (directory does not exist yet -- create as needed)
- Server Actions: co-locate with the Server Component that uses them, or place in `lib/actions/[domain].ts`

**Supabase Client Setup (not yet created):**
- Server-side client: `lib/supabase/server.ts` (must use `server-only` guard)
- Admin/service-role client: `lib/supabase/admin.ts` (must use `server-only` guard)
- Client-side client: `lib/supabase/client.ts`

**Tests (not yet created):**
- Co-locate with source: `[file].test.ts` or `[file].test.tsx`
- Or use a `__tests__/` directory within each feature directory

## Special Directories

**`.planning/`:**
- Purpose: Project management, requirements, roadmap, research -- not application code
- Generated: No (manually authored)
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output and dev server cache
- Generated: Yes (by `next dev` and `next build`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in `.gitignore`)

**`public/`:**
- Purpose: Static assets served at root URL path
- Generated: No
- Committed: Yes
- Note: Contains default Next.js SVGs; will need 888 Safety branding assets

**`supabase/migrations/`:**
- Purpose: Database schema versioning -- applied to Supabase via CLI
- Generated: No (manually authored)
- Committed: Yes

---

*Structure analysis: 2026-04-29*
