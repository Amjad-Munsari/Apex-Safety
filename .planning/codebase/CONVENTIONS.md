# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- Page components: `page.tsx` (Next.js App Router convention)
- Layout components: `layout.tsx` (Next.js App Router convention)
- UI primitives: `kebab-case.tsx` in `components/ui/` (e.g., `dropdown-menu.tsx`, `input-group.tsx`)
- Custom components: `kebab-case.tsx` in `components/` (e.g., `app-sidebar.tsx`, `theme-provider.tsx`)
- Hooks: `use-kebab-case.ts` in `hooks/` (e.g., `use-mobile.ts`)
- Utilities: `kebab-case.ts` in `lib/` (e.g., `utils.ts`)
- CSS modules: `kebab-case.css` co-located with route (e.g., `app/proposals/proposals.css`)
- SQL migrations: `NNN_snake_case.sql` in `supabase/migrations/` (e.g., `001_initial_schema.sql`)

**Functions & Components:**
- React components: `PascalCase` (e.g., `AppSidebar`, `ThemeProvider`, `AdminDashboardPage`)
- Page default exports: `PascalCase` function name (e.g., `export default function AdminDashboardPage()`)
- Hooks: `camelCase` prefixed with `use` (e.g., `useIsMobile`)
- Helper functions: `camelCase` (e.g., `formatPrice`, `formatTotal`, `updateQty`, `selectClient`, `isTypingTarget`)
- Event handlers: `onVerbNoun` or inline lambdas (e.g., `onChange`, `onKeyDown`, `onClick={() => setStep(2)}`)

**Variables:**
- State variables: `camelCase` (e.g., `clientTab`, `isDrafting`, `lineItems`)
- Constants: `UPPER_SNAKE_CASE` for data arrays (e.g., `SERVICE_CATEGORIES`, `EXISTING_CLIENTS`, `STEPS`, `MOBILE_BREAKPOINT`)
- CSS custom properties: `--kebab-case` (e.g., `--font-serif`, `--color-background`)

**Types & Interfaces:**
- Interfaces: `PascalCase` (e.g., `Service`, `Category`, `Client`, `Document`, `Report`, `Transaction`)
- No `I` prefix on interfaces
- Type imports use `import type { ... }` syntax (e.g., `import type { Metadata } from "next"`)

## Code Style

**Formatting:**
- Tool: Prettier
- Config: `.prettierrc`
- Key settings:
  - `semi: false` -- no semicolons
  - `singleQuote: false` -- double quotes for strings
  - `tabWidth: 2` -- 2-space indentation
  - `trailingComma: "es5"` -- trailing commas in arrays/objects
  - `printWidth: 80` -- 80 char line width
  - `endOfLine: "lf"` -- Unix line endings
- Tailwind plugin: `prettier-plugin-tailwindcss` auto-sorts Tailwind classes
- Tailwind functions: `cn` and `cva` are configured for class sorting

**Linting:**
- Tool: ESLint v9 (flat config)
- Config: `eslint.config.mjs`
- Presets: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Run: `npm run lint`
- No custom rules beyond the Next.js defaults

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Target: ES2017
- Module resolution: `bundler`
- JSX: `react-jsx`
- No emit (`noEmit: true`) -- Next.js handles compilation
- Isolated modules enabled

## Import Organization

**Order:**
1. React and framework imports (`import * as React from "react"`, `import { redirect } from "next/navigation"`)
2. Third-party library imports (`import { cva } from "class-variance-authority"`, `import { PieChart } from "recharts"`)
3. Internal aliases using `@/` path prefix (`import { cn } from "@/lib/utils"`, `import { Button } from "@/components/ui/button"`)
4. Relative imports for co-located files (`import './globals.css'`, `import './proposals.css'`)

**Path Aliases:**
- `@/*` maps to project root (`./`) -- configured in `tsconfig.json`
- shadcn component aliases defined in `components.json`:
  - `@/components` -- all components
  - `@/components/ui` -- UI primitives
  - `@/lib` -- utility functions
  - `@/lib/utils` -- the `cn()` helper specifically
  - `@/hooks` -- custom hooks

**Import Style:**
- Named imports preferred: `import { Button } from "@/components/ui/button"`
- Namespace imports for React: `import * as React from "react"`
- Type-only imports: `import type { Metadata } from "next"`
- Destructured multi-imports across lines for Lucide icons:
```typescript
import { 
  ChevronRight, 
  FileText, 
  AlertCircle, 
  ArrowRight 
} from "lucide-react";
```

## Component Patterns

**Client Components:**
- Mark with `"use client"` directive at the top of the file
- Used for: interactive pages with state, event handlers, browser APIs
- Examples: `app/admin/page.tsx`, `app/client/layout.tsx`, `app/client/page.tsx`, `components/theme-provider.tsx`

**Server Components:**
- Default (no directive needed)
- Used for: layouts with no interactivity, redirect-only pages
- Examples: `app/layout.tsx`, `app/admin/layout.tsx`, `app/proposals/layout.tsx`, `app/page.tsx`

**UI Primitive Pattern (shadcn/ui with base-ui):**
- Use `@base-ui/react` primitives as the underlying component
- Wrap with `cva()` for variant-based styling
- Export both the component and its variants: `export { Button, buttonVariants }`
- Use `data-slot` attributes for CSS targeting
- Use `cn()` utility from `@/lib/utils` for merging classes
- Pattern example from `components/ui/button.tsx`:
```typescript
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("base-classes", {
  variants: { variant: {}, size: {} },
  defaultVariants: { variant: "default", size: "default" },
})

function Button({ className, variant, size, ...props }: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
```

**Page Component Pattern:**
- Single default export function per page
- All data currently hardcoded as constants or inline arrays (no API calls yet)
- Interfaces defined at top of file, above the data constants
- Render logic returned directly (no separate render functions)

## Styling Conventions

**Framework:** Tailwind CSS v4 with CSS variables

**Class Merging:**
- Always use `cn()` from `@/lib/utils` for conditional/merged classes
- `cn()` combines `clsx` + `tailwind-merge`
- Pattern: `className={cn("base-classes", conditional && "extra-classes", className)}`

**Design Tokens:**
- Defined as CSS custom properties in `app/globals.css`
- Use oklch color space for all theme colors
- Dark mode: `.dark` class on parent element + `@custom-variant dark (&:is(.dark *))` in Tailwind
- Semantic color names: `--primary`, `--destructive`, `--muted`, `--accent`, `--gold`, `--danger`, `--success`
- Design radius: `--radius: 0.625rem` with computed variants (`--radius-sm`, `--radius-md`, etc.)

**Typography System:**
- Three font families configured via CSS variables:
  - `--font-sans` (Inter) -- body text, UI labels
  - `--font-serif` (Newsreader) -- headings, large numbers, display text
  - `--font-mono` (JetBrains Mono) -- labels, IDs, metadata, timestamps

**Admin Portal (Dark Theme):**
- Force dark: `className="dark"` on wrapper div in `app/admin/layout.tsx`
- Background: `bg-background` / `bg-[#1c1c1c]` for cards
- Text: white with opacity variants (`text-white`, `text-white/50`, `text-white/40`)
- Borders: `border-white/5`, `border-white/10`
- Cards: `bg-[#1c1c1c] border-white/5 rounded-sm`

**Client Portal (Light Theme):**
- Background: `bg-[#fbfaf5]` (warm cream)
- Cards: `bg-white border border-[#e5e1d8] rounded-sm shadow-sm`
- Text: `text-[#1a1a1a]` primary, `text-[#999]` / `text-[#bbb]` for muted
- Status colors inline: `text-[#3b8273]` (green/current), `text-[#c0a66d]` (gold/expiring), `text-[#8b2b21]` (red/expired)

**Proposals Module:**
- Separate CSS file (`app/proposals/proposals.css`) with BEM-like class names prefixed with `prop-`
- Has its own design tokens (CSS custom properties) scoped under `:root`
- Does NOT use Tailwind classes -- uses plain CSS exclusively
- Example classes: `.prop-shell`, `.prop-header`, `.prop-stepper`, `.prop-btn-primary`

**Spacing & Sizing Conventions:**
- Use Tailwind utility classes, not inline styles (except in proposals module)
- Pixel-precise font sizes: `text-[10px]`, `text-[11px]`, `text-[9px]` -- many non-standard sizes
- Letter spacing via tracking utilities: `tracking-wide`, `tracking-widest`, `tracking-[0.2em]`, `tracking-[0.25em]`
- Section numbering pattern: monospace numbers like `01`, `02` used as visual hierarchy markers

## Data Patterns

**Static Data:**
- All page data is currently hardcoded as TypeScript constants
- Define interfaces for data shapes at file top
- Use `const` arrays with typed items
- Example pattern from `app/proposals/new/page.tsx`:
```typescript
interface Service { id: string; name: string; price: number; unit: string }
interface Category { id: string; number: string; title: string; services: Service[] }
const SERVICE_CATEGORIES: Category[] = [ /* ... */ ]
```

**Status/RAG Enums:**
- Use string literal union types: `"CURRENT" | "EXPIRING" | "EXPIRED"`
- Status-to-color mapping done inline with conditional classNames using `cn()`
- No shared status constants or color mapping utilities yet

## Error Handling

**Patterns:**
- No error boundaries implemented
- No try/catch blocks in current code
- No error states in UI components
- `alert()` used for user feedback in proposals send step (placeholder)
- This is expected -- the codebase is in early prototype/UI-only stage with no API integration

## Logging

**Framework:** None configured

**Patterns:**
- No logging statements in codebase
- No structured logging library installed
- Console logging not used in current code

## Comments

**When to Comment:**
- Section dividers use styled comment blocks in TSX:
  - `{/* --- SECTION NAME --- */}` for major page sections
  - ASCII art dividers in CSS: `/* ============ SECTION ============ */`
- Interface fields are not documented with JSDoc
- No inline code comments explaining logic

**JSDoc/TSDoc:**
- Not used anywhere in the codebase

## Function Design

**Size:**
- Page components can be large (585 lines in `app/admin/page.tsx`, 642 lines in `app/proposals/new/page.tsx`)
- Helper functions are kept small (3-6 lines)
- No extraction of sub-components from page files yet

**Parameters:**
- Component props use destructuring: `{ className, variant, size, ...props }`
- State setter functions use functional updates: `setQuantities(prev => ({ ...prev, [id]: next }))`
- Children prop typed as `React.ReactNode` or `Readonly<{ children: React.ReactNode }>`

**Return Values:**
- Components return JSX directly
- Helper functions return primitives (string, number, boolean)
- Hooks return primitives (`useIsMobile` returns `boolean`)

## Module Design

**Exports:**
- Page components: single `export default function`
- UI components: named exports (e.g., `export { Button, buttonVariants }`)
- Utilities: named exports (e.g., `export function cn(...)`)
- Hooks: named exports (e.g., `export function useIsMobile()`)

**Barrel Files:**
- Not used -- each component imported directly from its file path

**`"use client"` Directive:**
- Place at the very first line of the file (before any imports)
- Use double quotes: `"use client"`
- Required on: pages with `useState`/`useEffect`, components using browser APIs, layouts with `usePathname`

---

*Convention analysis: 2026-04-29*
