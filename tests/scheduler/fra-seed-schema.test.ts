// Static-analysis spec for supabase/migrations/016_phase18_fra_seed.sql.
// Phase 18 — Plan 18-01. The migration body IS the deliverable; this spec
// asserts the structural invariants the seed must satisfy without booting
// a Postgres instance. SQL line comments are stripped before counting so
// header prose cannot self-satisfy a grep-style assertion (planner grep-
// gate hygiene).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/016_phase18_fra_seed.sql"
);
const rawSql = readFileSync(MIGRATION_PATH, "utf8");
// Strip SQL line comments so header prose cannot satisfy structural assertions.
// A stripped line is one whose trimmed form starts with '--'.
const sql = rawSql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("Phase 18 FRA seed migration (016)", () => {
  // ── Test 1: form_templates row with fixed Phase 18 UUID and is_published=TRUE
  it("inserts the form_templates row with the fixed Phase 18 UUID and is_published=TRUE", () => {
    // Fixed UUID for prod idempotency (Pitfall P2 — RESEARCH §Q4).
    expect(sql).toMatch(
      /v_template_id\s+UUID\s*:=\s*'00000000-0000-4000-a000-000000000018'::uuid/
    );
    // is_published=TRUE is required so Phase 16 RLS policy form_templates_client_published
    // makes the master readable to all client_users (Pitfall P2).
    expect(sql).toMatch(/'fra',\s*v_admin_id,\s*'admin',\s*TRUE/);
  });

  // ── Test 2: template_versions row with published_at and fixed version UUID
  it("inserts the template_versions row with published_at and the fixed version UUID", () => {
    // Fixed UUID for idempotency (Pitfall P2 — re-runnable on prod).
    expect(sql).toMatch(
      /v_version_id\s+UUID\s*:=\s*'00000000-0000-4000-a000-000000000118'::uuid/
    );
    // published_at = NOW() required by template_versions_client_published RLS policy.
    expect(sql).toMatch(/INSERT INTO template_versions[\s\S]+?published_at/m);
  });

  // ── Test 3: idempotency — both inserts carry ON CONFLICT (id) DO NOTHING
  it("is idempotent — both inserts carry ON CONFLICT (id) DO NOTHING", () => {
    // Must appear exactly twice: once for form_templates, once for template_versions.
    const conflicts = sql.match(/ON CONFLICT \(id\) DO NOTHING/g) || [];
    expect(conflicts.length).toBeGreaterThanOrEqual(2);
  });

  // ── Test 4: exactly one PAS 79 computedField — no fictional entity types
  it("declares exactly one PAS 79 computedField — never a fictional risk-matrix entity", () => {
    // Pitfall P1: the PAS 79 risk matrix is a computedField with formula='pas79'.
    // No 'riskMatrixField' entity type exists in lib/form-builder/index.ts.
    const pas79 = sql.match(/'formula',\s*'pas79'/g) || [];
    expect(pas79.length).toBe(1);
    expect(sql).not.toMatch(/riskMatrixField/);
  });

  // ── Test 5: exactly one Action Plan repeatingSection with the locked 4-column child contract
  it("declares exactly one Action Plan repeatingSection with the locked 4-column child contract", () => {
    // One repeatingSection is the FRA Action Plan (RESEARCH Q2 — 4 columns).
    const reps = sql.match(/'type',\s*'repeatingSection'/g) || [];
    expect(reps.length).toBe(1);

    // The four child entity variables must appear in the migration.
    for (const symbol of [
      "e_action_desc",
      "e_action_owner",
      "e_action_due",
      "e_action_priority",
    ]) {
      expect(sql).toContain(symbol);
      // Each child must be wired with parentId back to e_action_plan (coltorapps EntityParentMismatch rule).
      // The child declaration uses `'parentId', e_action_plan::text` in the jsonb_build_object.
      // We check that the child symbol co-occurs within 800 chars of e_action_plan's parentId reference.
      const patternFwd = new RegExp(
        symbol +
          "::text[\\s\\S]{0,800}'parentId',\\s*e_action_plan::text"
      );
      const patternBwd = new RegExp(
        "'parentId',\\s*e_action_plan::text[\\s\\S]{0,800}" +
          symbol +
          "::text"
      );
      expect(patternFwd.test(sql) || patternBwd.test(sql)).toBe(true);
    }
  });

  // ── Test 6: forbids specialty fields inside Action Plan repeating instances
  it("forbids specialty fields inside Action Plan repeating instances", () => {
    // Phase 14 §RepeatingSectionRenderer JSDoc lines 36-43: only textField/textareaField/
    // numberField/dateField/selectField/checkboxField may be children of e_action_plan.
    // Specialty fields nested inside instances WILL break the renderer.
    const forbiddenTypes = [
      "signatureField",
      "multiPhotoField",
      "geolocationField",
      "computedField",
      "ratingField",
      "repeatingSection",
    ];
    for (const t of forbiddenTypes) {
      // Check in both orderings within 400 chars to catch any nesting pattern.
      const fwdPattern = new RegExp(
        "'parentId',\\s*e_action_plan::text[\\s\\S]{0,400}'type',\\s*'" +
          t +
          "'",
        "g"
      );
      const bwdPattern = new RegExp(
        "'type',\\s*'" +
          t +
          "'[\\s\\S]{0,400}'parentId',\\s*e_action_plan::text",
        "g"
      );
      expect(
        (sql.match(fwdPattern) || []).length,
        `${t} must not be nested inside Action Plan (fwd check)`
      ).toBe(0);
      expect(
        (sql.match(bwdPattern) || []).length,
        `${t} must not be nested inside Action Plan (bwd check)`
      ).toBe(0);
    }
  });

  // ── Test 7: three conditional sub-section visibilityRules with operator:equals
  it("wires three conditional sub-section visibilityRules with operator equals against option VALUE strings", () => {
    // Pitfall P6: drivers are selectField, rules compare option VALUE strings.
    // Never a yes/no toggle entity — such an entity does not exist in the registry.
    const eq = sql.match(/'operator',\s*'equals'/g) || [];
    expect(eq.length).toBeGreaterThanOrEqual(3);
    // No yes/no toggle entity type (Pitfall P6).
    expect(sql).not.toMatch(/yesNoField/);
  });

  // ── Test 8: three Phase 14 specialty entities — signatureField, geolocationField, multiPhotoField
  it("declares the three Phase 14 specialty entities — signatureField (1) + geolocationField (1) + multiPhotoField (>=3 instances)", () => {
    // One responsible-person signature at the end of §06.
    expect(
      (sql.match(/'type',\s*'signatureField'/g) || []).length
    ).toBe(1);
    // One geolocation capture at the start of §01 (industry FRA norm).
    expect(
      (sql.match(/'type',\s*'geolocationField'/g) || []).length
    ).toBe(1);
    // At least 3 multiPhotoField entities:
    //   §03 escape route photos (required, maxPhotos:8)
    //   §03a obstruction photos (conditional, required, maxPhotos:5)
    //   §04 fire protection photos (required, maxPhotos:8)
    expect(
      (sql.match(/'type',\s*'multiPhotoField'/g) || []).length
    ).toBeGreaterThanOrEqual(3);
  });

  // ── Test 9: does not touch form submissions — template seed only
  it("does not touch form submissions or any submission-side table — template seed only", () => {
    // Pitfall P5: migration 016 inserts EXACTLY two rows (form_templates + template_versions).
    // Submissions happen at fill time via existing submitAssessmentAction.
    expect(sql).not.toMatch(/form_submissions/);
  });

  // ── Test 10: does not create database triggers — project convention
  it("does not create database triggers — project convention", () => {
    // Project convention: zero triggers anywhere in the migration history (confirmed
    // by Phase 16 + 17 research). This seed must not introduce the first one.
    expect(sql).not.toMatch(/CREATE\s+TRIGGER/i);
  });

  // ── Test 11: admin owner resolved with null guard (Pitfall P3)
  it("resolves admin owner via SELECT and raises exception if no admin exists", () => {
    // Pitfall P3: owner_type='admin' requires a real admin_users.id — never NULL.
    expect(sql).toMatch(
      /SELECT\s+id\s+INTO\s+v_admin_id\s+FROM\s+admin_users\s+LIMIT\s+1/i
    );
    expect(sql).toMatch(/IF\s+v_admin_id\s+IS\s+NULL\s+THEN\s+RAISE\s+EXCEPTION/i);
  });

  // ── Test 12: root array contains exactly the 6 top-level sectionGroup UUIDs
  it("root array references the 6 top-level section UUIDs (sections 01 through 06)", () => {
    // Per PLAN §interfaces: root contains ONLY the 6 top-level sectionGroup UUIDs.
    // All other entities are nested via parent/children (matches migration 012 pattern).
    for (const sectionVar of [
      "e_section_01",
      "e_section_02",
      "e_section_03",
      "e_section_04",
      "e_section_05",
      "e_section_06",
    ]) {
      expect(sql).toContain(sectionVar);
    }
    // The root jsonb_build_array must reference these section UUIDs.
    expect(sql).toMatch(
      /'root',\s*jsonb_build_array\([\s\S]{0,300}e_section_01/
    );
    expect(sql).toMatch(
      /e_section_06::text[\s\S]{0,20}\)/
    );
  });
});
