# Phase 10 Context: Admin Dashboard Logic

## Overview
This phase wires the high-fidelity admin dashboard cards to live Supabase data and establishes dedicated list views for deep-diving into expiries, reports, and compliance metrics.

## Decisions

### 1. Data Freshness & Delivery
- **Strategy**: Use `export const dynamic = "force-dynamic"` in `app/admin/page.tsx`.
- **Rationale**: Admin dashboard must reflect real-time changes in document expiries and assessment submissions without manual refresh or revalidation lags.

### 2. Logic & Thresholds
- **Hours Balance RAG**:
    - **Danger (Red)**: < 3 hours remaining.
    - **Warning (Gold)**: < 10 hours remaining.
    - **Safe (Green/Dim)**: >= 10 hours.
- **Expiry RAG**:
    - **Expired (Red)**: `expiry_date < now`.
    - **Expiring Soon (Gold)**: `expiry_date < (now + 30 days)`.
    - **Current (Green)**: Everything else.

### 3. UI & Content
- **Greeting**: Hardcoded to "Welcome back, Matt" (Matt is the sole admin).
- **Navigation**: "View all" and `>` links will point to new dedicated list views:
    - `/admin/expiries` (Global view of all expiring documents)
    - `/admin/review-queue` (List of assessments awaiting AI report review)
    - `/admin/proposals` (Pipeline view)
    - `/admin/errors` (Workflow error logs)

### 4. Technical Implementation
- **Shared Utilities**: Create a dashboard helper (e.g. `lib/supabase/dashboard.ts`) to fetch aggregate counts in a single efficient query where possible.
- **Data Fetching**: Use `adminClient` for cross-client aggregates.

## Deferred / Out of Scope
- **Real-time Webhook Pushes**: The dashboard will refresh on load; Pusher/Realtime integration is deferred to v2.
- **Bulk Actions**: Dedicated list views will show data; bulk delete/edit is deferred.
