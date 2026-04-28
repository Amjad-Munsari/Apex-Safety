# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Runner:**
- No test framework is installed or configured
- No test runner config files exist (`jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*` -- none present)
- No test-related dependencies in `package.json` (no jest, vitest, testing-library, cypress, playwright)

**Assertion Library:**
- None installed

**Run Commands:**
```bash
# No test commands exist. Only these scripts are defined:
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
```

## Test File Organization

**Location:**
- No test files exist anywhere in the repository
- No `__tests__/` directories
- No `*.test.*` or `*.spec.*` files
- `.gitignore` includes `/coverage` entry, suggesting tests were anticipated but not yet set up

**Naming:**
- No convention established yet

**Structure:**
- No test directory structure exists

## Recommended Setup

Given the stack (Next.js 16, React 19, TypeScript, Tailwind), the recommended test setup would be:

**Unit/Component Testing:**
```bash
# Install Vitest + React Testing Library
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

**Config file to create:** `vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
})
```

**Setup file to create:** `vitest.setup.ts`
```typescript
import "@testing-library/jest-dom/vitest"
```

**Add to `package.json` scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Test Structure

**Recommended Suite Organization:**
```typescript
// Co-locate tests: app/admin/page.test.tsx next to app/admin/page.tsx
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import AdminDashboardPage from "./page"

describe("AdminDashboardPage", () => {
  it("renders the greeting", () => {
    render(<AdminDashboardPage />)
    expect(screen.getByText(/Good morning, Matt/)).toBeInTheDocument()
  })
})
```

**Recommended patterns based on codebase structure:**
- Co-locate test files with source files (e.g., `app/admin/page.test.tsx`)
- Place shared test utilities in `lib/test-utils.ts`
- Place fixtures/mock data in `__fixtures__/` directories

## Mocking

**Framework:** Not applicable (no tests exist)

**Recommended approach for this codebase:**
```typescript
// Mock Next.js navigation (used by app/page.tsx, app/client/layout.tsx)
import { vi } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => "/client"),
}))

// Mock next-themes (used by components/theme-provider.tsx)
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}))
```

**What to Mock:**
- `next/navigation` (`redirect`, `usePathname`)
- `next-themes` (`useTheme`, `ThemeProvider`)
- Browser APIs (`window.matchMedia` for `hooks/use-mobile.ts`)
- Future: Supabase client, PayPal SDK, SignWell API

**What NOT to Mock:**
- `cn()` utility -- it's a pure function, test with real implementation
- shadcn UI components -- render them to verify composition
- Static data arrays (`SERVICE_CATEGORIES`, `EXISTING_CLIENTS`, etc.)

## Fixtures and Factories

**Test Data:**
- Currently all mock/demo data is hardcoded in page components
- When tests are added, extract shared data to fixture files:
```typescript
// __fixtures__/clients.ts
export const mockClients = [
  { id: "hallam-house", orgName: "Hallam House Care Home", ... },
]

// __fixtures__/documents.ts
export const mockDocuments = [
  { id: "DOC-1408", title: "Fire Risk Assessment", status: "EXPIRED", ... },
]
```

**Location:**
- Recommended: `__fixtures__/` at project root or co-located within route directories

## Coverage

**Requirements:** None enforced -- no testing infrastructure exists

**View Coverage:**
```bash
# After test framework setup:
npm run test:coverage
# Coverage report goes to /coverage (already in .gitignore)
```

## Test Types

**Unit Tests:**
- Not implemented
- Candidates: `lib/utils.ts` (`cn()` function), helper functions in `app/proposals/new/page.tsx` (`formatPrice`, `formatTotal`)

**Integration Tests:**
- Not implemented
- Candidates: Page-level rendering tests for admin dashboard, client portal pages

**E2E Tests:**
- Not implemented
- No Playwright or Cypress configured
- Candidates: Proposal creation wizard flow (4-step wizard in `app/proposals/new/page.tsx`), client portal navigation

## Priority Testing Targets

When implementing tests, prioritize in this order:

1. **`lib/utils.ts`** -- Pure function, trivial to test, establishes test infrastructure
2. **`app/proposals/new/page.tsx`** -- Most complex component (642 lines, multi-step wizard, computed state). Test `formatPrice()`, `formatTotal()`, step navigation, quantity management
3. **`hooks/use-mobile.ts`** -- Hook with browser API dependency, good for testing mock patterns
4. **`components/theme-provider.tsx`** -- Keyboard shortcut logic (`ThemeHotkey`) needs verification
5. **`app/client/layout.tsx`** -- Navigation highlighting logic based on `usePathname()`
6. **`app/client/compliance/page.tsx`** -- Status badge rendering, data display correctness

## Type Checking as Quality Gate

**Current quality gate:** TypeScript strict mode + ESLint

```bash
npm run build    # Type-checks the entire project (Next.js runs tsc)
npm run lint     # ESLint with Next.js core-web-vitals + TypeScript rules
```

These are the only automated quality checks available. The `build` command serves as the de facto type-safety test.

---

*Testing analysis: 2026-04-29*
