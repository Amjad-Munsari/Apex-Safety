# Phase 10 Plan: Admin Dashboard Logic

## Goal
Transform the static/mocked elements of the Admin Dashboard into a live, data-driven command center.

## Proposed Changes

### 1. Data Layer (`lib/supabase/dashboard.ts`)
- [NEW] Create helper functions to fetch dashboard metrics:
    - `getDashboardStats()`: Counts of items needing attention, overdue docs, expiring docs, drafts to review, and workflow errors.
    - `getReportsAwaitingReview()`: Fetch recent `form_submissions` with `status = 'draft_ready_for_review'`.
    - `getUpcomingExpiries()`: Fetch documents expiring in the next 30 days.
    - `getComplianceAggregates()`: Total counts of Current, Expiring, and Expired docs across the platform.

### 2. Admin Dashboard (`app/admin/page.tsx`)
- [MODIFY] Set `export const dynamic = "force-dynamic"`.
- [MODIFY] Replace mock stats with data from `getDashboardStats()`.
- [MODIFY] Wire "Reports awaiting review" card to `getReportsAwaitingReview()`.
- [MODIFY] Wire "Upcoming expiries" card to `getUpcomingExpiries()`.
- [MODIFY] Wire "Compliance status" chart to `getComplianceAggregates()`.
- [MODIFY] Update "Hours balances" RAG logic (<3 danger, <10 warning).
- [MODIFY] Update greeting to "Welcome back, Matt".

### 3. Dedicated List Views
- [NEW] `app/admin/expiries/page.tsx`: Full table of expiring documents.
- [NEW] `app/admin/review-queue/page.tsx`: Full list of assessments awaiting review.
- [NEW] `app/admin/proposals/page.tsx`: Pipeline view of all active proposals.
- [NEW] `app/admin/errors/page.tsx`: Operational log of workflow errors.

## Verification Plan

### Manual Verification
1.  **Dashboard Loads**: Verify the dashboard loads without errors and shows real numbers (or zeros if empty).
2.  **RAG Status**: Verify a client with 2 hours shows as "Danger" (Red).
3.  **Navigation**: Click "View all" on each card and ensure it routes to the correct new list view.
4.  **Live Updates**: Add a dummy document with a past expiry date and verify "Overdue docs" count increments on refresh.
