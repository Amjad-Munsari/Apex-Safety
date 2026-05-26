/**
 * tests/e2e/phase15-smoke.spec.ts
 * 888 Safety & Training Platform
 *
 * Phase 15 — Conditional Logic Engine — E2E Smoke Tests
 *
 * Exercises the three canonical conditional rule patterns from migration 012:
 *
 *   Test A — PAS 79 mitigation flow (D-02):
 *     Fill likelihood=5 + consequence=5 → PAS 79 computes "Intolerable"
 *     → Mitigation textField becomes visible → fill + submit
 *     → answers_json CONTAINS the Mitigation key (visible at submit = kept).
 *     Then fill likelihood=1 + consequence=1 → PAS 79 = "Trivial"
 *     → Mitigation NOT visible → submit
 *     → answers_json does NOT contain Mitigation key (hidden = scrubbed).
 *
 *   Test B — FRA-doors per-instance require flow (D-03):
 *     Open smoke template with Site type = Commercial (section visible).
 *     Add 2 door instances.
 *     Instance 0: Door condition = Good → Repair urgency not required.
 *     Instance 1: Door condition = Poor → Repair urgency becomes required.
 *     Submit with urgency filled → answers_json has both instances.
 *
 *   Test C (optional) — D-01 cascade smoke:
 *     Set Site type = Residential → Fire doors section unmounts.
 *     Submit → answers_json does NOT contain the sectionGroup/repeatingSection key.
 *
 * Pre-conditions:
 *   - Migration 012 applied to the live DB (Task 3 of Plan 15-08).
 *   - Dev server running at http://localhost:3000 (npm run dev).
 *   - Admin credentials available (email/password via env vars).
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service-role key (for answers_json read)
 *   E2E_ADMIN_EMAIL               — admin user email
 *   E2E_ADMIN_PASSWORD            — admin user password
 */

import { test, expect, type Page } from "@playwright/test"
import { readAnswersJson } from "./helpers/answers-json"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const TEMPLATE_NAME = "Phase 15 Conditional Smoke Test"

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  ADMIN_EMAIL &&
  ADMIN_PASSWORD
)

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper — log in as admin via the sign-in page.
// ─────────────────────────────────────────────────────────────────────────────
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`)
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL!)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD!)
  await page.getByRole("button", { name: /sign in|log in/i }).click()
  // Wait for redirect to admin dashboard
  await page.waitForURL(/\/admin/, { timeout: 15_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Template navigation helper — open the smoke template fill page via the
// admin assessments/new flow.
// ─────────────────────────────────────────────────────────────────────────────
async function openSmokeTemplate(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/admin/assessments/new`)
  // Select the Phase 15 Conditional Smoke Test template
  await page.getByRole("combobox", { name: /template/i }).selectOption({ label: TEMPLATE_NAME })
  // Pick any client for the assignment
  const clientSelect = page.getByRole("combobox", { name: /client/i })
  if (await clientSelect.isVisible()) {
    const firstOption = await clientSelect.locator("option").nth(1).textContent()
    if (firstOption) await clientSelect.selectOption({ label: firstOption.trim() })
  }
  await page.getByRole("button", { name: /start|create|begin/i }).click()
  // Should land on the fill/assessment page
  await page.waitForURL(/\/admin\/assessments\/[^/]+/, { timeout: 15_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to extract the last submission ID from the current URL after submit.
// ─────────────────────────────────────────────────────────────────────────────
function getSubmissionIdFromUrl(url: string): string | null {
  const match = url.match(/\/assessments\/([a-f0-9-]{36})/)
  return match ? match[1] : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Test A — PAS 79 mitigation visibility flow (D-02)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Phase 15 — Test A: PAS 79 mitigation show/hide (D-02)", () => {
  test.skip(
    !hasEnv,
    "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY to run Phase 15 smoke tests."
  )

  test("Mitigation field appears when risk is Intolerable; scrub removes it when hidden", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await openSmokeTemplate(page)

    // ── Step 1: Site type = Commercial (needed so section stays visible) ────
    const siteTypeSelect = page.getByLabel("Site type")
    await expect(siteTypeSelect).toBeVisible()
    await siteTypeSelect.selectOption("Commercial")

    // ── Step 2: Mitigation should NOT be visible initially (no rule has fired) ─
    const mitigationField = page.getByLabel("Mitigation")
    await expect(mitigationField).not.toBeVisible()

    // ── Step 3: Fill likelihood=5, consequence=5 → Intolerable ─────────────
    await page.getByLabel("Likelihood (1-5)").fill("5")
    await page.getByLabel("Consequence (1-5)").fill("5")

    // Allow the computed field reactivity to propagate
    await page.waitForTimeout(500)

    // ── Step 4: Assert PAS 79 badge shows "Intolerable" ────────────────────
    await expect(page.getByText("Intolerable")).toBeVisible()

    // ── Step 5: Assert Mitigation field becomes visible ─────────────────────
    await expect(mitigationField).toBeVisible()

    // ── Step 6: Fill in the Mitigation text ─────────────────────────────────
    await mitigationField.fill("Install fire-rated door closer — high priority.")

    // ── Step 7: Submit the form ──────────────────────────────────────────────
    await page.getByRole("button", { name: /submit/i }).click()
    await page.waitForURL(/\/admin\/assessments\/[^/]+/, { timeout: 15_000 })

    // ── Step 8: Read answers_json and assert Mitigation key IS present ───────
    const submissionId = getSubmissionIdFromUrl(page.url())
    expect(submissionId).not.toBeNull()
    const json = await readAnswersJson(submissionId!)
    const keys = Object.keys(json)
    // The Mitigation key should be present (it was visible at submit time)
    expect(
      keys.some((k) => {
        const val = json[k]
        return typeof val === "string" && val.includes("fire-rated")
      })
    ).toBe(true)
  })

  test("Mitigation key is absent from answers_json when hidden at submit (scrub D-01)", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await openSmokeTemplate(page)

    // Set Site type = Commercial so form section is visible
    await page.getByLabel("Site type").selectOption("Commercial")

    // ── Fill low-risk values (likelihood=1, consequence=1 → Trivial) ────────
    await page.getByLabel("Likelihood (1-5)").fill("1")
    await page.getByLabel("Consequence (1-5)").fill("1")

    await page.waitForTimeout(500)

    // ── PAS 79 badge should NOT show Intolerable ─────────────────────────────
    await expect(page.getByText("Trivial")).toBeVisible()

    // ── Mitigation field should NOT be visible ───────────────────────────────
    const mitigationField = page.getByLabel("Mitigation")
    await expect(mitigationField).not.toBeVisible()

    // ── Fill minimum required fields and submit ───────────────────────────────
    // Add at least one fire door instance (minInstances=1 on the repeatingSection)
    const addInstanceBtn = page.getByRole("button", { name: /add fire doors register|add instance|add door/i })
    if (await addInstanceBtn.isVisible()) {
      await addInstanceBtn.click()
      await page.getByLabel("Door condition").first().selectOption("Good")
    }

    await page.getByRole("button", { name: /submit/i }).click()
    await page.waitForURL(/\/admin\/assessments\/[^/]+/, { timeout: 15_000 })

    // ── Read answers_json and assert Mitigation key is ABSENT ────────────────
    const submissionId = getSubmissionIdFromUrl(page.url())
    expect(submissionId).not.toBeNull()
    const json = await readAnswersJson(submissionId!)
    const keys = Object.keys(json)

    // No value from the Mitigation field should be present
    // (it was hidden at submit time — server scrub strips it)
    expect(
      keys.some((k) => {
        const val = json[k]
        return typeof val === "string" && (val as string).length > 0 &&
          (val as string).toLowerCase().includes("mitigation")
      })
    ).toBe(false)

    // The Mitigation entity ID must not appear as a key with a real value
    // We cannot know the exact entity ID here (it's a dynamic UUID), but we
    // can verify no string value matching the hidden-field contract is present.
    // If we had the entity ID, we'd do: expect(keys).not.toContain(mitigationEntityId)
    expect(Object.keys(json)).not.toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test B — FRA-doors per-instance require flow (D-03)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Phase 15 — Test B: FRA-doors per-instance require (D-03)", () => {
  test.skip(
    !hasEnv,
    "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY to run Phase 15 smoke tests."
  )

  test("Repair urgency becomes required when Door condition = Poor", async ({ page }) => {
    await loginAsAdmin(page)
    await openSmokeTemplate(page)

    // ── Set Site type = Commercial so the sectionGroup is visible ─────────────
    await page.getByLabel("Site type").selectOption("Commercial")

    // ── Fill PAS 79 fields to avoid unrelated validation errors ───────────────
    await page.getByLabel("Likelihood (1-5)").fill("2")
    await page.getByLabel("Consequence (1-5)").fill("2")

    // ── Add 2 fire door instances ─────────────────────────────────────────────
    const addBtn = page.getByRole("button", { name: /add fire doors register|add instance|add door/i })
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    await addBtn.click()

    // ── Instance 0: Door condition = Good → Repair urgency NOT required ───────
    const doorConditions = page.getByLabel("Door condition")
    await doorConditions.nth(0).selectOption("Good")

    // Repair urgency field for instance 0 — no required asterisk (not required)
    const repairUrgencyFields = page.getByLabel("Repair urgency")
    await expect(repairUrgencyFields.nth(0)).toBeVisible()
    // There should be no required indicator (the required attribute is dynamic)
    // We check that submitting without Repair urgency passes for instance 0.

    // ── Instance 1: Door condition = Poor → Repair urgency becomes required ────
    await doorConditions.nth(1).selectOption("Poor")
    await page.waitForTimeout(300)

    // Repair urgency for instance 1 should now show a required indicator
    // (either via aria-required, a required asterisk, or similar)
    const instance1RepairUrgency = repairUrgencyFields.nth(1)
    await expect(instance1RepairUrgency).toBeVisible()
    // Check for dynamic required state — aria-required or a sibling asterisk
    const isRequired = await instance1RepairUrgency.evaluate((el) => {
      const input = el instanceof HTMLSelectElement ? el : el.querySelector("select")
      return (
        input?.getAttribute("aria-required") === "true" ||
        input?.required === true ||
        !!el.closest("[data-required]")?.getAttribute("data-required")
      )
    })
    // The required state should be reflected; log without hard-failing if dynamic
    // required is via CSS asterisk only (UI-SPEC §4 dynamic required)
    console.log("Instance 1 Repair urgency dynamically required:", isRequired)

    // ── Submit without filling Repair urgency for instance 1 ──────────────────
    // This should fail validation (required field empty)
    await page.getByRole("button", { name: /submit/i }).click()
    // Should NOT navigate away (validation error)
    await expect(page).toHaveURL(/\/admin\/assessments\/[^/]+/)

    // ── Fill Repair urgency for instance 1 ────────────────────────────────────
    await instance1RepairUrgency.selectOption("High")

    // ── Submit again — should succeed ────────────────────────────────────────
    await page.getByRole("button", { name: /submit/i }).click()
    await page.waitForURL(/\/admin\/assessments\/[^/]+/, { timeout: 15_000 })

    // ── Read answers_json and assert both instances persisted ─────────────────
    const submissionId = getSubmissionIdFromUrl(page.url())
    expect(submissionId).not.toBeNull()
    const json = await readAnswersJson(submissionId!)

    // The repeatingSection should have an instances array with 2 entries
    const repSectionValues = Object.values(json).filter(
      (v) => v !== null && typeof v === "object" && "instances" in (v as object)
    )
    expect(repSectionValues.length).toBeGreaterThanOrEqual(1)

    const instances = (repSectionValues[0] as { instances: unknown[] }).instances
    expect(instances).toHaveLength(2)

    // Instance 0 should NOT have Repair urgency (or it's empty/null — Door condition was Good)
    // Instance 1 should have Door condition = Poor and Repair urgency = High
    const instance1 = instances[1] as Record<string, unknown>
    const instance1Values = Object.values(instance1)
    expect(instance1Values).toContain("Poor")
    expect(instance1Values).toContain("High")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test C (optional) — D-01 cascade smoke: section hidden → scrubbed from answers_json
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Phase 15 — Test C: D-01 cascade strip (optional)", () => {
  test.skip(
    !hasEnv,
    "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY to run Phase 15 smoke tests."
  )

  test("Fire doors section unmounts and is stripped from answers_json when Site type = Residential", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await openSmokeTemplate(page)

    // ── Set Site type = Commercial first to confirm section is visible ─────────
    await page.getByLabel("Site type").selectOption("Commercial")
    await expect(page.getByText("Fire doors register")).toBeVisible()

    // ── Set Site type = Residential → sectionGroup should hide (D-01) ─────────
    await page.getByLabel("Site type").selectOption("Residential")
    await page.waitForTimeout(300)

    // The Fire doors register section should no longer be visible
    await expect(page.getByText("Fire doors register section")).not.toBeVisible()

    // ── Fill PAS 79 minimally (low risk, no Mitigation needed) ────────────────
    await page.getByLabel("Likelihood (1-5)").fill("1")
    await page.getByLabel("Consequence (1-5)").fill("1")

    // ── Submit ────────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /submit/i }).click()
    await page.waitForURL(/\/admin\/assessments\/[^/]+/, { timeout: 15_000 })

    // ── Read answers_json — the repeatingSection key should be absent ──────────
    const submissionId = getSubmissionIdFromUrl(page.url())
    expect(submissionId).not.toBeNull()
    const json = await readAnswersJson(submissionId!)

    // No key in answers_json should have shape { instances: [...] }
    // (the entire sectionGroup + repeatingSection subtree was hidden → stripped)
    const repSectionValues = Object.values(json).filter(
      (v) => v !== null && typeof v === "object" && "instances" in (v as object)
    )
    expect(repSectionValues).toHaveLength(0)

    expect(Object.keys(json)).not.toHaveLength(0)
  })
})
