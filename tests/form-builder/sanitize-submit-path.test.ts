/**
 * tests/form-builder/sanitize-submit-path.test.ts
 *
 * Regression test for the signatureField submit crash (fixed in de85ab9,
 * found again in UAT Workflow 1 against the pre-fix deployment).
 *
 * The pinned template_versions.schema_json can contain since-removed entity
 * types (the seeded FRA's signatureField, deregistered 2026-06-04). The
 * client renders and validates against sanitizeSchema(rawSchema), but
 * feeding the RAW schema into coltorapps' validateEntitiesValues throws
 * `Unkown entity type "signatureField"` (typo upstream) and crashes the
 * whole submit as a Server Components error.
 *
 * These tests mirror submitAssessmentAction's pipeline:
 *   sanitizeSchema → pruneSchemaForValidation → validateEntitiesValues
 * and pin down both halves of the bug:
 *   1. the raw schema DOES crash (documents the failure mode),
 *   2. the sanitized schema validates cleanly (proves the fix).
 */
import { describe, it, expect } from "vitest";
import { validateEntitiesValues } from "@coltorapps/builder";
import { formBuilder } from "@/lib/form-builder";
import { sanitizeSchema } from "@/lib/form-builder/sanitize-schema";
import { pruneSchemaForValidation } from "@/lib/form-builder/prune-schema-for-validation";

// Real UUIDs — coltorapps requires version 1-5 and variant [89ab]
const TEXT_ID      = "11111111-1111-4111-8111-111111111111";
const SIGNATURE_ID = "22222222-2222-4222-8222-222222222222";
const SIG_SECTION  = "33333333-3333-4333-8333-333333333333";

/**
 * Shape of the seeded FRA's tail: a live textField plus a signature-only
 * sectionGroup whose single child is the deregistered signatureField.
 */
const rawPinnedSchema = {
  entities: {
    [TEXT_ID]: {
      type: "textField",
      attributes: { label: "Assessor name", required: true },
    },
    [SIG_SECTION]: {
      type: "sectionGroup",
      attributes: { title: "Sign-off" },
      children: [SIGNATURE_ID],
    },
    [SIGNATURE_ID]: {
      type: "signatureField",
      attributes: { label: "Assessor signature", required: true },
      parentId: SIG_SECTION,
    },
  },
  root: [TEXT_ID, SIG_SECTION],
};

const values = { [TEXT_ID]: "Matt" };

describe("submit-path sanitization — deregistered signatureField (de85ab9 regression)", () => {
  it("documents the crash: raw pinned schema with signatureField throws inside validateEntitiesValues", async () => {
    await expect(
      validateEntitiesValues(
        values,
        formBuilder,
        rawPinnedSchema as Parameters<typeof validateEntitiesValues>[2]
      )
    ).rejects.toThrow(/entity type/i);
  });

  it("proves the fix: sanitize → prune → validate succeeds for the same schema and values", async () => {
    const sanitized = sanitizeSchema(rawPinnedSchema as Parameters<typeof sanitizeSchema>[0]);
    const pruned = pruneSchemaForValidation(sanitized);

    const result = await validateEntitiesValues(
      values,
      formBuilder,
      pruned as Parameters<typeof validateEntitiesValues>[2]
    );
    expect(result.success).toBe(true);
  });

  it("sanitize cascade also drops the now-empty signature-only sectionGroup", () => {
    const sanitized = sanitizeSchema(rawPinnedSchema as Parameters<typeof sanitizeSchema>[0]);
    expect(Object.keys(sanitized.entities)).toEqual([TEXT_ID]);
    expect(sanitized.root).toEqual([TEXT_ID]);
  });
});
