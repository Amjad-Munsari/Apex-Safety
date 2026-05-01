# Plan: Admin Dashboard Navigation & Data Fetching Fix

The Admin Dashboard currently uses hardcoded mock data and lacks functional links to the individual client details pages. This plan fixes those issues.

## Proposed Changes

### 1. Extract Compliance Chart Component
Move the interactive `recharts` logic from the main page into a standalone client component.
- **File:** `app/admin/compliance-chart.tsx` [NEW]

### 2. Convert Admin Dashboard to Server Component
- **File:** `app/admin/page.tsx` [MODIFY]
- Remove `"use client"`.
- Fetch real clients from Supabase.
- Map over real clients in the table.
- Wrap rows/names in `<Link href={\`/admin/clients/\${client.id}\`}>`.
- Import and use `<ComplianceChart />`.

## Verification
- **Visual:** Verify the client table shows real DB data.
- **Navigation:** Click a client and ensure it goes to their details page.
- **Correctness:** Ensure the chart still works.
