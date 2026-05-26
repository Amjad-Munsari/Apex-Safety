/**
 * RLS isolation suite — cross-org data bleed prevention (Phase 16 D-15).
 *
 * Verifies that a signed-in client user from Org A cannot read data rows
 * belonging to Org B for the four tables Phase 16 builds on:
 *   form_templates, template_versions, form_submissions, form_assignments
 *
 * Pattern:
 *   - 4 negative assertions: Client A queries with B's IDs → expect([])
 *   - 1 positive control: Client A queries own org → expect length >= 1
 *
 * The positive control is critical (Phase 16 RESEARCH Threat T-16-08):
 * if seedTwoTenants silently failed to insert tenant A's rows, all four
 * negative tests would pass vacuously. The positive control fails loudly
 * if A's seed is missing.
 *
 * Required env vars (absent → describe.skipIf skips this suite entirely):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Phase 16 Plan 16-01
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  seedTwoTenants,
  teardown,
  signedInClientFor,
  type SeedContext,
} from "./helpers/seed-two-tenants";

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

describe.skipIf(!hasEnv)("RLS — cross-org isolation (Phase 16)", () => {
  let ctx: SeedContext;

  beforeAll(async () => {
    ctx = await seedTwoTenants();
  });

  afterAll(async () => {
    if (ctx) await teardown(ctx);
  });

  // ── Negative: form_templates ──────────────────────────────────────────────

  it("Client A cannot read Client B's customer-owned form_templates", async () => {
    const clientA = await signedInClientFor(ctx.userA);
    const { data, error } = await clientA
      .from("form_templates")
      .select("id")
      .eq("owner_id", ctx.userB.clientId)
      .eq("owner_type", "customer");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // ── Negative: template_versions ──────────────────────────────────────────

  it("Client A cannot read Client B's customer template_versions by id", async () => {
    const clientA = await signedInClientFor(ctx.userA);
    const { data, error } = await clientA
      .from("template_versions")
      .select("id")
      .eq("id", ctx.userB.customerTemplateVersionId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // ── Negative: form_submissions ────────────────────────────────────────────

  it("Client A cannot read Client B's form_submissions by client_id", async () => {
    const clientA = await signedInClientFor(ctx.userA);
    const { data, error } = await clientA
      .from("form_submissions")
      .select("id")
      .eq("client_id", ctx.userB.clientId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // ── Negative: form_assignments ────────────────────────────────────────────

  it("Client A cannot read Client B's form_assignments by client_id", async () => {
    const clientA = await signedInClientFor(ctx.userA);
    const { data, error } = await clientA
      .from("form_assignments")
      .select("id")
      .eq("client_id", ctx.userB.clientId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // ── Positive control: own-org form_assignments ────────────────────────────

  it("Client A CAN read own-org form_assignments (positive control)", async () => {
    const clientA = await signedInClientFor(ctx.userA);
    const { data, error } = await clientA
      .from("form_assignments")
      .select("id")
      .eq("client_id", ctx.userA.clientId);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});
