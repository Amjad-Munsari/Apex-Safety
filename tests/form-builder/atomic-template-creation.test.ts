import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const rpc = vi.fn()
  return {
    rpc,
    createClient: vi.fn(async () => ({ rpc })),
    getClientContext: vi.fn(),
    isAdmin: vi.fn(),
    requireActorUserId: vi.fn(),
    assertClientActive: vi.fn(),
    dispatchClientFormEvent: vi.fn(),
    revalidatePath: vi.fn(),
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}))

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: mocks.getClientContext,
  isAdmin: mocks.isAdmin,
  requireActorUserId: mocks.requireActorUserId,
}))

vi.mock("@/lib/clients/require-active", () => ({
  assertClientActive: mocks.assertClientActive,
}))

vi.mock("@/lib/notifications/client-form-events", () => ({
  dispatchClientFormEvent: mocks.dispatchClientFormEvent,
}))

vi.mock("@/lib/reports/report-draft", () => ({
  scheduleReportDraftGeneration: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

describe("atomic template creation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getClientContext.mockResolvedValue({
      client_id: "client-org-1",
      client_name: "Hallam House Care Home",
      role: "admin",
    })
    mocks.isAdmin.mockResolvedValue(true)
    mocks.assertClientActive.mockResolvedValue(undefined)
    mocks.dispatchClientFormEvent.mockResolvedValue(undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates a customer template through the atomic RPC before dispatching its event", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "customer-template-1", error: null })
    const { createClientTemplate } = await import(
      "@/app/client/templates/actions"
    )

    const result = await createClientTemplate("  Daily Fire Door Check  ")

    expect(result).toEqual({ ok: true, id: "customer-template-1" })
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_customer_template_with_initial_version",
      {
        p_name: "Daily Fire Door Check",
        p_client_id: "client-org-1",
      }
    )
    expect(mocks.dispatchClientFormEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "client_form_created",
        template_id: "customer-template-1",
        template_name: "Daily Fire Door Check",
      })
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/client/templates")
  })

  it("reports a customer RPC failure without sending a notice or claiming success", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "version insert failed" },
    })
    const { createClientTemplate } = await import(
      "@/app/client/templates/actions"
    )

    const result = await createClientTemplate("Daily Fire Door Check")

    expect(result).toEqual({
      ok: false,
      error: "Could not create the template. Nothing was saved.",
    })
    expect(mocks.dispatchClientFormEvent).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("rejects invalid customer names before reaching the database", async () => {
    const { createClientTemplate } = await import(
      "@/app/client/templates/actions"
    )

    await expect(createClientTemplate("   ")).resolves.toEqual({
      ok: false,
      error: "Enter a template name between 1 and 160 characters.",
    })
    await expect(createClientTemplate("x".repeat(161))).resolves.toEqual({
      ok: false,
      error: "Enter a template name between 1 and 160 characters.",
    })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("creates an admin template through its atomic RPC", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "admin-template-1", error: null })
    const { createTemplate } = await import("@/app/admin/templates/actions")

    const result = await createTemplate("  FRA Type 3  ", "fra")

    expect(result).toEqual({ ok: true, id: "admin-template-1" })
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_admin_template_with_initial_version",
      {
        p_name: "FRA Type 3",
        p_template_type: "fra",
      }
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/templates")
  })

  it("reports an admin RPC failure without claiming success", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "insert denied" },
    })
    const { createTemplate } = await import("@/app/admin/templates/actions")

    const result = await createTemplate("FRA Type 3", "fra")

    expect(result).toEqual({
      ok: false,
      error: "Could not create the template. Nothing was saved.",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})

describe("atomic template creation migration", () => {
  const migration = readFileSync(
    "supabase/migrations/035_atomic_template_creation.sql",
    "utf8"
  )

  it("creates each template and version 1 inside a security-invoker function", () => {
    expect(
      migration.match(/security invoker/gi)
    ).toHaveLength(2)
    expect(
      migration.match(/insert into public\.form_templates/gi)
    ).toHaveLength(2)
    expect(
      migration.match(/insert into public\.template_versions/gi)
    ).toHaveLength(2)
    expect(migration).toMatch(/version_number,[\s\S]*values \([\s\S]*\n\s*1,/i)
  })

  it("keeps the customer caller tenant-bound and both RPCs unavailable to anon", () => {
    expect(migration).toMatch(/cu\.id = v_user_id/i)
    expect(migration).toMatch(/cu\.client_id = p_client_id/i)
    expect(migration).toMatch(/c\.active = true/i)
    expect(migration).toMatch(/c\.deleted_at is null/i)
    expect(migration).toMatch(
      /revoke all on function public\.create_customer_template_with_initial_version[\s\S]*from public, anon, authenticated/i
    )
    expect(migration).toMatch(
      /grant execute on function public\.create_customer_template_with_initial_version[\s\S]*to authenticated, service_role/i
    )
    expect(migration).toMatch(
      /grant execute on function public\.create_admin_template_with_initial_version[\s\S]*to authenticated/i
    )
  })
})
