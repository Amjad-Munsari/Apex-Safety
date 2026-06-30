import { describe, it, expect } from "vitest"
import {
  HOURS_PACKAGES,
  getPackage,
  formatPayPalAmount,
  packageDescription,
  PAYPAL_CURRENCY,
} from "@/lib/billing/packages"

describe("HOURS_PACKAGES", () => {
  it("defines exactly the three packages from the spec, keyed 5h/10h/20h", () => {
    expect(HOURS_PACKAGES.map((p) => p.id)).toEqual(["5h", "10h", "20h"])
  })

  it("matches the spec hours and GBP prices", () => {
    expect(getPackage("5h")).toMatchObject({ hours: 5, priceGBP: 495 })
    expect(getPackage("10h")).toMatchObject({ hours: 10, priceGBP: 950 })
    expect(getPackage("20h")).toMatchObject({ hours: 20, priceGBP: 1800 })
  })
})

describe("getPackage", () => {
  it("returns undefined for an unknown id (tamper guard)", () => {
    expect(getPackage("999h")).toBeUndefined()
    expect(getPackage("")).toBeUndefined()
    expect(getPackage("5H")).toBeUndefined()
  })
})

describe("formatPayPalAmount", () => {
  it("renders integer pounds as a 2-decimal string PayPal accepts", () => {
    expect(formatPayPalAmount(495)).toBe("495.00")
    expect(formatPayPalAmount(950)).toBe("950.00")
    expect(formatPayPalAmount(1800)).toBe("1800.00")
  })
})

describe("packageDescription", () => {
  it("renders the 888 Safety purchase_unit description", () => {
    expect(packageDescription(getPackage("5h")!)).toBe("888 Safety — 5 Consulting Hours")
    expect(packageDescription(getPackage("20h")!)).toBe("888 Safety — 20 Consulting Hours")
  })
})

describe("PAYPAL_CURRENCY", () => {
  it("is GBP", () => {
    expect(PAYPAL_CURRENCY).toBe("GBP")
  })
})
