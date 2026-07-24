import { describe, it, expect } from "vitest"
import {
  CREDIT_PACKAGES,
  getPackage,
  formatPayPalAmount,
  packageDescription,
  PAYPAL_CURRENCY,
} from "@/lib/billing/packages"

describe("CREDIT_PACKAGES", () => {
  it("defines exactly the three packages from the spec, keyed 20c/40c/80c", () => {
    expect(CREDIT_PACKAGES.map((p) => p.id)).toEqual(["20c", "40c", "80c"])
  })

  it("matches the spec credits and GBP prices (unchanged from the hours-era prices)", () => {
    expect(getPackage("20c")).toMatchObject({ credits: 20, priceGBP: 495 })
    expect(getPackage("40c")).toMatchObject({ credits: 40, priceGBP: 950 })
    expect(getPackage("80c")).toMatchObject({ credits: 80, priceGBP: 1800 })
  })

  it("flags 40c as the popular pack", () => {
    expect(getPackage("40c")?.popular).toBe(true)
    expect(getPackage("20c")?.popular).toBeUndefined()
  })
})

describe("getPackage", () => {
  it("returns undefined for an unknown id (tamper guard)", () => {
    expect(getPackage("999c")).toBeUndefined()
    expect(getPackage("")).toBeUndefined()
    expect(getPackage("20C")).toBeUndefined()
  })

  it("resolves legacy hours-era ids to their credit-pack equivalents (deploy-window safety)", () => {
    expect(getPackage("5h")).toMatchObject({ id: "20c", credits: 20, priceGBP: 495 })
    expect(getPackage("10h")).toMatchObject({ id: "40c", credits: 40, priceGBP: 950 })
    expect(getPackage("20h")).toMatchObject({ id: "80c", credits: 80, priceGBP: 1800 })
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
  it("renders the 888 Safety credits purchase_unit description", () => {
    expect(packageDescription(getPackage("20c")!)).toBe("888 Safety — 20 Consulting Credits")
    expect(packageDescription(getPackage("80c")!)).toBe("888 Safety — 80 Consulting Credits")
  })
})

describe("PAYPAL_CURRENCY", () => {
  it("is GBP", () => {
    expect(PAYPAL_CURRENCY).toBe("GBP")
  })
})
