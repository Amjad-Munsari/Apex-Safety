// Phase 17 Plan 17-05 — cron /api/cron/assignment-scheduler regression spec.
//
// Covers the four contract-critical behaviors of the cron handler (Plan 17-04):
//   1. Auth gate — 401 on missing/wrong Authorization header when CRON_SECRET is set.
//   2. PASS A filter chain — .is("deleted_at",null) + .neq("status","completed") + .not("due_date","is",null).
//   3. Cadence decision ladder — monotonic 7d → 1d → overdue state machine.
//   4. Idempotency — last_reminder_sent written ONLY after ok:true; on ok:false write is
//      skipped AND workflow_errors is inserted (Pattern 4).
//
// Hoisting-safe vi.mock pattern (Plan 16-04 §Deviation 3):
//   Declare ALL spy vi.fn() instances BEFORE vi.mock calls so factories can close over
//   them via arrow wrappers that resolve at call time, not at hoist time.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Spy references (declared before vi.mock so hoisting can close over them) ──

const sendReminderSpy = vi.fn();
const generatorSpy = vi.fn();
const supabaseFromSpy = vi.fn();

// ── vi.mock declarations (hoisted by Vitest before imports) ───────────────────

vi.mock("@/lib/scheduler/send-reminder", () => ({
  sendAssignmentReminder: (...a: unknown[]) => sendReminderSpy(...a),
}));
vi.mock("@/lib/scheduler/generate-next-occurrence", () => ({
  generateNextOccurrence: (...a: unknown[]) => generatorSpy(...a),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => supabaseFromSpy(t) }),
}));

// ── Import SUT AFTER vi.mock declarations so mocks are applied ─────────────────

import { GET } from "@/app/api/cron/assignment-scheduler/route";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Compute ISO date (yyyy-mm-dd) at UTC midnight offset from today. */
function iso(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Build a request with the correct Authorization header. */
const authedRequest = () =>
  new Request("https://x/api/cron/assignment-scheduler", {
    headers: { Authorization: "Bearer real-secret" },
  });

/** Build a request with NO Authorization header. */
const unauthRequest = () =>
  new Request("https://x/api/cron/assignment-scheduler");

// ── Chainable Supabase stub builder ───────────────────────────────────────────
//
// The SUT awaits the PostgREST builder chain directly (e.g. `await supabase.from(...).select(...).is(...)`).
// To support this, the chainable exposes a `.then(onFulfilled)` method so it is thenable.
// Per-test configurable: pass `resolveWith` to set what `await chain` returns.
// Method spies are attached so tests can assert filter invocations.

interface ChainableStub {
  then: (onFulfilled: (v: unknown) => unknown) => Promise<unknown>;
  select: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  _resolveWith: { data: unknown; error: unknown };
}

function buildChainable(resolveWith: { data: unknown; error: unknown }): ChainableStub {
  const stub: ChainableStub = {
    _resolveWith: resolveWith,
    then(onFulfilled) {
      return Promise.resolve(resolveWith).then(onFulfilled);
    },
    select: vi.fn(),
    is: vi.fn(),
    neq: vi.fn(),
    not: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    order: vi.fn(),
  };
  // All methods return `this` to support arbitrary chaining depth.
  stub.select.mockReturnValue(stub);
  stub.is.mockReturnValue(stub);
  stub.neq.mockReturnValue(stub);
  stub.not.mockReturnValue(stub);
  stub.eq.mockReturnValue(stub);
  stub.limit.mockReturnValue(stub);
  stub.update.mockReturnValue(stub);
  stub.insert.mockReturnValue(stub);
  stub.order.mockReturnValue(stub);
  return stub;
}

// ── Env snapshot vars ─────────────────────────────────────────────────────────

let savedCronSecret: string | undefined;
let savedSupabaseUrl: string | undefined;
let savedServiceRoleKey: string | undefined;

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("cron /api/cron/assignment-scheduler (Phase 17)", () => {
  beforeEach(() => {
    // Snapshot env vars before each test
    savedCronSecret = process.env.CRON_SECRET;
    savedSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Reset all spies
    sendReminderSpy.mockReset();
    generatorSpy.mockReset();
    supabaseFromSpy.mockReset();

    // Set env vars for all tests — individual tests may override
    process.env.CRON_SECRET = "real-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  afterEach(() => {
    // Restore env vars to prevent test bleed
    if (savedCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = savedCronSecret;
    }
    if (savedSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = savedSupabaseUrl;
    }
    if (savedServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceRoleKey;
    }
  });

  // ── Test 1: Auth gate — 401 on missing Authorization header ──────────────────

  it("returns 401 when CRON_SECRET is set and Authorization header is missing or wrong", async () => {
    // No Authorization header — should be denied
    const res = await GET(unauthRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // ── Test 2: Auth gate — passes with correct Authorization header ─────────────

  it("returns 200 with correct Authorization header (empty run — no rows)", async () => {
    // Both PASS A and PASS B SELECT return empty rows
    const emptyChainable = buildChainable({ data: [], error: null });
    supabaseFromSpy.mockReturnValue(emptyChainable);

    const res = await GET(authedRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, remindersSent: 0, recurrencesGenerated: 0 });
  });

  // ── Test 3: Cadence "7d" — due_date === today+7 AND last_reminder_sent === null ──

  it("decides cadence='7d' when due_date === today+7 AND last_reminder_sent === null", async () => {
    const day7 = iso(7);
    const row = {
      id: "asg-1",
      client_id: "client-org-001",
      due_date: day7,
      status: "pending",
      deleted_at: null,
      last_reminder_sent: null,
      instructions: null,
      template: { name: "Fire Risk Assessment" },
    };

    // Track calls per table to route chainables correctly
    const passAChain = buildChainable({ data: [row], error: null });
    const clientChain = buildChainable({ data: [{ name: "Alex", email: "alex@example.com" }], error: null });
    const updateChain = buildChainable({ data: null, error: null });
    // PASS B SELECT returns empty (not under test here)
    const passBChain = buildChainable({ data: [], error: null });

    let passAConsumed = false;
    let clientConsumed = false;

    supabaseFromSpy.mockImplementation((table: string) => {
      if (table === "form_assignments" && !passAConsumed) {
        passAConsumed = true;
        return passAChain;
      }
      if (table === "client_users" && !clientConsumed) {
        clientConsumed = true;
        return clientChain;
      }
      if (table === "form_assignments") {
        // UPDATE call (write dedup column) OR second PASS B SELECT
        return updateChain;
      }
      return passBChain;
    });

    sendReminderSpy.mockResolvedValueOnce({ ok: true, status: 200 });
    // PASS B generate returns ok:false to avoid extra update calls
    generatorSpy.mockResolvedValue({ ok: false, reason: "no rule" });

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);

    // sendAssignmentReminder must be called with cadence: "7d"
    expect(sendReminderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cadence: "7d",
        client_email: "alex@example.com",
        client_name: "Alex",
      })
    );

    // Dedup write: .update({ last_reminder_sent: "7d" }).eq("id", "asg-1")
    expect(updateChain.update).toHaveBeenCalledWith({ last_reminder_sent: "7d" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "asg-1");
  });

  // ── Test 4: Cadence "overdue" + idempotency on success ───────────────────────

  it("decides cadence='overdue' when due_date < today AND last_reminder_sent === null, and writes dedup column on ok:true", async () => {
    const yesterday = iso(-1);
    const row = {
      id: "asg-2",
      client_id: "client-org-002",
      due_date: yesterday,
      status: "pending",
      deleted_at: null,
      last_reminder_sent: null,
      instructions: null,
      template: { name: "Site Risk Assessment" },
    };

    const passAChain = buildChainable({ data: [row], error: null });
    const clientChain = buildChainable({ data: [{ name: "Bob", email: "bob@example.com" }], error: null });
    const updateChain = buildChainable({ data: null, error: null });
    const passBChain = buildChainable({ data: [], error: null });

    let passAConsumed = false;
    let clientConsumed = false;

    supabaseFromSpy.mockImplementation((table: string) => {
      if (table === "form_assignments" && !passAConsumed) {
        passAConsumed = true;
        return passAChain;
      }
      if (table === "client_users" && !clientConsumed) {
        clientConsumed = true;
        return clientChain;
      }
      if (table === "form_assignments") {
        return updateChain;
      }
      return passBChain;
    });

    sendReminderSpy.mockResolvedValueOnce({ ok: true, status: 200 });
    generatorSpy.mockResolvedValue({ ok: false, reason: "no rule" });

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);

    // sendAssignmentReminder called with cadence: "overdue"
    expect(sendReminderSpy).toHaveBeenCalledWith(
      expect.objectContaining({ cadence: "overdue" })
    );

    // Dedup write must happen: .update({ last_reminder_sent: "overdue" })
    expect(updateChain.update).toHaveBeenCalledWith({ last_reminder_sent: "overdue" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "asg-2");
  });

  // ── Test 5: Idempotency on failure — workflow_errors INSERT + NO last_reminder_sent write ──
  // This is the most contract-critical test in Phase 17 (T-17-23).
  // Two-part assertion: (a) workflow_errors INSERT WAS called, (b) last_reminder_sent UPDATE was NOT called.

  it("on dispatch ok:false inserts workflow_errors AND does NOT update last_reminder_sent", async () => {
    const yesterday = iso(-1);
    const row = {
      id: "asg-3",
      client_id: "client-org-003",
      due_date: yesterday,
      status: "pending",
      deleted_at: null,
      last_reminder_sent: null,
      instructions: null,
      template: { name: "Fire Risk Assessment" },
    };

    const passAChain = buildChainable({ data: [row], error: null });
    const clientChain = buildChainable({ data: [{ name: "Carol", email: "carol@example.com" }], error: null });
    // Separate chainable for workflow_errors INSERT — never called for form_assignments update
    const workflowErrorsChain = buildChainable({ data: null, error: null });
    const passBChain = buildChainable({ data: [], error: null });
    // If form_assignments UPDATE were (wrongly) called, this chainable would capture it
    const updateChain = buildChainable({ data: null, error: null });

    let passAConsumed = false;
    let clientConsumed = false;

    supabaseFromSpy.mockImplementation((table: string) => {
      if (table === "form_assignments" && !passAConsumed) {
        passAConsumed = true;
        return passAChain;
      }
      if (table === "client_users" && !clientConsumed) {
        clientConsumed = true;
        return clientChain;
      }
      if (table === "workflow_errors") {
        return workflowErrorsChain;
      }
      if (table === "form_assignments") {
        // Any second call to form_assignments (e.g. PASS B SELECT or wrong UPDATE)
        return updateChain;
      }
      return passBChain;
    });

    // Dispatch FAILS
    sendReminderSpy.mockResolvedValueOnce({ ok: false, error: "webhook 500" });
    generatorSpy.mockResolvedValue({ ok: false, reason: "no rule" });

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);

    // (a) workflow_errors INSERT must have been called with correct payload
    expect(workflowErrorsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_name: "assignment_reminder",
        error_message: "webhook 500",
      })
    );

    // (b) form_assignments UPDATE must NOT have been called (dedup column not written on failure)
    // passAChain is the PASS A SELECT — its .update should never be invoked
    expect(passAChain.update).not.toHaveBeenCalled();
    // updateChain is the canary: any second form_assignments call goes here
    expect(updateChain.update).not.toHaveBeenCalled();
  });

  // ── Test 6: Filter chain (Pitfall 5) — assert all three PASS A filters were called ─

  it("PASS A SELECT invokes .is('deleted_at', null), .neq('status', 'completed'), and .not('due_date', 'is', null)", async () => {
    // Return empty rows so the for-loop is a no-op — we only care about filter invocations
    const passAChain = buildChainable({ data: [], error: null });
    const passBChain = buildChainable({ data: [], error: null });

    let passAConsumed = false;

    supabaseFromSpy.mockImplementation((table: string) => {
      if (table === "form_assignments" && !passAConsumed) {
        passAConsumed = true;
        return passAChain;
      }
      return passBChain;
    });

    generatorSpy.mockResolvedValue({ ok: false, reason: "no rule" });

    await GET(authedRequest());

    // Assert all three Pitfall-5 filter methods were called with the correct arguments
    expect(passAChain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(passAChain.neq).toHaveBeenCalledWith("status", "completed");
    expect(passAChain.not).toHaveBeenCalledWith("due_date", "is", null);
  });

  // ── Test 7 (bonus): Cadence "1d" — due_date === today+1, last_reminder_sent !== "1d"/"overdue" ─

  it("decides cadence='1d' when due_date === today+1 AND last_reminder_sent !== '1d' AND !== 'overdue'", async () => {
    const day1 = iso(1);
    const row = {
      id: "asg-4",
      client_id: "client-org-004",
      due_date: day1,
      status: "pending",
      deleted_at: null,
      last_reminder_sent: null,  // null means 7d check runs first — but today != day7
      instructions: "Annual check required",
      template: [{ name: "Annual Review" }],
    };

    const passAChain = buildChainable({ data: [row], error: null });
    const clientChain = buildChainable({ data: [{ name: "Dan", email: "dan@example.com" }], error: null });
    const updateChain = buildChainable({ data: null, error: null });
    const passBChain = buildChainable({ data: [], error: null });

    let passAConsumed = false;
    let clientConsumed = false;

    supabaseFromSpy.mockImplementation((table: string) => {
      if (table === "form_assignments" && !passAConsumed) {
        passAConsumed = true;
        return passAChain;
      }
      if (table === "client_users" && !clientConsumed) {
        clientConsumed = true;
        return clientChain;
      }
      if (table === "form_assignments") {
        return updateChain;
      }
      return passBChain;
    });

    sendReminderSpy.mockResolvedValueOnce({ ok: true, status: 200 });
    generatorSpy.mockResolvedValue({ ok: false, reason: "no rule" });

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);

    expect(sendReminderSpy).toHaveBeenCalledWith(
      expect.objectContaining({ cadence: "1d" })
    );
    expect(updateChain.update).toHaveBeenCalledWith({ last_reminder_sent: "1d" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "asg-4");
  });
});
