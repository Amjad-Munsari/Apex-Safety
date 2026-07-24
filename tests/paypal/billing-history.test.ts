import { describe, it, expect } from "vitest"
import {
  formatTxDate,
  toTransactionView,
  deriveBillingSummary,
  type HoursTransactionRow,
} from "@/lib/billing/history"

function row(partial: Partial<HoursTransactionRow>): HoursTransactionRow {
  return {
    id: "tx",
    created_at: "2026-04-10T09:00:00Z",
    transaction_type: "purchase",
    hours_amount: 20,
    gbp_amount: 495,
    notes: null,
    paypal_order_id: "ORDER1",
    ...partial,
  }
}

describe("formatTxDate", () => {
  it("renders a UTC day/month/year label", () => {
    expect(formatTxDate("2026-04-10T09:00:00Z")).toBe("10 Apr 2026")
    expect(formatTxDate("2026-12-01T23:59:59Z")).toBe("01 Dec 2026")
  })
})

describe("toTransactionView", () => {
  it("labels a PayPal purchase", () => {
    const v = toTransactionView(row({ transaction_type: "purchase", hours_amount: 20, gbp_amount: 495 }))
    expect(v).toMatchObject({ title: "Credit purchase", hoursAmount: 20, gbpAmount: 495, dateLabel: "10 Apr 2026" })
  })

  it("labels a positive manual adjustment as a top-up", () => {
    const v = toTransactionView(row({ transaction_type: "manual_adjustment", hours_amount: 8, gbp_amount: null }))
    expect(v.title).toBe("Account top-up")
    expect(v.hoursAmount).toBe(8)
  })

  it("labels a negative manual adjustment / drawdown as credits used", () => {
    const v = toTransactionView(row({ transaction_type: "manual_adjustment", hours_amount: -6, gbp_amount: null }))
    expect(v.title).toBe("Credits used")
    expect(v.hoursAmount).toBe(-6)
  })

  it("falls back to notes for unknown types", () => {
    const v = toTransactionView(row({ transaction_type: "weird", hours_amount: -4, notes: "Site visit — Tower A" }))
    expect(v.title).toBe("Site visit — Tower A")
  })
})

describe("deriveBillingSummary", () => {
  const now = "2026-06-30T12:00:00Z"

  it("sums absolute credits used in the current year only", () => {
    const rows = [
      row({ id: "a", hours_amount: -8, transaction_type: "usage", created_at: "2026-02-01T00:00:00Z" }),
      row({ id: "b", hours_amount: -6, transaction_type: "usage", created_at: "2026-05-01T00:00:00Z" }),
      row({ id: "c", hours_amount: -36, transaction_type: "usage", created_at: "2025-12-31T00:00:00Z" }), // prior year
      row({ id: "d", hours_amount: 20, transaction_type: "purchase", created_at: "2026-04-10T00:00:00Z" }), // credit, ignored
    ]
    const s = deriveBillingSummary(rows, now)
    expect(s.usedThisYearCredits).toBe(14)
  })

  it("picks the most recent positive (credit) transaction as the last top-up", () => {
    const rows = [
      row({ id: "a", hours_amount: 20, created_at: "2026-04-10T00:00:00Z" }),
      row({ id: "b", hours_amount: 40, created_at: "2026-06-12T00:00:00Z" }),
      row({ id: "c", hours_amount: -4, created_at: "2026-06-20T00:00:00Z" }), // usage, not a top-up
    ]
    const s = deriveBillingSummary(rows, now)
    expect(s.lastTopUpLabel).toBe("12 Jun")
  })

  it("returns null last top-up and zero usage when there are no transactions", () => {
    const s = deriveBillingSummary([], now)
    expect(s.lastTopUpLabel).toBeNull()
    expect(s.usedThisYearCredits).toBe(0)
  })
})
