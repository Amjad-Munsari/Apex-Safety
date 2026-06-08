// Phase 16 Plan 05 — forkAssignedTemplate query-shape assertions
//
// D-05: reads the EXACT template_version_id pinned on the assignment row
//       (NOT latest published version) — query by .eq("id", assignment.template_version_id)
// D-06: after fork + v1 version insert, form_assignments is updated to point
//       at the fork's template_id and v1 template_version_id
// D-08: fork auto-publishes at v1 (published_at = now(), version_number = 1,
//       owner_type='customer', is_published=true)

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Seed data (real-looking UUIDs) ───────────────────────────────────────────

const ASSIGNMENT_ID = "asg-00000000-0000-4000-8000-000000000001";
const MASTER_TEMPLATE_ID = "master-1111-1111-4111-8111-111111111111";
const MASTER_VERSION_ID = "ver-master-2222-4222-8222-222222222222";
const FORK_ID = "fork-3333-3333-4333-8333-333333333333";
const V1_ID = "ver-fork-4444-4444-4444-8444-444444444444";
const CLIENT_ORG_ID = "client-org-001";
const USER_ID = "user-001";

const assignmentRow = {
  id: ASSIGNMENT_ID,
  client_id: CLIENT_ORG_ID,
  template_id: MASTER_TEMPLATE_ID,
  template_version_id: MASTER_VERSION_ID,
  deleted_at: null,
};

const pinnedVersion = {
  schema_json: {
    entities: { e1: { type: "text" } },
    root: { children: ["e1"] },
  },
};

const masterTemplate = {
  name: "FRA Type 3",
  template_type: "fra",
};

// ── Spy collectors ────────────────────────────────────────────────────────────

// We collect all .eq() calls and .insert() calls across all tables
const eqCalls: Array<[string, string]> = [];
const insertPayloads: Array<Record<string, unknown>> = [];
let updatePayload: Record<string, unknown> | null = null;
let updateEqIdArg: string | null = null;

// ── Supabase mock ─────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Freeze guard (lib/clients/require-active) reads clients.active via adminClient.
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) =>
      table === "clients"
        ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { active: true }, error: null }) }) }) }
        : {},
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireActorUserId: vi.fn().mockResolvedValue("user-001"),
  getClientContext: vi.fn().mockResolvedValue({
    user_id: "user-001",
    client_id: "client-org-001",
    role: "client",
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;" + path,
      redirectPath: path,
    });
  }),
}));

// ── Import under test ─────────────────────────────────────────────────────────

import { forkAssignedTemplate } from "@/app/client/assignments/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ── Helper: build the full supabase mock ─────────────────────────────────────

function buildSupabaseMock() {
  // Reset collectors
  eqCalls.length = 0;
  insertPayloads.length = 0;
  updatePayload = null;
  updateEqIdArg = null;

  // We need a stateful from() that handles different tables and call sequences
  // Each table has different chains depending on whether it's read or write

  // form_assignments:
  //   READ:  .select().eq("id", ASSIGNMENT_ID).single()
  //   WRITE: .update({...}).eq("id", ASSIGNMENT_ID)

  // template_versions:
  //   READ:  .select("schema_json").eq("id", MASTER_VERSION_ID).single()
  //   WRITE: .insert({...}).select("id").single()

  // form_templates:
  //   READ:  .select("name, template_type").eq("id", MASTER_TEMPLATE_ID).single()
  //   WRITE: .insert({...}).select("id").single()

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "form_assignments") {
      // Decide read vs write based on whether .select or .update is called
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            eqCalls.push([col, val]);
            return {
              single: vi.fn().mockResolvedValue({ data: assignmentRow, error: null }),
            };
          }),
        }),
        update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              updateEqIdArg = val;
              return Promise.resolve({ error: null });
            }),
          };
        }),
      };
    }

    if (table === "template_versions") {
      // First call is READ (schema_json), second is INSERT (v1)
      let readCallCount = 0;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            eqCalls.push([col, val]);
            return {
              single: vi.fn().mockResolvedValue({
                data: pinnedVersion,
                error: null,
              }),
            };
          }),
        }),
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          insertPayloads.push({ _table: "template_versions", ...payload });
          readCallCount++;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: V1_ID },
                error: null,
              }),
            }),
          };
        }),
      };
    }

    if (table === "form_templates") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            eqCalls.push([col, val]);
            return {
              single: vi.fn().mockResolvedValue({
                data: masterTemplate,
                error: null,
              }),
            };
          }),
        }),
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          insertPayloads.push({ _table: "form_templates", ...payload });
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: FORK_ID },
                error: null,
              }),
            }),
          };
        }),
      };
    }

    return {};
  });

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ from: fromMock });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("forkAssignedTemplate — Phase 16 D-05/D-06/D-08", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSupabaseMock();

    // Re-wire redirect after clearAllMocks
    (redirect as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), {
        digest: `NEXT_REDIRECT;replace;${path}`,
        redirectPath: path,
      });
    });
  });

  async function callFork() {
    try {
      await forkAssignedTemplate(ASSIGNMENT_ID);
    } catch (err: unknown) {
      const e = err as { digest?: string; message?: string };
      // NEXT_REDIRECT is the success path — absorb it
      if (
        e?.digest?.startsWith("NEXT_REDIRECT") ||
        e?.message?.includes("NEXT_REDIRECT")
      ) {
        return; // success
      }
      throw err;
    }
  }

  // ── (a) D-05: reads pinned version by ID, NOT by template_id + latest ───────
  it("(a) reads template_versions by assignment.template_version_id (not latest published)", async () => {
    await callFork();

    // The .eq("id", MASTER_VERSION_ID) call must have been made on template_versions
    const versionPinEq = eqCalls.find(
      ([col, val]) => col === "id" && val === MASTER_VERSION_ID
    );
    expect(versionPinEq).toBeTruthy();
  });

  // ── (b) D-08: fork form_templates insert payload ──────────────────────────
  it("(b) inserts form_templates fork with owner_type=customer, owner_id=org, parent_template_id, is_published", async () => {
    await callFork();

    const forkInsert = insertPayloads.find((p) => p._table === "form_templates");
    expect(forkInsert).toBeDefined();
    expect(forkInsert).toMatchObject({
      owner_type: "customer",
      owner_id: CLIENT_ORG_ID,
      parent_template_id: MASTER_TEMPLATE_ID,
      is_published: true,
    });
  });

  // ── (c) D-05 + D-08: v1 template_versions insert payload ─────────────────
  it("(c) inserts template_versions v1 with version_number=1, published_at non-null, schema_json from pinned source", async () => {
    await callFork();

    const v1Insert = insertPayloads.find((p) => p._table === "template_versions");
    expect(v1Insert).toBeDefined();
    expect(v1Insert).toMatchObject({
      version_number: 1,
    });
    expect((v1Insert as Record<string, unknown>).published_at).not.toBeNull();
    expect((v1Insert as Record<string, unknown>).published_at).toBeTruthy();
    // schema_json must be referentially equal to the pinned source
    expect((v1Insert as Record<string, unknown>).schema_json).toBe(pinnedVersion.schema_json);
  });

  // ── (d) D-06: form_assignments is updated to point at fork ────────────────
  it("(d) updates form_assignments with template_id=fork.id, template_version_id=v1.id", async () => {
    await callFork();

    expect(updatePayload).toMatchObject({
      template_id: FORK_ID,
      template_version_id: V1_ID,
    });
    expect(updateEqIdArg).toBe(ASSIGNMENT_ID);
  });

  // ── (e) D-07: redirect to the customer template builder at
  // /client/templates/[fork.id] — there is no /edit subroute (the old
  // /edit redirect 404'd; fixed in fix(client): fork-on-fill redirect).
  it("(e) calls redirect with /client/templates/[fork.id]", async () => {
    await callFork();

    expect(redirect).toHaveBeenCalledWith(`/client/templates/${FORK_ID}`);
  });

  // ── (f) revalidatePath for both assignment + template lists ──────────────
  it("(f) calls revalidatePath for /client/assignments and /client/templates", async () => {
    await callFork();

    expect(revalidatePath).toHaveBeenCalledWith("/client/assignments");
    expect(revalidatePath).toHaveBeenCalledWith("/client/templates");
  });
});
