# Stack Research

**Domain:** UK Health & Safety SaaS (compliance portal + mobile-first assessment forms + AI report generation + proposal/contract pipeline)
**Researched:** 2026-04-15
**Confidence:** HIGH — all versions verified against official docs, npm registry, and Context7 as of April 2026

---

## Locked Stack (Do Not Re-Select)

These are non-negotiable. Treat as constraints, not decisions.

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.7 (scaffold delivered) | Full-stack React framework, App Router |
| React | 19.2 | UI library (ships with Next 16) |
| Tailwind CSS | 4 | Utility-first styling |
| Supabase | hosted (Postgres + Auth + Storage + RLS) | Database, auth, file storage, multi-tenant |
| Vercel | latest | Hosting, cron, edge |
| n8n | self-hosted or cloud | 4 Phase-1 workflow automations |
| OpenAI GPT-4 | via OpenRouter | AI report + proposal generation |
| PayPal Orders API | v2 | Payments (NOT Stripe) |
| Twilio | SMS API | Document upload notifications |
| Web Speech API | browser-native | STT on assessment forms (text fallback) |
| @coltorapps/builder | v0.2.4 | Phase 2 form builder (MIT, zero deps) |
| SignWell | REST API | E-signature (default, pending Matt confirmation) |

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.7 | App Router full-stack framework | Locked. Note: `middleware.ts` is deprecated in v16 — rename to `proxy.ts`. Node.js 20.9+ required. |
| React | 19.2 | UI + Server Components | Ships with Next 16. Use async Server Components for data fetching; use Client Components only where interactivity needed (STT, forms, signature pad). |
| Tailwind CSS | 4.x | Styling | Locked. v4 is a breaking rewrite — CSS-first config, no `tailwind.config.js` by default. Use `@config` directive if you need JS config. |
| TypeScript | 5.x (min 5.1) | Type safety | Required by Next 16. Generate Supabase types with `supabase gen types` to get full DB type safety across the whole stack. |

### Supabase Ecosystem

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@supabase/supabase-js` | 2.103.0 | Main Supabase client | Current stable. Use for all DB queries, Realtime subscriptions, Storage operations. |
| `@supabase/ssr` | 0.10.2 | Server-side Supabase client for Next.js | Use `createServerClient` from this package for Server Components, Route Handlers, and proxy (middleware). Do NOT use `@supabase/auth-helpers-nextjs` — deprecated for App Router. |

**Anti-choice:** Do NOT use `@supabase/auth-helpers-nextjs`. It predates the SSR package, is not maintained for App Router, and will conflict. `@supabase/ssr` is the current official approach.

**Pattern:** Three client instantiations are required:
1. `createServerClient` in `proxy.ts` (formerly `middleware.ts`) — handles token refresh on every request
2. `createServerClient` in Server Components / Route Handlers — read-only cookies
3. `createBrowserClient` in Client Components — browser-only

### Forms & Validation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-hook-form` | 7.66.0 | Form state management | Performant, uncontrolled inputs by default — critical for tablet assessment forms with 30+ fields. Integrates cleanly with Server Actions via `handleSubmit`. |
| `@hookform/resolvers` | 5.2.2+ | Schema validation bridge | v5.0+ supports Zod v4 and v3. Use `zodResolver`. |
| `zod` | 4.0.1 | Schema validation + TypeScript inference | v4 is stable as of mid-2025. Use `import { z } from 'zod'` (not `'zod/v3'`). Validates form schemas, API payloads, Supabase insert shapes. |

**Known issue:** Use `@hookform/resolvers` 5.2.2 or later — v5.2.0 had TypeScript type errors with Zod v4 that were patched in point releases.

**Anti-choice:** Do NOT add `zod` v3 as a separate install alongside v4. `zod` v4 ships `zod/v3` as a subpath for library authors who need dual compatibility — end-user apps should use v4 directly.

### PDF Generation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@react-pdf/renderer` | 4.4.1 | Server-side branded PDF generation | Renders React component trees to PDF buffers. Used in Route Handlers for report generation. React 19 support since v4.1.0. |

**Usage pattern:** PDF generation for reports lives in n8n (per ADR 2026-04-15). `@react-pdf/renderer` is needed for the **proposal PDF** generated code-side (D8). For the AI report PDF (D3), n8n handles it — no need to add `@react-pdf/renderer` to the n8n route.

**Next.js caveat:** `PDFDownloadLink` component cannot render server-side. Use `renderToBuffer` in Route Handlers for server-generated PDFs. If you use the viewer component client-side, wrap with `dynamic(() => import(...), { ssr: false })`.

**Anti-choice:** Do NOT use `jsPDF` — it is canvas-based and cannot reproduce branded layouts with custom fonts and precise positioning. `@react-pdf/renderer` gives you React component declarative layout with font embedding.

### Signature Canvas (in-form signature capture)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `signature_pad` | 5.1.3 | Bare canvas signature capture | The upstream library. Well-maintained (4 months old), TypeScript types included. |
| `react-signature-pad-wrapper` | 4.3.2 | React wrapper around `signature_pad` | Latest, published 1 month ago, implements the same interface as `signature_pad` directly. More actively maintained than `react-signature-canvas` (which is on `1.1.0-alpha.2` stale). |

**Anti-choice:** Do NOT use `react-signature-canvas` — it is on `1.1.0-alpha.2`, last published a year ago, with stale upstream sync. Use `react-signature-pad-wrapper` instead as the React wrapper.

**Note:** For Phase 1, SignWell handles the legally-binding e-signature flow (D8 proposals/contracts). The `signature_pad` integration is for in-form signature fields on assessment forms (e.g., "inspector's signature" at the bottom of an FRA).

### Image Compression (Client-Side Pre-Upload)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `browser-image-compression` | 2.0.2 | Client-side image compression before Supabase upload | WebWorker-based, configurable `maxSizeMB`. Set to 1.2–1.5MB max per PROJECT.md constraint (NOT 800KB — destroys fusebox photo legibility). |

**Configuration:**
```typescript
const options = {
  maxSizeMB: 1.4,         // 1.2–1.5MB range per spec
  maxWidthOrHeight: 3000, // preserve resolution
  useWebWorker: true,     // non-blocking on tablet
};
```

**Note:** `browser-image-compression` 2.0.2 is the current version (last published ~2 years ago but stable and actively used by 25K+ projects). No newer competitor matches its API ergonomics for this use case.

### Payments (PayPal)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@paypal/react-paypal-js` | 9.1.1 | PayPal checkout UI components + SDK loader | Official PayPal React package. v9 introduces V6 SDK with hooks-based API (`PayPalProvider`, `usePayPalScriptReducer`). Orders v2 API compatible. |

**Pattern for D5:** The checkout button is a Client Component. Order creation and capture happen via Route Handlers (server-side) for security. The client component calls your Route Handler which calls PayPal's Orders v2 REST API. The PayPal webhook (order completed) hits a Route Handler for idempotent credit ledger update — Route Handler, not n8n, per ADR.

**Anti-choice:** Do NOT call the PayPal REST API directly from a Client Component. API credentials must stay server-side. Always proxy through a Route Handler.

### AI / OpenRouter

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@openrouter/ai-sdk-provider` | 2.5.1 | OpenRouter provider for Vercel AI SDK | Official OpenRouter Vercel AI SDK provider. Published 2 days ago (highly active). Gives access to GPT-4 and 300+ models via OpenRouter. |
| `ai` (Vercel AI SDK) | latest | Streaming, structured output, tool calling | Pairs with `@openrouter/ai-sdk-provider`. Handles streaming responses in Route Handlers cleanly. |

**Note:** OpenRouter is API-compatible with the OpenAI SDK (same base URL swap pattern), but using `@openrouter/ai-sdk-provider` + Vercel AI SDK is the recommended approach for Next.js because it gives type-safe structured output and streaming built in.

**Architecture reminder:** Per ADR 2026-04-15, report generation (D3) and contract generation (D8) live entirely in n8n. The `@openrouter/ai-sdk-provider` is only needed if any AI inference happens code-side (e.g., proposal drafting triggered by a Route Handler that doesn't go through n8n). Review whether Phase 1 needs it at all before installing.

### SMS (Twilio)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `twilio` | 5.13.1 | Twilio Node.js helper library | Official SDK. TypeScript support built-in. Used in Route Handlers for document upload SMS (D6). n8n handles the email leg of D6; code handles the SMS leg per ADR split. |

**Pattern:**
```typescript
// In a Route Handler (NOT in an n8n-triggered flow)
import { Twilio } from 'twilio';
const client = new Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
await client.messages.create({ body, from, to });
```

**Anti-choice:** Do NOT instantiate the Twilio client in Client Components. The `twilio` package is a Node.js SDK — it must run in Route Handlers or Server Actions only.

### Dates & Recurrence

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `date-fns` | 4.1.0 | Date formatting, arithmetic, UK locale | ESM-only in v4, 100% TypeScript, modular (tree-shakeable). Preferred for simple date ops. |
| `date-fns-tz` | latest | UK timezone (`Europe/London`) handling | Companion to `date-fns` for IANA timezone-aware operations. Required for the 8am UK cron window (D7) — BST vs GMT changes twice yearly. |
| `rrule` | latest (2.x) | Recurrence rule generation for Phase 2 scheduler | RFC 5545 compliant, TypeScript support, handles daily/weekly/monthly/quarterly/annual patterns needed for Phase 2 form scheduling. |

**Note for D7 expiry cron:** The n8n cron fires at 8am UK time. The `date-fns-tz` timezone logic lives in the n8n workflow, not in code. Code-side date handling is mostly for display and portal badge logic.

**Anti-choice:** Do NOT use `moment.js` — deprecated, massive bundle, not tree-shakeable. Do NOT use `luxon` unless you specifically need the Intl-based API surface; `date-fns` + `date-fns-tz` covers this project's needs with less bundle overhead.

### E-Signature (SignWell)

| Approach | Version | Purpose | Why |
|----------|---------|---------|-----|
| SignWell REST API (direct fetch) | REST API v1 | Send documents for signature, retrieve signed PDFs | No official npm package. Use fetch/axios against `https://www.signwellapp.com/api/v1/`. |
| `react-signwell-library` (optional) | community | Embedded signing iframe | Community package for embedded signing flow if Matt wants in-app signing rather than email-based. Evaluate at D8 build time. |

**Note:** SignWell has no official npm SDK. Integration is REST-based: POST a document, get back a signing URL, embed or email it. The signed document webhook hits a Route Handler which stores the completed PDF in Supabase Storage. If Matt specifies a different e-sign provider, this changes — pending open question.

---

## Supporting Libraries

### State Management (Client-Side)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React `useState`/`useReducer` | built-in | Local UI state | Default — use for form wizard steps, STT active state, image preview, etc. |
| `zustand` | 5.x | Global client state | Only if state needs to be shared across unrelated component trees without prop drilling. E.g., multi-step assessment wizard where form state persists across tabs. |

**Anti-choice:** Do NOT add Redux or Jotai. Zustand is sufficient and much simpler. For server state, use React Server Components + `revalidatePath`/`updateTag` rather than client-side fetch caches.

### Testing

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `vitest` | 4.x (or 3.2.4) | Unit + integration testing | Native ESM, 10-20x faster than Jest, no Babel config needed, TypeScript out of the box. Next.js 16 official docs recommend Vitest over Jest. |
| `@vitejs/plugin-react` | latest | React transform for Vitest | Required for JSX transform in Vitest. |
| `@testing-library/react` | latest | Component testing utilities | Standard React testing library, pairs with Vitest. |
| `@testing-library/user-event` | latest | Simulated user interactions | Better than `fireEvent` for realistic interaction testing. |
| `jsdom` | latest | DOM environment for Vitest | Test environment for component tests. |
| `vite-tsconfig-paths` | latest | Respect tsconfig path aliases in tests | Prevents broken imports in Vitest when using `@/` aliases. |
| `playwright` | 1.51+ | E2E testing | Cross-browser E2E. Async Server Components cannot be unit-tested in Vitest — use Playwright for any Server Component behaviour that must be verified. |

**Anti-choice:** Do NOT use Jest with Next.js 16. Jest requires `jest-environment-jsdom`, `ts-jest` or `babel-jest` config, and has known ESM issues with Next.js 16's module resolution. Vitest handles ESM natively and starts in milliseconds.

**Note on Server Components:** Vitest currently cannot unit-test async Server Components directly. Write unit tests for pure utility functions and Client Components; rely on Playwright E2E for flows that involve Server Components, middleware/proxy, or Route Handlers.

**Vitest config for Next.js 16:**
```typescript
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

### Observability

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@sentry/nextjs` | 10.48.0 | Error tracking + performance monitoring | First-class Next.js 16 App Router support including Server Components, `onRequestError` hook for proxy errors. Auto-instruments via `withSentryConfig` wrapper. |
| `@vercel/analytics` | 2.x | Page view analytics | Free on Vercel, zero config. Add `<Analytics />` to root layout. |
| `@logtail/next` | 0.3.1 | Structured logging to Better Stack | Better than `console.log` for server logs in production. Vercel integrates natively with Better Stack. |

**Sentry setup for Next.js 16 (`instrumentation.ts`):**
```typescript
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
```

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `supabase` CLI | Type generation, local dev, migrations | Run `supabase gen types typescript --project-id <id> > types/supabase.ts` at every schema change. |
| `@next/codemod` | Automated upgrades | `npx @next/codemod@canary upgrade latest` for future Next.js upgrades. Already used for 14→16 migration. |
| TypeScript `strict` mode | Catch null/undefined bugs | Set `"strict": true` in `tsconfig.json`. With Supabase generated types, this catches RLS column mismatches at compile time. |
| ESLint Flat Config | Linting | Next.js 16 defaults to ESLint Flat Config (`eslint.config.js`). `next lint` command removed — run `eslint .` directly. |

---

## Installation

```bash
# Core Supabase
npm install @supabase/supabase-js @supabase/ssr

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# PDF Generation
npm install @react-pdf/renderer

# Signature Canvas
npm install signature_pad react-signature-pad-wrapper

# Image Compression
npm install browser-image-compression

# PayPal
npm install @paypal/react-paypal-js

# AI / OpenRouter
npm install @openrouter/ai-sdk-provider ai

# Twilio
npm install twilio

# Dates
npm install date-fns date-fns-tz rrule

# Observability
npm install @sentry/nextjs @vercel/analytics @logtail/next

# Dev dependencies
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths playwright @playwright/test
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Deprecated, not maintained for App Router |
| `vitest` | Jest | ESM issues with Next.js 16, Babel config overhead, 10-20x slower cold start |
| `react-hook-form` | Formik | Formik uses controlled components → re-renders on every keystroke → poor UX on 30-field tablet forms |
| `@react-pdf/renderer` | `jsPDF` | jsPDF is canvas-based, cannot do custom fonts + branded layouts declaratively |
| `react-signature-pad-wrapper` | `react-signature-canvas` | `react-signature-canvas` is on stale alpha; `react-signature-pad-wrapper` is actively maintained |
| `date-fns` + `date-fns-tz` | Luxon | Both work; `date-fns` is more tree-shakeable and aligns with existing community patterns for this stack |
| `@openrouter/ai-sdk-provider` | OpenAI SDK direct | OpenRouter provider + Vercel AI SDK gives streaming, structured output, and model switching without code changes |
| `@sentry/nextjs` | Axiom / Datadog | Sentry has deepest Next.js 16 App Router integration; `onRequestError` hook captures Server Component errors automatically |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated for App Router, causes cookie handling bugs in Next.js 16 | `@supabase/ssr` with `createServerClient` |
| `middleware.ts` (filename) | Deprecated in Next.js 16, will be removed in a future version | `proxy.ts` with exported `proxy` function |
| `serverRuntimeConfig` / `publicRuntimeConfig` | Removed in Next.js 16 | `.env.local` + `NEXT_PUBLIC_` prefix |
| `experimental.ppr` flag | Removed in Next.js 16 (replaced by `cacheComponents`) | `cacheComponents: true` in `next.config.ts` |
| `experimental.turbopack` in config | Moved to top-level `turbopack` in Next.js 16 | Top-level `turbopack: {}` in `next.config.ts` |
| `next lint` CLI command | Removed in Next.js 16 | `eslint .` directly |
| `images.domains` config | Deprecated in Next.js 16 | `images.remotePatterns` |
| `revalidateTag('tag')` (single arg) | Deprecated in Next.js 16; TypeScript error | `revalidateTag('tag', 'max')` or `updateTag('tag')` in Server Actions |
| `unstable_cacheLife` / `unstable_cacheTag` | Stabilized in Next.js 16 | Import as `cacheLife`, `cacheTag` from `next/cache` |
| `next/legacy/image` | Deprecated in Next.js 16 | `next/image` |
| Jest | ESM conflicts with Next.js 16 App Router, no native TypeScript | Vitest |
| `moment.js` | Deprecated, 67KB, not tree-shakeable | `date-fns` + `date-fns-tz` |
| `axios` (for internal API calls) | Next.js Route Handlers return standard `Response` — `fetch` is built-in | Native `fetch` with typed return |
| Stripe | Explicitly out of scope (PROJECT.md); PayPal only per client request 2026-04-06 | `@paypal/react-paypal-js` + PayPal Orders v2 REST |
| `react-signature-canvas` | Stale alpha (1.1.0-alpha.2), not updated to latest signature_pad | `react-signature-pad-wrapper` |

---

## Next.js 16 Migration Landmines

These are the specific breaking changes that WILL bite the team if not handled:

### 1. `middleware.ts` → `proxy.ts` (BREAKING)
Rename the file AND the exported function. `middleware.ts` still works but generates deprecation warnings. The `edge` runtime is NOT supported in `proxy.ts` — it runs on Node.js only. If you need Edge runtime for any logic, keep it in the old `middleware.ts` (still supported for edge only).

### 2. All Async Request APIs are Fully Async (BREAKING)
These are now async-only — there is no synchronous fallback in Next.js 16 (it was temporary in Next.js 15):
- `await cookies()` 
- `await headers()`
- `await draftMode()`
- `const { id } = await params` (in layouts, pages, route handlers)
- `const query = await searchParams` (in pages)

Run `npx next typegen` to generate `PageProps`, `LayoutProps`, `RouteContext` helper types — they handle the async types correctly.

### 3. Parallel Routes Require `default.js` (BREAKING)
Every parallel route slot (`@slotName`) must have an explicit `default.js` or `default.tsx`. Without it, `next build` fails. Create files returning `null` or calling `notFound()` for all slots.

### 4. `revalidateTag` Requires Second Argument (BREAKING + TypeScript Error)
```typescript
// WRONG — TypeScript error in Next.js 16
revalidateTag('compliance-docs')

// CORRECT — use 'max' for most cases (stale-while-revalidate)
revalidateTag('compliance-docs', 'max')

// For Server Actions where user needs to see their change immediately
updateTag('compliance-docs') // Server Actions only
```

### 5. Turbopack is Default — Webpack Configs Break Builds
If any dependency adds a webpack config (some older Next.js plugins do), `next build` will fail. Use `--webpack` flag to opt out per-command, or migrate to Turbopack-compatible config. Run `next build --webpack` as a temporary escape hatch.

### 6. Implicit Caching Gone — Opt-In Only
In Next.js 14, `fetch()` in Server Components was cached by default. In Next.js 16, **all dynamic code runs at request time by default**. You must explicitly opt into caching with `"use cache"` directive or `cacheLife`/`cacheTag`. This means routes that relied on implicit fetch caching will now be dynamic (slower cold start, always fresh). For this project, most routes should be dynamic anyway (compliance data must be fresh), so this is likely a non-issue — but verify any static-looking pages.

### 7. `images.minimumCacheTTL` Default Changed
Changed from 60s to 4 hours (14400s). Irrelevant unless you're serving images with no cache-control headers that change frequently. For Supabase Storage URLs with signed URLs, test that the TTL change doesn't cause stale image issues.

### 8. Node.js 20.9+ Required
Verify your Vercel Node.js runtime is set to Node.js 20.x or later. Next.js 16 drops Node.js 18 support.

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `next` | 16.1.7 | Node.js 20.9+, React 19.2 | Locked |
| `@supabase/supabase-js` | 2.103.0 | Next.js 16, React 19 | No known conflicts |
| `@supabase/ssr` | 0.10.2 | Next.js 16 App Router | Must use `getAll`/`setAll` cookie API (not `get`/`set`) |
| `react-hook-form` | 7.66.0 | React 19 | v8 beta exists but introduces breaking changes; stay on v7 |
| `@hookform/resolvers` | 5.2.2+ | Zod v4, Zod v3, RHF v7 | Use 5.2.2 or later for Zod v4 type fix |
| `zod` | 4.0.1 | TypeScript 5+ | v4 is stable; `zod/v3` subpath available if needed |
| `@react-pdf/renderer` | 4.4.1 | React 19 (since v4.1.0) | Use `renderToBuffer` in Route Handlers |
| `@paypal/react-paypal-js` | 9.1.1 | React 19 | V6 SDK, hooks-based API |
| `twilio` | 5.13.1 | Node.js 20+ | Server-only (Route Handlers / Server Actions) |
| `@sentry/nextjs` | 10.48.0 | Next.js 16 App Router | Use `instrumentation.ts` + `onRequestError` |
| `vitest` | 4.x | Vite 6, Node.js 20+ | Cannot unit-test async Server Components |
| `playwright` | 1.51+ | All major browsers | Used for E2E covering Server Components |
| `@coltorapps/builder` | 0.2.4 | React (version unspecified) | MIT, zero deps. Verify React 19 compatibility before Phase 2 build |
| `date-fns` | 4.1.0 | ESM environments | v4 is ESM-only; ensure Next.js Turbopack handles it |

---

## Sources

- **Next.js 16 Blog** — https://nextjs.org/blog/next-16 — breaking changes, caching model, proxy.ts, React 19.2 (HIGH confidence, official)
- **Next.js 16.1 Blog** — https://nextjs.org/blog/next-16-1 — Turbopack FS caching stable, bundle analyzer (HIGH confidence, official)
- **Next.js 16 Upgrade Guide** — https://nextjs.org/docs/app/guides/upgrading/version-16 — concrete migration steps, all breaking changes (HIGH confidence, official, updated 2026-04-10)
- **Context7 `/supabase/ssr`** — createServerClient patterns for proxy, Server Components, API Routes (HIGH confidence)
- **Context7 `/colinhacks/zod`** — Zod v4 release, library-authors dual-compatibility guide (HIGH confidence)
- **Context7 `/getsentry/sentry-docs`** — Next.js instrumentation.ts pattern, onRequestError (HIGH confidence)
- **npm `@supabase/supabase-js`** — v2.103.0 confirmed (HIGH confidence, live registry)
- **npm `@supabase/ssr`** — v0.10.2 confirmed (HIGH confidence, live registry)
- **npm `@paypal/react-paypal-js`** — v9.1.1 confirmed (HIGH confidence, live registry)
- **npm `@openrouter/ai-sdk-provider`** — v2.5.1 confirmed (HIGH confidence, live registry)
- **npm `twilio`** — v5.13.1 confirmed (HIGH confidence, live registry)
- **npm `@sentry/nextjs`** — v10.48.0 confirmed (HIGH confidence, live registry)
- **npm `@react-pdf/renderer`** — v4.4.1, React 19 support since v4.1.0 (HIGH confidence, live registry)
- **npm `signature_pad`** — v5.1.3 confirmed (HIGH confidence, live registry)
- **npm `react-signature-pad-wrapper`** — v4.3.2, published 1 month ago (HIGH confidence, live registry)
- **npm `date-fns`** — v4.1.0, ESM-only (HIGH confidence, live registry)
- **npm `browser-image-compression`** — v2.0.2, stable (HIGH confidence, live registry)
- **npm `@logtail/next`** — v0.3.1 (HIGH confidence, live registry)
- **GitHub `coltorapps/builder`** — v0.2.4, July 2025 release (MEDIUM confidence — React 19 compatibility unconfirmed)
- **React Hook Form GitHub issues** — Zod v4 + `@hookform/resolvers` v5.2.2 compatibility confirmed (MEDIUM confidence, community issue tracker)
- **OpenRouter docs** — Vercel AI SDK integration guide (HIGH confidence, official OpenRouter docs)

---

*Stack research for: 888 Safety & Training Platform — UK H&S SaaS*
*Researched: 2026-04-15*
