import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdminSpy = vi.fn()
const updateSpy = vi.fn()
const maybeSingleSpy = vi.fn()

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminSpy(...args),
  isAdmin: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table !== "clients") return {}
      return {
        update: (patch: Record<string, unknown>) => {
          updateSpy(patch)
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: () => maybeSingleSpy(),
              }),
            }),
          }
        },
      }
    },
  },
}))

import { updateClientProfile } from "@/app/admin/clients/actions"

describe("updateClientProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminSpy.mockResolvedValue("admin-id")
    maybeSingleSpy.mockResolvedValue({
      data: { id: "client-id" },
      error: null,
    })
  })

  it("updates every editable organisation and contact field", async () => {
    await expect(
      updateClientProfile("client-id", {
        name: "  Hallam House Care Home ",
        contactName: " Sarah Whitfield ",
        contactEmail: " sarah@example.com ",
        contactPhone: " 0114 000 0000 ",
        siteAddress: " Sheffield ",
      })
    ).resolves.toEqual({ ok: true })

    expect(updateSpy).toHaveBeenCalledWith({
      name: "Hallam House Care Home",
      contact_name: "Sarah Whitfield",
      contact_email: "sarah@example.com",
      contact_phone: "0114 000 0000",
      site_address: "Sheffield",
    })
  })

  it("rejects an invalid email before writing", async () => {
    await expect(
      updateClientProfile("client-id", {
        name: "Hallam House",
        contactEmail: "not-an-email",
      })
    ).resolves.toEqual({
      ok: false,
      error: "Enter a valid contact email address.",
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("requires an admin before any write", async () => {
    requireAdminSpy.mockRejectedValueOnce(new Error("Unauthorized"))
    await expect(
      updateClientProfile("client-id", { name: "Hallam House" })
    ).rejects.toThrow("Unauthorized")
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
