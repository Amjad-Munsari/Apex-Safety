-- 012_phase15_conditional_smoke_test.sql
-- 888 Safety & Training Platform
-- Seed: "Phase 15 Conditional Smoke Test" template — UAT vehicle for Phase 15.
--
-- Purpose: Exercises all three canonical conditional-logic rule patterns required
-- by Phase 15 (COND-01..04 + BUILDER-02). This is the mandatory DB seed required
-- by AGENTS.md ("No demo mocks in shipped code paths") — the UAT manual script
-- (15-UAT.md) depends on this template existing in the live DB before any
-- manual testing begins.
--
-- Phase 15 — Plan 15-08
--
-- DOES NOT TRUNCATE existing data. Migration 011 already cleaned the slate.
-- This migration is purely additive — existing templates remain alongside this new template.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THREE CANONICAL RULE PATTERNS:
--
-- Pattern A — D-02 (computedField as rule source):
--   Two numberFields (likelihood + consequence) feed a computedField (formula='pas79').
--   A textField "Mitigation" carries a visibilityRules rule:
--     { sourceEntityId: <computed-id>, operator: "equals", value: "Intolerable", action: "show" }
--   Proves D-02: computedField output drives show/hide of a downstream field.
--
-- Pattern B — D-03 (per-instance child rules inside repeatingSection):
--   A repeatingSection "Fire doors register" contains:
--     selectField "Door condition" (Good / Fair / Poor)
--     selectField "Repair urgency" (Low / Medium / High) — child of the same repeatingSection
--   "Repair urgency" carries a visibilityRules rule:
--     { sourceEntityId: <door-condition-child-id>, operator: "equals", value: "Poor", action: "require" }
--   Proves D-03: per-instance sibling reference inside repeatingSection.
--
-- Pattern C — D-01 (cascade strip on hidden parent, ancestor-scope ref):
--   A selectField "Site type" at root (Commercial / Residential / Industrial).
--   A sectionGroup "Fire doors register section" contains the Pattern B repeatingSection.
--   The sectionGroup carries a visibilityRules rule:
--     { sourceEntityId: <site-type-id>, operator: "equals", value: "Commercial", action: "show" }
--   Proves D-01: hiding the sectionGroup cascades to hide + strip all its children on submit.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Entity layout (11 entities total):
--
--   Root (7 entities):
--     1.  selectField   "Site type"           (root — source for D-01 section visibility rule)
--     2.  numberField   "Likelihood (1-5)"    (PAS 79 input — source for D-02 computed rule)
--     3.  numberField   "Consequence (1-5)"   (PAS 79 input — source for D-02 computed rule)
--     4.  computedField "PAS 79 risk level"   (formula=pas79 — source for D-02 Mitigation rule)
--     5.  textField     "Mitigation"          (visibilityRules: show when PAS79=Intolerable)
--     6.  sectionGroup  "Fire doors register section"  (D-01 cascade — visible only when Commercial)
--       6a. repeatingSection  "Fire doors register"   (child of sectionGroup)
--         6a-i.  selectField  "Door condition"        (Good / Fair / Poor — child of repeatingSection)
--         6a-ii. selectField  "Repair urgency"        (Low / Medium / High — child of repeatingSection)
--                             visibilityRules: require when Door condition = Poor (D-03)
--
-- coltorapps parent/child consistency (EntityParentMismatch rule):
--   A container entity MUST list its children in its own children array.
--   Children must carry parentId pointing back to the container.
--   Neither alone is sufficient — both must be present.
--   sectionGroup children: [e_rep_section]
--   repeatingSection children: [e_door_cond, e_repair_urgency]
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_admin_id    UUID;
  v_template_id UUID;

  -- Root-level entity IDs
  e_site_type      UUID := gen_random_uuid();
  e_likelihood     UUID := gen_random_uuid();
  e_consequence    UUID := gen_random_uuid();
  e_computed       UUID := gen_random_uuid();
  e_mitigation     UUID := gen_random_uuid();
  e_section_group  UUID := gen_random_uuid();

  -- sectionGroup child entity IDs
  e_rep_section    UUID := gen_random_uuid();

  -- repeatingSection child entity IDs (NOT in root, NOT in sectionGroup root)
  e_door_cond      UUID := gen_random_uuid();
  e_repair_urgency UUID := gen_random_uuid();

  v_schema         JSONB;
BEGIN
  -- Resolve admin user (template owner)
  SELECT id INTO v_admin_id FROM admin_users LIMIT 1;

  -- Insert the Phase 15 Conditional Smoke Test template row
  INSERT INTO form_templates (id, name, template_type, owner_id, owner_type, is_published)
  VALUES (gen_random_uuid(), 'Phase 15 Conditional Smoke Test', 'fra', v_admin_id, 'admin', false)
  RETURNING id INTO v_template_id;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Build the coltorapps { entities, root } schema_json.
  --
  -- Attribute names match the createAttribute({ name: "..." }) declarations
  -- in lib/form-builder/attributes/*.ts exactly.
  --
  -- Entity type strings match the createEntity({ name: "..." }) declarations
  -- in lib/form-builder/entities/*.ts exactly.
  --
  -- visibilityRules shape matches visibilityRulesAttribute.validate() from
  -- lib/form-builder/attributes/visibility-rules.ts (Plan 15-01):
  --   { rules: [{ sourceEntityId, operator, value, action }], logic: "and" }
  -- ─────────────────────────────────────────────────────────────────────────
  v_schema := jsonb_build_object(

    'entities', jsonb_build_object(

      -- ─── 1. selectField: "Site type" ──────────────────────────────────────
      -- Root-level source for the D-01 cascade rule on the sectionGroup.
      -- Options: Commercial / Residential / Industrial.
      -- allowMultiple=false (single selection).
      e_site_type::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Site type',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'Commercial',  'value', 'Commercial'),
            jsonb_build_object('label', 'Residential', 'value', 'Residential'),
            jsonb_build_object('label', 'Industrial',  'value', 'Industrial')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(),
            'logic', 'and'
          )
        )
      ),

      -- ─── 2. numberField: "Likelihood (1-5)" ──────────────────────────────
      -- PAS 79 risk matrix input. Range 1-5 (D-07, D-09).
      -- This entity ID is referenced by the computedField's computedInputs.likelihood.
      e_likelihood::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label',        'Likelihood (1-5)',
          'required',     true,
          'min',          1,
          'max',          5,
          'unit',         '',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(),
            'logic', 'and'
          )
        )
      ),

      -- ─── 3. numberField: "Consequence (1-5)" ─────────────────────────────
      -- PAS 79 risk matrix input. Range 1-5.
      -- This entity ID is referenced by the computedField's computedInputs.consequence.
      e_consequence::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label',        'Consequence (1-5)',
          'required',     true,
          'min',          1,
          'max',          5,
          'unit',         '',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(),
            'logic', 'and'
          )
        )
      ),

      -- ─── 4. computedField: "PAS 79 risk level" ───────────────────────────
      -- Exercises reactive computed badge + PAS 79 colour banding.
      -- formula="pas79" per D-08 (string enum, extensible).
      -- computedInputs maps to the two numberField UUIDs above (D-09).
      -- D-02: this computed entity ID is the sourceEntityId in the Mitigation rule.
      -- NO required attribute — computedField is always read-only.
      e_computed::text, jsonb_build_object(
        'type', 'computedField',
        'attributes', jsonb_build_object(
          'label',          'PAS 79 risk level',
          'formula',        'pas79',
          'computedInputs', jsonb_build_object(
            'likelihood',  e_likelihood::text,
            'consequence', e_consequence::text
          ),
          'attachPhotos',   false,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(),
            'logic', 'and'
          )
        )
      ),

      -- ─── 5. textField: "Mitigation" ──────────────────────────────────────
      -- D-02: visibilityRules rule references the computedField (e_computed) as source.
      -- Only shown when PAS 79 risk level evaluates to "Intolerable" (score >= 17).
      -- action="show" means the field is HIDDEN by default; shows when rule fires.
      e_mitigation::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label',        'Mitigation',
          'required',     false,
          'placeholder',  'Describe mitigation measures for this risk level',
          'helpText',     'Complete this field when PAS 79 risk is Intolerable',
          'prefillSource','',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(
              jsonb_build_object(
                'sourceEntityId', e_computed::text,
                'operator',       'equals',
                'value',          'Intolerable',
                'action',         'show'
              )
            ),
            'logic', 'and'
          )
        )
      ),

      -- ─── 6. sectionGroup: "Fire doors register section" ──────────────────
      -- D-01: visibilityRules rule references e_site_type (root selectField).
      -- Entire section (and all children) hides when Site type != Commercial.
      -- On submit, if hidden, the cascade strip drops this subtree from answers_json (D-01).
      -- children array MUST list e_rep_section (coltorapps EntityParentMismatch rule).
      e_section_group::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       'Fire doors register section',
          'description', 'Visible only when Site type is Commercial. Tests D-01 cascade strip.',
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(
              jsonb_build_object(
                'sourceEntityId', e_site_type::text,
                'operator',       'equals',
                'value',          'Commercial',
                'action',         'show'
              )
            ),
            'logic', 'and'
          )
        ),
        'children', jsonb_build_array(
          e_rep_section::text
        )
      ),

      -- ─── 6a. repeatingSection: "Fire doors register" ─────────────────────
      -- Child of sectionGroup (carries parentId = e_section_group).
      -- D-03: per-instance child rules live inside this container.
      -- minInstances=1, maxInstances=20.
      -- children array MUST list e_door_cond and e_repair_urgency.
      e_rep_section::text, jsonb_build_object(
        'type', 'repeatingSection',
        'attributes', jsonb_build_object(
          'title',        'Fire doors register',
          'description',  'List each fire door on site. Add one entry per door.',
          'minInstances', 1,
          'maxInstances', 20,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(),
            'logic', 'and'
          )
        ),
        'parentId', e_section_group::text,
        'children', jsonb_build_array(
          e_door_cond::text,
          e_repair_urgency::text
        )
      ),

      -- ─── 6a-i. selectField (child): "Door condition" ─────────────────────
      -- Required child of repeatingSection. Options: Good / Fair / Poor.
      -- D-03: this child entity ID is the sourceEntityId in the Repair urgency rule.
      -- parentId = e_rep_section.
      e_door_cond::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Door condition',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'Good', 'value', 'Good'),
            jsonb_build_object('label', 'Fair', 'value', 'Fair'),
            jsonb_build_object('label', 'Poor', 'value', 'Poor')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(),
            'logic', 'and'
          )
        ),
        'parentId', e_rep_section::text
      ),

      -- ─── 6a-ii. selectField (child): "Repair urgency" ────────────────────
      -- Optional child of repeatingSection by default.
      -- D-03: visibilityRules rule makes it REQUIRED when Door condition = Poor.
      -- sourceEntityId references e_door_cond (sibling in same instance scope).
      -- action="require" means the field is always visible; becomes required when rule fires.
      -- parentId = e_rep_section.
      e_repair_urgency::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Repair urgency',
          'required',      false,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'Low',    'value', 'Low'),
            jsonb_build_object('label', 'Medium', 'value', 'Medium'),
            jsonb_build_object('label', 'High',   'value', 'High')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(
              jsonb_build_object(
                'sourceEntityId', e_door_cond::text,
                'operator',       'equals',
                'value',          'Poor',
                'action',         'require'
              )
            ),
            'logic', 'and'
          )
        ),
        'parentId', e_rep_section::text
      )

    ), -- end entities

    -- root: 6 top-level entity IDs only.
    -- e_rep_section (inside sectionGroup) and its children (e_door_cond, e_repair_urgency)
    -- are NOT in root — they carry parentId and are accessed via their container's children array.
    'root', jsonb_build_array(
      e_site_type::text,
      e_likelihood::text,
      e_consequence::text,
      e_computed::text,
      e_mitigation::text,
      e_section_group::text
    )

  ); -- end jsonb_build_object (schema)

  -- Insert the template_versions row (version 1, draft — admin publishes via builder if desired)
  INSERT INTO template_versions (template_id, version_number, schema_json, created_by)
  VALUES (v_template_id, 1, v_schema, v_admin_id);

  RAISE NOTICE 'Phase 15: Conditional Smoke Test template created — template_id %', v_template_id;
END;
$$ LANGUAGE plpgsql;
