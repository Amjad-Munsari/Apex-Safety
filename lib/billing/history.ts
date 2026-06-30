/**
 * Pure presentation helpers for the client billing page's hours ledger.
 * No I/O — the server component fetches rows, these shape them for display.
 */

export interface HoursTransactionRow {
  id: string
  created_at: string
  transaction_type: string
  hours_amount: number
  gbp_amount: number | null
  notes: string | null
  paypal_order_id: string | null
}

export interface TransactionView {
  id: string
  /** e.g. "10 Apr 2026" */
  dateLabel: string
  title: string
  /** Signed hours movement (+5, -1.5). */
  hoursAmount: number
  gbpAmount: number | null
}

export interface BillingSummary {
  /** Total hours drawn down in the current calendar year (absolute). */
  usedThisYearHours: number
  /** Short "10 Apr" label of the most recent credit, or null. */
  lastTopUpLabel: string | null
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** Renders an ISO timestamp as a UTC "10 Apr 2026" label (timezone-stable). */
export function formatTxDate(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${day} ${MONTHS[d.getUTCMonth()]}`
}

function titleFor(row: HoursTransactionRow): string {
  switch (row.transaction_type) {
    case "purchase":
      return "Hours purchase"
    case "manual_adjustment":
      return row.hours_amount >= 0 ? "Account top-up" : "Hours used"
    case "usage":
    case "deduction":
      return "Hours used"
    default:
      return row.notes ?? row.transaction_type
  }
}

export function toTransactionView(row: HoursTransactionRow): TransactionView {
  return {
    id: row.id,
    dateLabel: formatTxDate(row.created_at),
    title: titleFor(row),
    hoursAmount: row.hours_amount,
    gbpAmount: row.gbp_amount,
  }
}

export function deriveBillingSummary(
  rows: HoursTransactionRow[],
  nowIso: string
): BillingSummary {
  const nowYear = new Date(nowIso).getUTCFullYear()

  const usedThisYearHours = rows.reduce((sum, r) => {
    if (r.hours_amount < 0 && new Date(r.created_at).getUTCFullYear() === nowYear) {
      return sum + Math.abs(r.hours_amount)
    }
    return sum
  }, 0)

  // Rows arrive newest-first from the query, but don't rely on it: scan for the
  // most recent positive (credit) movement.
  let lastTopUp: HoursTransactionRow | null = null
  for (const r of rows) {
    if (r.hours_amount > 0) {
      if (!lastTopUp || new Date(r.created_at) > new Date(lastTopUp.created_at)) {
        lastTopUp = r
      }
    }
  }

  return {
    usedThisYearHours: Math.round(usedThisYearHours * 100) / 100,
    lastTopUpLabel: lastTopUp ? shortDate(lastTopUp.created_at) : null,
  }
}
