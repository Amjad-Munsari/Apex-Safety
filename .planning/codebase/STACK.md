# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- TypeScript ^5 - All application code (`app/`, `components/`, `hooks/`, `lib/`)

**Secondary:**
- SQL (PL/pgSQL) - Database schema and functions (`supabase/migrations/001_initial_schema.sql`)
- CSS - Custom stylesheets (`app/globals.css`, `app/proposals/proposals.css`)

## Runtime

**Environment:**
- Node.js v22.17.0 (no `.nvmrc` or `.node-version` file pinning the version)

**Package Manager:**
- npm v10.9.2
- Lockfile: `package-lock.json` present (385KB)

## Frameworks

**Core:**
- Next.js 16.2.4 - Full-stack React framework with App Router (`next.config.ts`)
- React 19.2.4 - UI library
- React DOM 19.2.4 - DOM renderer

**UI Component System:**
- shadcn/ui v4.3.1 (base-mira style, RSC-enabled) - Component library (`components.json`)
- Base UI React ^1.4.1 (`@base-ui/react`) - Headless primitive layer used by shadcn components
- Tailwind CSS ^4 - Utility-first styling via PostCSS plugin (`postcss.config.mjs`)

**Build/Dev:**
- PostCSS with `@tailwindcss/postcss` plugin (`postcss.config.mjs`)
- ESLint ^9 with `eslint-config-next` 16.2.4 (`eslint.config.mjs`)
- Prettier with `prettier-plugin-tailwindcss` (`.prettierrc`)

**Testing:**
- Not detected - No test framework, config files, or test files present

## Key Dependencies

**Critical:**
- `next` 16.2.4 - Application framework; AGENTS.md warns of breaking changes vs training data
- `react` 19.2.4 - Uses React 19 features (RSC, `use client` directives)
- `shadcn` ^4.3.1 - Component generator CLI and runtime; configured in `components.json`

**UI/Styling:**
- `class-variance-authority` ^0.7.1 - Component variant management (used in `cva()` calls)
- `clsx` ^2.1.1 - Conditional class composition (used via `cn()` in `lib/utils.ts`)
- `tailwind-merge` ^3.5.0 - Tailwind class conflict resolution (used via `cn()` in `lib/utils.ts`)
- `tw-animate-css` ^1.4.0 - Tailwind animation utilities (imported in `app/globals.css`)
- `lucide-react` ^1.8.0 - Icon library (used throughout components)
- `next-themes` ^0.4.6 - Dark/light theme switching (`components/theme-provider.tsx`)

**Data Visualization:**
- `recharts` ^3.8.0 - Charts (PieChart used in `app/admin/page.tsx`)

**CLI/Interactive:**
- `cmdk` ^1.1.1 - Command palette component (installed, UI component `command.tsx` exists)

## Configuration

**Environment:**
- `.env.local` file present - Contains environment configuration (not read for security)
- `.env*` files are gitignored

**Build:**
- `next.config.ts` - Minimal; empty config object
- `tsconfig.json` - Strict mode, ES2017 target, bundler module resolution, `@/*` path alias pointing to project root
- `postcss.config.mjs` - `@tailwindcss/postcss` plugin only
- `eslint.config.mjs` - Next.js core-web-vitals + TypeScript rules
- `.prettierrc` - No semicolons, double quotes, 2-space tabs, ES5 trailing commas, 80 char width, Tailwind class sorting
- `components.json` - shadcn config: base-mira style, RSC enabled, mist base color, CSS variables, lucide icons

**Path Aliases:**
- `@/*` maps to `./*` (project root) - Use `@/components/...`, `@/lib/...`, `@/hooks/...`

**shadcn Aliases (from `components.json`):**
- `@/components` - General components
- `@/components/ui` - UI primitives (shadcn-managed)
- `@/lib` - Shared utilities
- `@/lib/utils` - `cn()` helper
- `@/hooks` - Custom React hooks

## Platform Requirements

**Development:**
- Node.js >= 22.x
- npm >= 10.x
- Supabase project (MCP configured in `.mcp.json` pointing to `lksxdpgkbiuorjdvebdz`)

**Production:**
- Vercel (`vercel.json` present with `{"framework": "nextjs"}`)
- Supabase (PostgreSQL + Auth + Storage)

**Scripts:**
```bash
npm run dev      # next dev (development server)
npm run build    # next build (production build)
npm run start    # next start (production server)
npm run lint     # eslint
```

## Design System

**Typography (Google Fonts via `next/font`):**
- Inter - Sans-serif body font (`--font-sans`) - `app/layout.tsx`
- Newsreader - Serif display font (`--font-serif`) - `app/layout.tsx`
- JetBrains Mono - Monospace font (`--font-mono`) - `app/layout.tsx`

**Color System:**
- oklch-based CSS custom properties with light/dark variants (`app/globals.css`)
- Custom semantic tokens: `--gold`, `--danger`, `--success`, `--custom-card` (dark mode only currently)
- Chart colors: `--chart-1` through `--chart-5`
- Sidebar-specific tokens: `--sidebar`, `--sidebar-foreground`, etc.

**Theme:**
- Class-based dark mode via `next-themes` (`attribute="class"`)
- Default theme: system preference
- Hotkey: Press `d` to toggle dark/light (when not typing)
- Admin dashboard forced dark via `className="dark"` on wrapper div

---

*Stack analysis: 2026-04-29*
