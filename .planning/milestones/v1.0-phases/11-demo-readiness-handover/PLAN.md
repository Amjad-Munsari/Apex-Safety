# Phase 11 Plan: Demo Readiness & Final Polish

## Overview
Prepare the platform for a live walkthrough by seeding realistic data, enabling global search, and providing manual administrative controls for hours tracking.

## Proposed Changes

### 1. High-Fidelity Seeding
- [ ] Create `scripts/seed-demo-data.mjs`:
    - 8 realistic clients with site addresses and contact info.
    - Mix of RAG compliance statuses (current, expiring, expired).
    - Varied hours balances (some low to trigger warnings).
    - Associated dummy documents and proposals.

### 2. Global Search Implementation
- [ ] Create `app/admin/search/route.ts`:
    - API endpoint to search clients, documents, and proposals.
- [ ] Update `app/admin/layout.tsx`:
    - Implement search logic (state, dropdown results).
    - Add keyboard shortcut (⌘K) to focus search.

### 3. Manual Hours Management
- [ ] Create `components/clients/adjust-hours-dialog.tsx`:
    - Form to add/deduct hours from a client's balance.
- [ ] Update `app/admin/clients/[id]/page.tsx`:
    - Add the "Adjust Balance" button to the hours card.
- [ ] Add `app/admin/clients/actions.ts`:
    - `updateClientHours` server action.

### 4. Admin Onboarding
- [ ] Create `app/admin/guide/page.tsx`:
    - A clean, branded quick-start guide for Matt.
    - Summarizes: Creating Proposals, Reviewing Reports, Managing Compliance.

## Verification Plan

### Automated Tests
- Script to verify that searching for a seeded client returns the correct record.

### Manual Verification
- Run seed script and verify the dashboard looks "full."
- Test ⌘K search and jump to a client record.
- Adjust a client's hours and verify the UI updates.
- Review the Quick-Start guide.
