// Phase 17 Plan 17-02 — generateNextOccurrence filled spec (replaces Wave-0 scaffold)

import { describe, it, expect, vi } from "vitest";
import { generateNextOccurrence } from "@/lib/scheduler/generate-next-occurrence";

// ── Sample source row used across tests ────────────────────────────────────
const src = {
  id: "asg-1",
  client_id: "client-A",
  template_id: "tpl-1",
  assigned_by: "admin-1",
  instructions: "Please complete by Friday",
  due_date: "2026-06-01",
  recurrence_rule: { frequency: "weekly" as const },
};

// ── Stub builder ────────────────────────────────────────────────────────────
//
// makeStubClient(opts) returns a SupabaseClient-shaped stub:
//   - .from("template_versions") → chainable whose terminal .maybeSingle()
//     resolves to opts.versionsResult
//   - .from("form_assignments") → chainable whose .insert(payload) records the
//     payload in opts.insertSpy, then .select().single() resolves to opts.insertResult

function makeStubClient(opts: {
  versionsResult: { data: { id: string } | null };
  insertSpy: ReturnType<typeof vi.fn>;
  insertResult: { data: { id: string } | null; error: null | { message: string } };
}) {
  // template_versions chain: .select().eq().not().order().limit().maybeSingle()
  const versionsChain = {
    select: () => versionsChain,
    eq: () => versionsChain,
    not: () => versionsChain,
    order: () => versionsChain,
    limit: () => versionsChain,
    maybeSingle: () => Promise.resolve(opts.versionsResult),
  };

  // form_assignments chain: .insert(payload).select().single()
  const insertChain = {
    select: () => insertChain,
    single: () => Promise.resolve(opts.insertResult),
  };

  return {
    from: (table: string) => {
      if (table === "template_versions") return versionsChain;
      if (table === "form_assignments") {
        return {
          insert: (payload: unknown) => {
            opts.insertSpy(payload);
            return insertChain;
          },
        };
      }
      return {};
    },
  } as unknown as Parameters<typeof generateNextOccurrence>[0];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("generateNextOccurrence (Phase 17)", () => {
  // Test 1: null recurrence_rule → ok:false reason:"no_recurrence_rule"
  it("returns {ok:false, reason:'no_recurrence_rule'} when recurrence_rule is null", async () => {
    const insertSpy = vi.fn();
    const client = makeStubClient({
      versionsResult: { data: { id: "tv-1" } },
      insertSpy,
      insertResult: { data: { id: "asg-new" }, error: null },
    });

    const result = await generateNextOccurrence(client, { ...src, recurrence_rule: null });
    expect(result).toEqual({ ok: false, reason: "no_recurrence_rule" });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // Test 2: null due_date (with valid recurrence_rule) → ok:false reason:"no_due_date"
  it("returns {ok:false, reason:'no_due_date'} when due_date is null", async () => {
    const insertSpy = vi.fn();
    const client = makeStubClient({
      versionsResult: { data: { id: "tv-1" } },
      insertSpy,
      insertResult: { data: { id: "asg-new" }, error: null },
    });

    const result = await generateNextOccurrence(client, { ...src, due_date: null });
    expect(result).toEqual({ ok: false, reason: "no_due_date" });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // Test 3: latest-published lookup returns null → ok:false reason:"no_published_version"
  it("returns {ok:false, reason:'no_published_version'} when template has no published version", async () => {
    const insertSpy = vi.fn();
    const client = makeStubClient({
      versionsResult: { data: null },
      insertSpy,
      insertResult: { data: { id: "asg-new" }, error: null },
    });

    const result = await generateNextOccurrence(client, src);
    expect(result).toEqual({ ok: false, reason: "no_published_version" });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // Test 4: computes new due_date by adding frequency to PRIOR due_date (not today)
  // weekly + "2026-06-01" → "2026-06-08"
  it("computes new due_date by adding frequency unit to PRIOR due_date (weekly +7d)", async () => {
    const insertSpy = vi.fn();
    const client = makeStubClient({
      versionsResult: { data: { id: "tv-new" } },
      insertSpy,
      insertResult: { data: { id: "asg-new" }, error: null },
    });

    await generateNextOccurrence(client, src);

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: "2026-06-08" })
    );
  });

  // Test 5: new row inherits client_id, template_id, assigned_by, instructions, recurrence_rule
  it("new row inherits client_id, template_id, assigned_by, instructions, recurrence_rule from src", async () => {
    const insertSpy = vi.fn();
    const client = makeStubClient({
      versionsResult: { data: { id: "tv-new" } },
      insertSpy,
      insertResult: { data: { id: "asg-new" }, error: null },
    });

    await generateNextOccurrence(client, src);

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-A",
        template_id: "tpl-1",
        assigned_by: "admin-1",
        instructions: "Please complete by Friday",
        recurrence_rule: { frequency: "weekly" },
      })
    );
  });

  // Test 6: new row's template_version_id is re-pinned to the id from the latest-published lookup
  it("new row's template_version_id is re-pinned to the LATEST published version id", async () => {
    const insertSpy = vi.fn();
    const client = makeStubClient({
      versionsResult: { data: { id: "tv-new" } },
      insertSpy,
      insertResult: { data: { id: "asg-new" }, error: null },
    });

    await generateNextOccurrence(client, src);

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ template_version_id: "tv-new" })
    );
  });
});
