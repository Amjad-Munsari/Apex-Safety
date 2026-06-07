// Phase 15 — Plan 15-01 Task 2: real backcompat assertion
// Loads a minimal inline snapshot of the migration 011 seed schema and verifies that:
//   1. validateSchema returns result.success === true (Pitfall 1 / A4)
//   2. Every entity in result.data.entities has visibilityRules === { rules: [], logic: "and" }
//      (default-coerce injected by visibilityRulesAttribute.validate(undefined))
import { describe, it, expect } from "vitest";

// coltorapps requires proper v4 UUIDs as entity IDs.
// These are statically generated UUIDs (same pattern as tests/form-builder/validate-schema.test.ts).
const SEED_ENTITY_IDS = {
  siteName:     "00e236b1-6975-4d90-8fb5-4054d9635fc4",
  inspNotes:    "93bc7271-ba48-4192-9e88-0850ea931390",
  observations: "a7933a68-ce34-4c1f-9323-2343343cef40",
  signature:    "692b876d-71a8-4eda-8459-3fc335cb56d1",
  rating:       "e1018a45-dc9b-4cd8-8668-034d1bfda773",
  photos:       "c4fb7a79-9d03-4cc2-ad3b-7f4603247025",
  geolocation:  "b754a8f8-0d0f-428e-a53e-217a9afb1946",
  likelihood:   "24b75b76-0e0b-471e-a3e7-6524c6eb47f9",
  consequence:  "15d7e5be-302b-4055-8f7b-72eb80aeab8d",
  computed:     "8f4aa531-803c-4d9e-bd37-0549955bce93",
  repSection:   "426a0a8f-0444-483c-b6dd-e2fdb2664fdf",
  doorLoc:      "24f42112-e3b1-4a7d-a616-a59dd3a35ca2",
  doorCond:     "816bceba-3f76-4a48-bb1e-f963282db6eb",
  doorGap:      "74030760-d857-4d62-9a17-fc5209a575b6",
};

// Migration 011 schema with NO visibilityRules on any entity.
// This is exactly what legacy template_versions.schema_json rows look like
// before Phase 15 was deployed — the critical backward-compat scenario.
const MIGRATION_011_SEED_SCHEMA = {
  entities: {
    [SEED_ENTITY_IDS.siteName]: {
      type: "textField",
      attributes: {
        label: "Site name",
        required: true,
        placeholder: "Enter the site name",
        helpText: "",
        prefillSource: "",
        attachPhotos: false,
        // NO visibilityRules key — this is a pre-Phase-15 row
      },
    },
    [SEED_ENTITY_IDS.inspNotes]: {
      type: "textField",
      attributes: {
        label: "Inspector notes",
        required: false,
        placeholder: "Enter notes",
        helpText: "Use the mic button if you prefer dictation",
        prefillSource: "",
        attachPhotos: false,
      },
    },
    [SEED_ENTITY_IDS.observations]: {
      type: "textareaField",
      attributes: {
        label: "General observations",
        required: false,
        placeholder: "Describe any observations about the site",
        attachPhotos: false,
      },
    },
    // signatureField / ratingField are intentionally unsupported builder entity
    // types (product decision 2026-06) — omitted from this backcompat fixture.
    [SEED_ENTITY_IDS.photos]: {
      type: "multiPhotoField",
      attributes: {
        label: "Site condition photos",
        required: false,
        helpText: "Attach up to 8 photos of the site condition",
        maxPhotos: 8,
        attachPhotos: false,
      },
    },
    [SEED_ENTITY_IDS.geolocation]: {
      type: "geolocationField",
      attributes: {
        label: "Site GPS location",
        required: true,
        helpText: "Click Refresh to capture current GPS position",
        attachPhotos: true,
      },
    },
    [SEED_ENTITY_IDS.likelihood]: {
      type: "numberField",
      attributes: {
        label: "Likelihood (1-5)",
        required: true,
        min: 1,
        max: 5,
        unit: "",
        attachPhotos: false,
      },
    },
    [SEED_ENTITY_IDS.consequence]: {
      type: "numberField",
      attributes: {
        label: "Consequence (1-5)",
        required: true,
        min: 1,
        max: 5,
        unit: "",
        attachPhotos: false,
      },
    },
    [SEED_ENTITY_IDS.computed]: {
      type: "computedField",
      attributes: {
        label: "PAS 79 risk level",
        formula: "pas79",
        computedInputs: {
          likelihood: SEED_ENTITY_IDS.likelihood,
          consequence: SEED_ENTITY_IDS.consequence,
        },
        attachPhotos: false,
      },
    },
    [SEED_ENTITY_IDS.repSection]: {
      type: "repeatingSection",
      attributes: {
        title: "Fire doors register",
        description: "List each fire door on site. Add one entry per door.",
        minInstances: 1,
        maxInstances: 20,
      },
      children: [
        SEED_ENTITY_IDS.doorLoc,
        SEED_ENTITY_IDS.doorCond,
        SEED_ENTITY_IDS.doorGap,
      ],
    },
    [SEED_ENTITY_IDS.doorLoc]: {
      type: "textField",
      attributes: {
        label: "Door location",
        required: true,
        placeholder: "e.g. Main entrance",
        helpText: "",
        prefillSource: "",
        attachPhotos: false,
      },
      parentId: SEED_ENTITY_IDS.repSection,
    },
    [SEED_ENTITY_IDS.doorCond]: {
      type: "selectField",
      attributes: {
        label: "Door condition",
        required: true,
        options: [
          { label: "Good", value: "good" },
          { label: "Marginal", value: "marginal" },
          { label: "Poor", value: "poor" },
        ],
        allowMultiple: false,
        attachPhotos: false,
      },
      parentId: SEED_ENTITY_IDS.repSection,
    },
    [SEED_ENTITY_IDS.doorGap]: {
      type: "numberField",
      attributes: {
        label: "Gap (mm)",
        required: false,
        unit: "mm",
        attachPhotos: false,
      },
      parentId: SEED_ENTITY_IDS.repSection,
    },
  },
  root: [
    SEED_ENTITY_IDS.siteName,
    SEED_ENTITY_IDS.inspNotes,
    SEED_ENTITY_IDS.observations,
    SEED_ENTITY_IDS.photos,
    SEED_ENTITY_IDS.geolocation,
    SEED_ENTITY_IDS.likelihood,
    SEED_ENTITY_IDS.consequence,
    SEED_ENTITY_IDS.computed,
    SEED_ENTITY_IDS.repSection,
  ],
};

describe("backcompat — pre-Phase-15 schema validation (Pitfall 1)", () => {
  it(
    "load migration 011 seed schema via validateSchema and expect success AND every entity now has visibilityRules: { rules: [], logic: 'and' } post-validation",
    async () => {
      const { validateSchema } = await import("@coltorapps/builder");
      const { formBuilder } = await import("@/lib/form-builder");

      const result = await validateSchema(MIGRATION_011_SEED_SCHEMA, formBuilder);

      // Schema validates cleanly despite having no visibilityRules on any entity
      expect(result.success).toBe(true);

      if (!result.success) return; // TypeScript narrowing — test already failed above

      // Every entity should now have the default visibilityRules injected by the attribute factory
      const DEFAULT_VISIBILITY_RULES = { rules: [], logic: "and" };

      for (const [entityId, entity] of Object.entries(result.data.entities)) {
        expect(
          (entity as { attributes: Record<string, unknown> }).attributes.visibilityRules,
          `Entity ${entityId} (type: ${(entity as { type?: string }).type}) should have default visibilityRules after validation`
        ).toEqual(DEFAULT_VISIBILITY_RULES);
      }
    }
  );
});
