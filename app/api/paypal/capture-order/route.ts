import { NextRequest, NextResponse } from "next/server"

import { getClientContext } from "@/lib/auth-helpers"
import { formatPayPalAmount, getPackage, PAYPAL_CURRENCY } from "@/lib/billing/packages"
import {
  capturePayPalOrder,
  getPayPalOrder,
  isPayPalEnabled,
  type PayPalOrderPayload,
} from "@/lib/paypal"
import { adminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// ── Helpers ──────────────────────────────────────────────────────────────────

/** True when a PayPal error payload says the order was already captured. */
function isAlreadyCaptured(payload: PayPalOrderPayload): boolean {
  const details = (payload as { details?: { issue?: string }[] }).details
  return Array.isArray(details) && details.some((d) => d?.issue === "ORDER_ALREADY_CAPTURED")
}

interface CapturedUnit {
  referenceId?: string
  customId?: string
  amountValue?: string
  amountCurrency?: string
}

/** Pulls the binding ids + captured amount out of a capture/order payload. */
function extractUnit(payload: PayPalOrderPayload): CapturedUnit {
  const pu = (payload as {
    purchase_units?: Array<{
      reference_id?: string
      custom_id?: string
      amount?: { value?: string; currency_code?: string }
      payments?: { captures?: Array<{ amount?: { value?: string; currency_code?: string } }> }
    }>
  }).purchase_units?.[0]
  const amount = pu?.payments?.captures?.[0]?.amount ?? pu?.amount
  return {
    referenceId: pu?.reference_id,
    customId: pu?.custom_id,
    amountValue: amount?.value,
    amountCurrency: amount?.currency_code,
  }
}

async function currentBalance(clientId: string): Promise<number | null> {
  const { data } = await adminClient
    .from("clients")
    .select("hours_balance")
    .eq("id", clientId)
    .single()
  return data?.hours_balance ?? null
}

// ── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/paypal/capture-order
 *
 * Body: { orderId: string }
 *
 * Captures an approved order and credits the buyer's hours balance via the
 * atomic credit_hours_from_paypal RPC. Idempotent on three levels:
 *  1. a pre-check against hours_transactions.paypal_order_id (already credited),
 *  2. recovery from PayPal's ORDER_ALREADY_CAPTURED (captured but not yet
 *     credited — e.g. a prior DB write failed), and
 *  3. the UNIQUE constraint on paypal_order_id (concurrent capture race).
 *
 * Security: the captured amount and the order's custom_id (buyer client_id) are
 * re-verified against the package catalogue before any credit, so a tampered or
 * cross-client order is rejected.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isPayPalEnabled()) {
    return NextResponse.json({ error: "payments_disabled" }, { status: 403 })
  }

  const ctx = await getClientContext()
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let orderId: unknown
  try {
    const body = await req.json()
    orderId = (body as { orderId?: unknown })?.orderId
  } catch {
    orderId = undefined
  }
  if (typeof orderId !== "string" || orderId.length === 0) {
    return NextResponse.json({ error: "missing_order_id" }, { status: 400 })
  }

  // 1. Idempotency pre-check — has this order already been credited?
  const { data: existing } = await adminClient
    .from("hours_transactions")
    .select("id, client_id")
    .eq("paypal_order_id", orderId)
    .maybeSingle()

  if (existing) {
    if (existing.client_id !== ctx.client_id) {
      // Order belongs to another client — don't touch it.
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    return NextResponse.json({
      success: true,
      balance: await currentBalance(ctx.client_id),
      alreadyProcessed: true,
    })
  }

  // 2. Capture at PayPal (recovering from an already-captured order).
  let payload = await capturePayPalOrder(orderId)
  let completed = (payload as { status?: string }).status === "COMPLETED"
  if (!completed && isAlreadyCaptured(payload)) {
    payload = await getPayPalOrder(orderId)
    completed = (payload as { status?: string }).status === "COMPLETED"
  }
  if (!completed) {
    console.error("[paypal/capture-order] capture did not complete:", payload)
    return NextResponse.json({ error: "capture_failed" }, { status: 502 })
  }

  // 3. Verify the order belongs to the caller and matches a known package price.
  const unit = extractUnit(payload)
  if (unit.customId !== ctx.client_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const pkg = unit.referenceId ? getPackage(unit.referenceId) : undefined
  if (!pkg) {
    return NextResponse.json({ error: "invalid_package" }, { status: 400 })
  }
  if (
    unit.amountCurrency !== PAYPAL_CURRENCY ||
    unit.amountValue !== formatPayPalAmount(pkg.priceGBP)
  ) {
    console.error("[paypal/capture-order] amount mismatch", {
      expected: formatPayPalAmount(pkg.priceGBP),
      got: unit.amountValue,
      currency: unit.amountCurrency,
    })
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 })
  }

  // 4. Credit atomically (insert ledger row + bump balance) via the RPC.
  const { error: rpcError } = await adminClient.rpc("credit_hours_from_paypal", {
    p_client_id: ctx.client_id,
    p_order_id: orderId,
    p_hours: pkg.hours,
    p_gbp: pkg.priceGBP,
  })

  // UNIQUE violation on paypal_order_id = a concurrent request already credited.
  // Treat as success rather than double-charging the customer's balance.
  if (rpcError && rpcError.code !== "23505") {
    console.error("[paypal/capture-order] credit RPC failed:", rpcError)
    return NextResponse.json({ error: "credit_failed" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    balance: await currentBalance(ctx.client_id),
    hours: pkg.hours,
  })
}
