/**
 * Pure hours⇄credits conversion for the retained-balance model.
 * No I/O — safe to import in both the browser bundle and server code.
 */

/**
 * Convert an hours amount to whole credits at the given reference rate.
 *
 * Rounds the POSITIVE magnitude to the nearest whole credit and then reapplies
 * the sign, so +1.5h and −1.5h stay symmetric at odd rates (e.g. rate 5 →
 * +8 / −8, not +8 / −7 as a naive Math.round(-7.5) would give). Balances are
 * stored as integers, so a fractional-hours convenience input must always land
 * on a whole credit.
 */
export function hoursToCredits(hours: number, rate: number): number {
  const credits = Math.round(Math.abs(hours) * rate)
  return hours < 0 ? -credits : credits
}
