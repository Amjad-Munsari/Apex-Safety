# Phase 5: Document Upload, Notifications + Expiry Alerts - Plan

**Phase:** 05
**Status:** Planning

---

## 🌊 Wave 1: Admin Client Details Page
**Goal:** Create a dedicated page for Matt to view a client's details and manage their documents.

### Files to Create/Modify
- **`app/admin/clients/[id]/page.tsx`** [NEW]
  - Server component fetching `clients` and `documents` from Supabase.
  - Displays client name, address, and hours balance.
  - Renders a table/list of the client's documents.
- **`app/admin/clients/[id]/upload-document-modal.tsx`** [NEW]
  - Client component for the upload form (File input, Document Category dropdown, Expiry Date picker).
- **`app/admin/clients/[id]/actions.ts`** [NEW]
  - Server actions for handling the document upload to the `client-documents` bucket.
  - Inserts the metadata into the `documents` table.

---

## 🌊 Wave 2: Mocked Notifications
**Goal:** Hook the document upload to mocked SMS and Email dispatches to satisfy demo requirements without live third-party dependencies.

### Files to Create/Modify
- **`lib/notifications/mock-dispatch.ts`** [NEW]
  - A utility file exposing `sendMockSMS()` and `sendMockEmail()`.
  - These functions will use `console.log` and visually log a mock payload representing what *would* be sent to Twilio or n8n.
- **`app/admin/clients/[id]/actions.ts`** [MODIFY]
  - Update the upload server action to invoke `sendMockSMS()` and `sendMockEmail()` immediately after a successful document database insertion.

---

## 🌊 Wave 3: Expiry Alerts Cron Job
**Goal:** Create the backend logic to sweep for expiring documents and send warnings.

### Files to Create/Modify
- **`app/api/cron/expiry/route.ts`** [NEW]
  - An API route (secured via a cron secret) that runs daily.
  - Queries `documents` for items where `expiry_date` is exactly 30, 14, or 7 days from `CURRENT_DATE`.
  - Joins against `notifications_sent` to guarantee idempotency.
  - Calls `sendMockSMS()` and `sendMockEmail()` for each matched document.
  - Inserts records into `notifications_sent` to mark the alert as processed.

---

## Verification Plan
1. **Upload Flow**: Navigate to `/admin/clients/[id]`, upload a test PDF, and verify it appears in the database and the Supabase Storage bucket.
2. **Notifications**: Observe the terminal console to ensure the mocked Twilio/n8n messages are logged synchronously with the upload.
3. **Cron Job**: Manually trigger `/api/cron/expiry` via browser or Postman and ensure the mocked warning logs appear for documents forced to expire in 30 days.

---
