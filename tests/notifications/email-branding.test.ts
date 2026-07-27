// The saved sender / sign-off names from admin Settings must actually change
// outgoing email. They persisted and did nothing for months — Matt would edit
// them, see no difference, and reasonably conclude the platform was broken.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

describe("composeFrom — saved sender name in the From header", () => {
  beforeEach(() => vi.unstubAllEnvs())
  afterEach(() => vi.unstubAllEnvs())

  it("replaces only the display name, keeping the verified-domain address", async () => {
    vi.stubEnv("EMAIL_FROM", "Merlin Safety System <notifications@merlinsafetysystem.com>")
    const { composeFrom } = await import("@/lib/notifications/resend")
    expect(composeFrom("888 Safety & Training")).toBe(
      "888 Safety & Training <notifications@merlinsafetysystem.com>"
    )
  })

  it("falls back to the env value verbatim when no name is saved", async () => {
    vi.stubEnv("EMAIL_FROM", "Merlin Safety System <notifications@merlinsafetysystem.com>")
    const { composeFrom } = await import("@/lib/notifications/resend")
    expect(composeFrom(null)).toBe("Merlin Safety System <notifications@merlinsafetysystem.com>")
    expect(composeFrom("   ")).toBe("Merlin Safety System <notifications@merlinsafetysystem.com>")
  })

  it("cannot smuggle a different address or header via the saved name", async () => {
    vi.stubEnv("EMAIL_FROM", "Merlin Safety System <notifications@merlinsafetysystem.com>")
    const { composeFrom } = await import("@/lib/notifications/resend")
    const from = composeFrom('Evil <attacker@evil.example>\r\nBcc: x@y.z')
    expect(from).toContain("<notifications@merlinsafetysystem.com>")
    expect(from).not.toContain("attacker@evil.example>")
    expect(from).not.toContain("\r")
  })
})

describe("buildEmail — saved sign-off in the body", () => {
  it("renders the saved sign-off name under the body", async () => {
    const { buildEmail } = await import("@/lib/notifications/email-templates")
    const built = buildEmail(
      {
        type: "proposal_signed",
        client_name: "Acme Ltd",
        client_email: "contact@acme.example",
        proposal_title: "Fire Risk Assessment",
        signed_at: "2026-07-27T10:00:00Z",
      },
      { signOffName: "Matt Robinson" }
    )
    expect(built?.html).toContain("Kind regards,")
    expect(built?.html).toContain("Matt Robinson")
  })

  it("omits the sign-off block when no name is available", async () => {
    const { buildEmail } = await import("@/lib/notifications/email-templates")
    const built = buildEmail(
      {
        type: "proposal_signed",
        client_name: "Acme Ltd",
        client_email: "contact@acme.example",
        proposal_title: "Fire Risk Assessment",
        signed_at: "2026-07-27T10:00:00Z",
      },
      { signOffName: null }
    )
    expect(built?.html).not.toContain("Kind regards,")
  })

  it("escapes a sign-off containing markup", async () => {
    const { buildEmail } = await import("@/lib/notifications/email-templates")
    const built = buildEmail(
      {
        type: "proposal_signed",
        client_name: "Acme Ltd",
        client_email: "contact@acme.example",
        proposal_title: "Fire Risk Assessment",
        signed_at: "2026-07-27T10:00:00Z",
      },
      { signOffName: "<img src=x onerror=alert(1)>" }
    )
    expect(built?.html).not.toContain("<img src=x")
  })
})
