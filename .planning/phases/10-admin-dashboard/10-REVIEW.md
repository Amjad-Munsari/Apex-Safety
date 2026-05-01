# Code Review: Phase 10 — Admin Dashboard Logic

## Summary
The Admin Dashboard logic successfully transitions the UI from static mocks to live data. The core metrics and list views are functional. However, there are significant performance concerns regarding how compliance data is aggregated and some inconsistencies in list view logic.

## Findings

### 🔴 High Severity

#### 1. Performance: Client-side Aggregation
**File:** [dashboard.ts](file:///c:/dev/Antigravity/888 Safety/lib/supabase/dashboard.ts) (Line 107)
**Description:** `getComplianceAggregates` fetches all document expiry dates from the database and processes them in JavaScript.
**Impact:** As the number of documents grows (e.g., thousands of items), this will cause significant latency and high memory usage on the server.
**Recommendation:** Refactor to use SQL `COUNT` with `GROUP BY` or multiple count queries to let the database handle the aggregation.

### 🟡 Medium Severity

#### 2. Performance: Multiple Round-trips
**File:** [dashboard.ts](file:///c:/dev/Antigravity/888 Safety/lib/supabase/dashboard.ts) (Line 3)
**Description:** `getDashboardStats` performs 6 individual `SELECT` queries to Supabase.
**Impact:** Each query adds network overhead.
**Recommendation:** Group these into a single database function (RPC) or use a single query with multiple aggregations if possible.

#### 3. UX / Logic: Review Queue Limit
**File:** [dashboard.ts](file:///c:/dev/Antigravity/888 Safety/lib/supabase/dashboard.ts) (Line 73)
**Description:** `getReportsAwaitingReview` is limited to 3 items.
**Impact:** The `ReviewQueuePage` ([page.tsx](file:///c:/dev/Antigravity/888 Safety/app/admin/review-queue/page.tsx)) uses this function, meaning the "Full list" only ever shows 3 items.
**Recommendation:** Add a `limit` parameter to `getReportsAwaitingReview` or create a separate function for the full list view.

### 🔵 Low Severity

#### 4. Types: Implicit `any` in views
**File:** [review-queue/page.tsx](file:///c:/dev/Antigravity/888 Safety/app/admin/review-queue/page.tsx) (Lines 45, 51)
**Description:** Frequent use of `as any` when accessing nested Supabase relations.
**Recommendation:** Use generated Supabase types or define interfaces that reflect the joined data structure.

#### 5. Logic: Proposal Total Robustness
**File:** [dashboard.ts](file:///c:/dev/Antigravity/888 Safety/lib/supabase/dashboard.ts) (Line 162)
**Description:** `calculateProposalTotal` checks for both `price` and `unit_price`.
**Recommendation:** While robust, this suggests inconsistent schema usage. Standardize on one field name in the database/JSON.

## Verification Plan
- [ ] Measure execution time of `getDashboardStats` in the local environment.
- [ ] Verify that the Review Queue page shows more than 3 items if they exist (after fixing the limit).
- [ ] Run a count query in SQL and compare with `getComplianceAggregates` results.
