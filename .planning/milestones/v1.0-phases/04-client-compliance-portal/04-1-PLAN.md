# Phase 4: Client Compliance Portal

**Goal**: Build a high-fidelity, demo-ready client portal where Matt's customers can view their compliance status, download documents, and see delivered reports.

## Proposed Changes

### Auth & Navigation
- [NEW] `app/portal/login/page.tsx`: Simple, branded magic-link entry point.
- [NEW] `app/portal/layout.tsx`: Sidebar-driven layout matching the "High-Fidelity Editorial" aesthetic.
- [NEW] `components/portal-sidebar.tsx`: Navigation for the client portal.

### Dashboard & Views
- [NEW] `app/portal/page.tsx`: The main "Compliance Overview" with RAG badges and a "Traffic Light" summary.
- [NEW] `app/portal/documents/page.tsx`: Document library for certificates (Insurance, Gas Safety, etc.).
- [NEW] `app/portal/reports/page.tsx`: List of delivered Fire Risk and Site Risk reports.
- [NEW] `app/portal/billing/page.tsx`: Hours balance and transaction history (placeholder for Phase 8).

### Data & Logic
- [NEW] `lib/portal/dummy-data.ts`: High-fidelity seed data for the demo (Clients, Documents, Reports).
- [MODIFY] `lib/supabase/session.ts`: Ensure client-side session helpers are ready.

## Success Criteria
1. A user can "log in" via email (magic link) and land in a branded portal.
2. The dashboard shows a "Compliance Score" or RAG summary that looks impressive.
3. Documents can be listed and "downloaded" (mocked if storage is empty).
4. The UI is pixel-perfect on mobile and desktop.

## Verification Plan
### Manual Verification
- Access `/portal/login`.
- Verify magic link flow.
- Navigate all portal pages on mobile and desktop.
- Confirm dummy data renders with high visual quality.
