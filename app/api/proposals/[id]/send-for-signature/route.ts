import { NextRequest, NextResponse } from "next/server"

import { sendProposalForSignature } from "@/app/admin/proposals/actions"
import { SendProposalError } from "@/lib/proposals/send-errors"
import { logAppError } from "@/lib/observability/log"

// ── Types ────────────────────────────────────────────────────────────────────

type RouteContext = {
  params: Promise<{ id: string }>
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params

  try {
    const { signing_url, deliveryEmailFailed } = await sendProposalForSignature(id)
    return NextResponse.json({
      success: true,
      signing_url,
      delivery_email_failed: deliveryEmailFailed,
    })
  } catch (err) {
    // Map SendProposalError codes to the same HTTP responses the route used
    // to return directly, so external contracts (tests, clients) are unchanged.
    if (err instanceof SendProposalError) {
      switch (err.code) {
        case "not_found":
          return NextResponse.json({ error: "not_found" }, { status: 404 })
        case "already_finalised":
          return NextResponse.json({ error: "already_finalised" }, { status: 409 })
        case "no_pdf":
          return NextResponse.json(
            { error: "no_pdf", message: "PDF must be generated before sending for signature." },
            { status: 400 }
          )
        case "no_client_email":
          return NextResponse.json({ error: "no_client_email" }, { status: 400 })
      }
    }

    // requireAdmin() rejects with "Unauthorized" on auth failure
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Genuinely unexpected failures are server errors — reporting them as 401
    // hides real faults behind an auth story (auth failures are caught above).
    await logAppError({
      area: "proposals.send_for_signature",
      source: "route",
      error: err,
      actorType: "admin",
    })
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
