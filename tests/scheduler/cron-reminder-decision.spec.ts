// Wave-0 scaffold for Phase 17 §Example 4 + §Pattern 4 + §Pitfall 5 — full assertions land in Plan 17-05.

import { describe, it } from "vitest";

describe("cron /api/cron/assignment-scheduler (Phase 17)", () => {
  it.todo("Plan 17-05: returns 401 when CRON_SECRET is set and Authorization header is missing or wrong");
  it.todo("Plan 17-05: decides cadence='7d' when due_date === today+7 AND last_reminder_sent === null");
  it.todo("Plan 17-05: decides cadence='1d' when due_date === today+1 AND last_reminder_sent !== '1d' AND !== 'overdue'");
  it.todo("Plan 17-05: decides cadence='overdue' when due_date < today AND last_reminder_sent !== 'overdue'");
  it.todo("Plan 17-05: skips revoked (deleted_at NOT NULL), completed, and null-due rows");
  it.todo("Plan 17-05: writes last_reminder_sent AFTER dispatchNotification returns ok:true; leaves it unchanged on ok:false and inserts workflow_errors");
});
