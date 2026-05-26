/**
 * Two-tenant seed/teardown harness for Phase 16 RLS isolation tests.
 *
 * Ported from tests/security.spec.ts seedTwoTenants (Playwright → Vitest).
 * Uses @supabase/supabase-js createClient directly — NOT the project's
 * service-role wrapper — so tests can be inspected in isolation (Pitfall 4
 * in Phase 16 RESEARCH: test harness must not bypass RLS via service-role).
 *
 * Required env vars (set in .env.test or CI secrets — never in prod):
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (used for assertion reads)
 *   SUPABASE_SERVICE_ROLE_KEY     — service role (seed/teardown only)
 *
 * Phase 16 Plan 16-01
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Constants — resolved lazily inside seedTwoTenants; no top-level side effects.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TestUser {
  email: string;
  password: string;
  authUserId: string;
  clientId: string;
  clientUserId: string;
  adminMasterTemplateId: string;
  adminMasterVersionId: string;
  assignmentId: string;
  customerTemplateId: string;
  customerTemplateVersionId: string;
  submissionId: string;
}

export interface SeedContext {
  userA: TestUser;
  userB: TestUser;
}

// ─────────────────────────────────────────────────────────────────────────────
// seedTwoTenants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provision two isolated tenants, each with:
 *   - A clients row
 *   - An auth user + client_users row
 *   - An admin master form_templates row (owner_type='admin') + published template_versions
 *   - A form_assignments row (status='pending', pinned to master version)
 *   - A customer-owned form_templates row (owner_type='customer', owner_id=clients.id) + v1
 *   - A form_submissions row (assignment_id=assignmentId, status='Draft')
 *
 * Throws a descriptive error if any env var is missing (calling spec uses
 * describe.skipIf so this throw path is only reached if the env is present
 * but somehow incomplete).
 */
export async function seedTwoTenants(): Promise<SeedContext> {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error(
      "seedTwoTenants: missing required env vars. Need NEXT_PUBLIC_SUPABASE_URL, " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();

  const provision = async (label: "a" | "b"): Promise<TestUser> => {
    const email = `rls-phase16-${label}-${stamp}@888test.invalid`;
    const password = `rls-phase16-${label}-${stamp}-${Math.random().toString(36).slice(2)}`;

    // 1. Create auth user (email_confirm: true so signInWithPassword works immediately)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(`seedTwoTenants createUser ${label}: ${createErr?.message}`);
    }
    const authUserId = created.user.id;

    // 2. Insert clients row
    const { data: clientRow, error: clientErr } = await admin
      .from("clients")
      .insert({ name: `RLS Test Tenant ${label.toUpperCase()} ${stamp}` })
      .select("id")
      .single();
    if (clientErr || !clientRow) {
      throw new Error(`seedTwoTenants insert client ${label}: ${clientErr?.message}`);
    }
    const clientId = clientRow.id as string;

    // 3. Insert client_users row (linking auth user → client org)
    const { error: cuErr } = await admin
      .from("client_users")
      .insert({ id: authUserId, client_id: clientId, name: `Tenant ${label.toUpperCase()}`, email, role: "client" });
    if (cuErr) {
      throw new Error(`seedTwoTenants insert client_user ${label}: ${cuErr.message}`);
    }

    // 4. Insert admin master form_templates row
    //    owner_id is nullable (migration 001 line 50); no admin_users row needed for test.
    //    owner_type='admin' makes it visible to all authenticated clients via
    //    form_templates_client_published when is_published=true.
    const { data: masterTemplate, error: mtErr } = await admin
      .from("form_templates")
      .insert({
        name: `RLS Master Template ${label.toUpperCase()} ${stamp}`,
        template_type: "fra",
        owner_type: "admin",
        owner_id: null,
        is_published: true,
      })
      .select("id")
      .single();
    if (mtErr || !masterTemplate) {
      throw new Error(`seedTwoTenants insert admin master template ${label}: ${mtErr?.message}`);
    }
    const adminMasterTemplateId = masterTemplate.id as string;

    // 5. Insert published template_versions row for the admin master
    //    created_by FK was dropped in migration 005 (polymorphic) — any UUID is valid.
    const { data: masterVersion, error: mvErr } = await admin
      .from("template_versions")
      .insert({
        template_id: adminMasterTemplateId,
        version_number: 1,
        schema_json: { entities: {}, root: { children: [] } },
        published_at: new Date().toISOString(),
        created_by: null,
      })
      .select("id")
      .single();
    if (mvErr || !masterVersion) {
      throw new Error(`seedTwoTenants insert master template_version ${label}: ${mvErr?.message}`);
    }
    const adminMasterVersionId = masterVersion.id as string;

    // 6. Insert form_assignments row (status='pending')
    //    assigned_by references admin_users(id) — nullable, so NULL is valid for test.
    const { data: assignment, error: assignErr } = await admin
      .from("form_assignments")
      .insert({
        client_id: clientId,
        template_id: adminMasterTemplateId,
        template_version_id: adminMasterVersionId,
        assigned_by: null,
        status: "pending",
      })
      .select("id")
      .single();
    if (assignErr || !assignment) {
      throw new Error(`seedTwoTenants insert form_assignment ${label}: ${assignErr?.message}`);
    }
    const assignmentId = assignment.id as string;

    // 7. Insert customer-owned form_templates row
    //    owner_type='customer', owner_id=clients.id (org, not user — per AGENTS.md)
    const { data: customerTemplate, error: ctErr } = await admin
      .from("form_templates")
      .insert({
        name: `rls-customer-${label.toUpperCase()}-${stamp}`,
        template_type: "fra",
        owner_type: "customer",
        owner_id: clientId,
        is_published: true,
      })
      .select("id")
      .single();
    if (ctErr || !customerTemplate) {
      throw new Error(`seedTwoTenants insert customer template ${label}: ${ctErr?.message}`);
    }
    const customerTemplateId = customerTemplate.id as string;

    // 8. Insert published template_versions for customer-owned template (v1)
    const { data: customerVersion, error: cvErr } = await admin
      .from("template_versions")
      .insert({
        template_id: customerTemplateId,
        version_number: 1,
        schema_json: { entities: {}, root: { children: [] } },
        published_at: new Date().toISOString(),
        created_by: null,
      })
      .select("id")
      .single();
    if (cvErr || !customerVersion) {
      throw new Error(`seedTwoTenants insert customer template_version ${label}: ${cvErr?.message}`);
    }
    const customerTemplateVersionId = customerVersion.id as string;

    // 9. Insert form_submissions row
    //    Uses the admin assignment so assignment_id is NOT NULL (standard flow)
    const { data: submission, error: subErr } = await admin
      .from("form_submissions")
      .insert({
        assignment_id: assignmentId,
        client_id: clientId,
        template_version_id: adminMasterVersionId,
        answers_json: {},
        status: "Draft",
      })
      .select("id")
      .single();
    if (subErr || !submission) {
      throw new Error(`seedTwoTenants insert form_submission ${label}: ${subErr?.message}`);
    }
    const submissionId = submission.id as string;

    return {
      email,
      password,
      authUserId,
      clientId,
      clientUserId: authUserId,
      adminMasterTemplateId,
      adminMasterVersionId,
      assignmentId,
      customerTemplateId,
      customerTemplateVersionId,
      submissionId,
    };
  };

  const userA = await provision("a");
  const userB = await provision("b");
  return { userA, userB };
}

// ─────────────────────────────────────────────────────────────────────────────
// teardown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reverse-order delete of all rows seeded by seedTwoTenants.
 * Logs but does not throw on individual delete errors (defensive teardown).
 */
export async function teardown(ctx: SeedContext): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("teardown: SUPABASE_URL and SERVICE_ROLE_KEY must be set");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const u of [ctx.userA, ctx.userB]) {
    // 1. form_submissions
    const { error: subDelErr } = await admin.from("form_submissions").delete().eq("id", u.submissionId);
    if (subDelErr) console.error(`teardown form_submissions ${u.email}:`, subDelErr.message);

    // 2. form_assignments
    const { error: assignDelErr } = await admin.from("form_assignments").delete().eq("id", u.assignmentId);
    if (assignDelErr) console.error(`teardown form_assignments ${u.email}:`, assignDelErr.message);

    // 3. customer template_versions
    const { error: cvDelErr } = await admin.from("template_versions").delete().eq("id", u.customerTemplateVersionId);
    if (cvDelErr) console.error(`teardown customer template_versions ${u.email}:`, cvDelErr.message);

    // 4. admin master template_versions
    const { error: mvDelErr } = await admin.from("template_versions").delete().eq("id", u.adminMasterVersionId);
    if (mvDelErr) console.error(`teardown admin master template_versions ${u.email}:`, mvDelErr.message);

    // 5. customer form_templates
    const { error: ctDelErr } = await admin.from("form_templates").delete().eq("id", u.customerTemplateId);
    if (ctDelErr) console.error(`teardown customer form_templates ${u.email}:`, ctDelErr.message);

    // 6. admin master form_templates
    const { error: mtDelErr } = await admin.from("form_templates").delete().eq("id", u.adminMasterTemplateId);
    if (mtDelErr) console.error(`teardown admin master form_templates ${u.email}:`, mtDelErr.message);

    // 7. client_users
    const { error: cuDelErr } = await admin.from("client_users").delete().eq("id", u.authUserId);
    if (cuDelErr) console.error(`teardown client_users ${u.email}:`, cuDelErr.message);

    // 8. clients
    const { error: clientDelErr } = await admin.from("clients").delete().eq("id", u.clientId);
    if (clientDelErr) console.error(`teardown clients ${u.email}:`, clientDelErr.message);

    // 9. auth user
    const { error: authDelErr } = await admin.auth.admin.deleteUser(u.authUserId);
    if (authDelErr) console.error(`teardown deleteUser ${u.email}:`, authDelErr.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// signedInClientFor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an anon Supabase client signed in as the given test user.
 * NEVER uses service-role — this exercises real RLS policies (Pitfall 4).
 */
export async function signedInClientFor(user: TestUser): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error("signedInClientFor: SUPABASE_URL and ANON_KEY must be set");
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`signedInClientFor ${user.email}: ${error.message}`);
  }

  return client;
}
