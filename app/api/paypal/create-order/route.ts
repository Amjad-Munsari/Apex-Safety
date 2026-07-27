import { NextRequest, NextResponse } from "next/server"

import { getClientContext } from "@/lib/auth-helpers"
import {
  getPackage,
  formatPayPalAmount,
  packageDescription,
  PAYPAL_CURRENCY,
} from "@/lib/billing/packages"
import {
  createPayPalOrder,
  isPayPalEnabled,
  recordPayPalPendingCheckout,
} from "@/lib/paypal"
import { getSiteUrl } from "@/lib/site-url"
import { logAppError } from "@/lib/observability/log"

// Buffer + PayPal SDK-free fetch live in the Node runtime.
export const runtime = "nodejs"

/**
 * POST /api/paypal/create-order
 *
 * Body: { packageId: "20c" | "40c" | "80c" }
 *
 * Auth: the caller must be a logged-in client. The amount is derived
 * server-side from the package catalogue — the browser never names a price.
 * Returns { orderId, approveUrl } so the client can redirect to PayPal.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isPayPalEnabled())) {
    return NextResponse.json({ error: "payments_disabled" }, { status: 403 })
  }

  const ctx = await getClientContext()
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let packageId: unknown
  try {
    const body = await req.json()
    packageId = (body as { packageId?: unknown })?.packageId
  } catch {
    packageId = undefined
  }

  const pkg = typeof packageId === "string" ? getPackage(packageId) : undefined
  if (!pkg) {
    return NextResponse.json({ error: "invalid_package" }, { status: 400 })
  }

  // Clean redirect URLs: PayPal appends its own ?token=…&PayerID=… on return
  // (PayerID present) and ?token=… on cancel (PayerID absent). The billing page
  // distinguishes the two by PayerID presence, so we must NOT pre-set a query
  // string here (it would collide with PayPal's append).
  const base = getSiteUrl()
  const redirectUrl = `${base}/client/billing`
  try {
    const { id, approveUrl, configVersion, mode } = await createPayPalOrder({
      amount: formatPayPalAmount(pkg.priceGBP),
      currency: PAYPAL_CURRENCY,
      description: packageDescription(pkg),
      referenceId: pkg.id,
      customId: ctx.client_id,
      returnUrl: redirectUrl,
      cancelUrl: redirectUrl,
    })
    // An approval URL is not returned until its credential version is pinned.
    // That keeps a later key rotation from stranding this checkout at capture.
    await recordPayPalPendingCheckout({
      orderId: id,
      clientId: ctx.client_id,
      packageId: pkg.id,
      configVersion,
      mode,
    })
    return NextResponse.json({ orderId: id, approveUrl }, { status: 200 })
  } catch (err) {
    await logAppError({
      area: "paypal.create_order",
      source: "route",
      error: err,
      actorType: "client",
      clientId: ctx.client_id,
      context: { packageId: pkg?.id },
    })
    return NextResponse.json({ error: "order_creation_failed" }, { status: 500 })
  }
}
