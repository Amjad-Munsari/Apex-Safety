-- 011_specialty_smoke_test_template.sql
-- 888 Safety & Training Platform
-- Seed: "Specialty Fields Smoke Test" template — UAT vehicle for Phase 14.
--
-- Purpose: Exercises all 6 Phase 14 specialty entity types plus the canonical
-- FRA-doors repeatingSection scenario. This is the mandatory DB seed required
-- by AGENTS.md ("No demo mocks in shipped code paths") — the UAT manual script
-- (14-UAT.md) depends on this template existing in the live DB before any
-- manual testing begins.
--
-- Phase 14 — Plan 14-08
--
-- DOES NOT TRUNCATE existing data. Migration 010 already cleaned the slate.
-- This migration is purely additive — the "Basic Types Smoke Test" template
-- seeded in 010 remains alongside this new template.
--
-- Entity layout (14 entities total):
--
--   Root (11 entities):
--     1.  textField        "Site name"                    (STT + attachPhotos default OFF)
--     2.  textField        "Inspector notes"              (STT, helpText for mic hint)
--     3.  textareaField    "General observations"         (STT textarea variant)
--     4.  signatureField   "Inspector signature"          (canvas + upload + attachPhotos ON)
--     5.  ratingField      "Overall site safety rating"   (stars + WCAG + attachPhotos ON)
--     6.  multiPhotoField  "Site condition photos"        (HEIC + compression + storage upload)
--     7.  geolocationField "Site GPS location"            (Leaflet + accuracy badge + attachPhotos ON)
--     8.  numberField      "Likelihood (1-5)"             (PAS 79 input)
--     9.  numberField      "Consequence (1-5)"            (PAS 79 input)
--     10. computedField    "PAS 79 risk level"            (reactive computed badge + colour banding)
--     11. repeatingSection "Fire doors register"          (FRA-doors canonical test scenario)
--
--   Children of repeatingSection (3 entities, NOT in root):
--     11a. textField   "Door location"  (required — D-02 template children)
--     11b. selectField "Door condition" (Good / Marginal / Poor)
--     11c. numberField "Gap (mm)"       (optional, unit mm)
--
-- FRA-doors scenario (CONTEXT §specifics):
--   The "Fire doors register" repeatingSection is the canonical Phase 14 integration test.
--   UAT Section F fills 3 door instances. UAT Section G verifies the AI report draft
--   includes 3 hazards referencing the door locations — confirming expandRepeatingSections
--   (Plan 14-03) flattened the instances[] correctly for the AI prompt.
--
-- coltorapps parent/child consistency (EntityParentMismatch rule):
--   A container entity MUST list its children in its own children array.
--   Children must carry parentId pointing back to the container.
--   Neither alone is sufficient — both must be present.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_admin_id    UUID;
  v_template_id UUID;

  -- Root-level entity IDs (11 entries in root array)
  e_site_name      UUID := gen_random_uuid();
  e_insp_notes     UUID := gen_random_uuid();
  e_observations   UUID := gen_random_uuid();
  e_signature      UUID := gen_random_uuid();
  e_rating         UUID := gen_random_uuid();
  e_photos         UUID := gen_random_uuid();
  e_geolocation    UUID := gen_random_uuid();
  e_likelihood     UUID := gen_random_uuid();
  e_consequence    UUID := gen_random_uuid();
  e_computed       UUID := gen_random_uuid();
  e_rep_section    UUID := gen_random_uuid();

  -- repeatingSection child entity IDs (3 children — NOT in root)
  e_door_loc       UUID := gen_random_uuid();
  e_door_cond      UUID := gen_random_uuid();
  e_door_gap       UUID := gen_random_uuid();

  v_schema         JSONB;
BEGIN
  -- Resolve admin user (template owner)
  SELECT id INTO v_admin_id FROM admin_users LIMIT 1;

  -- Insert the Specialty Fields Smoke Test template row
  INSERT INTO form_templates (id, name, template_type, owner_id, owner_type, is_published)
  VALUES (gen_random_uuid(), 'Specialty Fields Smoke Test', 'fra', v_admin_id, 'admin', false)
  RETURNING id INTO v_template_id;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Build the coltorapps { entities, root } schema_json.
  --
  -- Attribute names match the createAttribute({ name: "..." }) declarations
  -- in lib/form-builder/attributes/*.ts exactly.
  --
  -- Entity type strings match the createEntity({ name: "..." }) declarations
  -- in lib/form-builder/entities/*.ts exactly.
  -- ─────────────────────────────────────────────────────────────────────────
  v_schema := jsonb_build_object(

    'entities', jsonb_build_object(

      -- ─── 1. textField: "Site name" ─────────────────────────────────────
      -- Exercises STT (D-14) on a required text field.
      -- attachPhotos=false (default OFF per D-05).
      e_site_name::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label',        'Site name',
          'required',     true,
          'placeholder',  'Enter the site name',
          'helpText',     '',
          'prefillSource','',
          'attachPhotos', false
        )
      ),

      -- ─── 2. textField: "Inspector notes" ───────────────────────────────
      -- Exercises STT with a helpText prompt nudging the inspector to use the mic.
      -- attachPhotos=false.
      e_insp_notes::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label',        'Inspector notes',
          'required',     false,
          'placeholder',  'Enter notes',
          'helpText',     'Use the mic button if you prefer dictation',
          'prefillSource','',
          'attachPhotos', false
        )
      ),

      -- ─── 3. textareaField: "General observations" ──────────────────────
      -- Exercises STT on textarea renderer (D-14 bottom-right mic position).
      -- textareaField has no helpText attribute in Phase 14 entity definition.
      e_observations::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'General observations',
          'required',     false,
          'placeholder',  'Describe any observations about the site',
          'attachPhotos', false
        )
      ),

      -- ─── 4. signatureField: "Inspector signature" ──────────────────────
      -- Exercises signature canvas + PNG upload to form-media bucket (D-16).
      -- attachPhotos=true to exercise the attachPhotos affordance (D-05, D-06, FORM-05).
      e_signature::text, jsonb_build_object(
        'type', 'signatureField',
        'attributes', jsonb_build_object(
          'label',        'Inspector signature',
          'required',     true,
          'helpText',     'Sign using the canvas below',
          'attachPhotos', true
        )
      ),

      -- ─── 5. ratingField: "Overall site safety rating" ──────────────────
      -- Exercises star rating UI + WCAG keyboard nav (UI-SPEC §ratingField).
      -- maxRating=5 (default). attachPhotos=true for affordance UAT.
      e_rating::text, jsonb_build_object(
        'type', 'ratingField',
        'attributes', jsonb_build_object(
          'label',        'Overall site safety rating',
          'required',     true,
          'helpText',     'Rate from 1 (poor) to 5 (excellent)',
          'maxRating',    5,
          'attachPhotos', true
        )
      ),

      -- ─── 6. multiPhotoField: "Site condition photos" ───────────────────
      -- Exercises photo grid, HEIC→JPEG conversion, EXIF auto-rotate,
      -- 1.2–1.5 MB compression, storage upload to form-media (D-17, FORM-06).
      -- maxPhotos=8. attachPhotos=false (the field IS the photo input).
      e_photos::text, jsonb_build_object(
        'type', 'multiPhotoField',
        'attributes', jsonb_build_object(
          'label',        'Site condition photos',
          'required',     false,
          'helpText',     'Attach up to 8 photos of the site condition',
          'maxPhotos',    8,
          'attachPhotos', false
        )
      ),

      -- ─── 7. geolocationField: "Site GPS location" ──────────────────────
      -- Exercises navigator.geolocation, Leaflet map preview (D-13),
      -- desktop accuracy badge (D-12), click-to-pin (D-13).
      -- attachPhotos=true for affordance UAT.
      e_geolocation::text, jsonb_build_object(
        'type', 'geolocationField',
        'attributes', jsonb_build_object(
          'label',        'Site GPS location',
          'required',     true,
          'helpText',     'Click Refresh to capture current GPS position',
          'attachPhotos', true
        )
      ),

      -- ─── 8. numberField: "Likelihood (1-5)" ────────────────────────────
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
          'attachPhotos', false
        )
      ),

      -- ─── 9. numberField: "Consequence (1-5)" ───────────────────────────
      -- PAS 79 risk matrix input. Range 1-5 (D-07, D-09).
      -- This entity ID is referenced by the computedField's computedInputs.consequence.
      e_consequence::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label',        'Consequence (1-5)',
          'required',     true,
          'min',          1,
          'max',          5,
          'unit',         '',
          'attachPhotos', false
        )
      ),

      -- ─── 10. computedField: "PAS 79 risk level" ────────────────────────
      -- Exercises reactive computed badge + PAS 79 colour banding (D-07..D-10).
      -- formula="pas79" per D-08 (string enum, extensible).
      -- computedInputs maps to the two numberField UUIDs above (D-09).
      -- NO required attribute — computedField is always read-only (D-10, RESEARCH note).
      -- attachPhotos=false (the field displays a computed value, not a user input).
      e_computed::text, jsonb_build_object(
        'type', 'computedField',
        'attributes', jsonb_build_object(
          'label',          'PAS 79 risk level',
          'formula',        'pas79',
          'computedInputs', jsonb_build_object(
            'likelihood',  e_likelihood::text,
            'consequence', e_consequence::text
          ),
          'attachPhotos',   false
        )
      ),

      -- ─── 11. repeatingSection: "Fire doors register" ───────────────────
      -- FRA-doors canonical test (CONTEXT §specifics).
      -- minInstances=1: at least one door must be recorded before submit.
      -- maxInstances=20: realistic upper bound for a site.
      -- children array MUST list all 3 child UUIDs (coltorapps EntityParentMismatch rule).
      -- NO attachPhotos — repeatingSection is a container (D-05).
      e_rep_section::text, jsonb_build_object(
        'type', 'repeatingSection',
        'attributes', jsonb_build_object(
          'title',        'Fire doors register',
          'description',  'List each fire door on site. Add one entry per door.',
          'minInstances', 1,
          'maxInstances', 20
        ),
        'children', jsonb_build_array(
          e_door_loc::text,
          e_door_cond::text,
          e_door_gap::text
        )
      ),

      -- ─── 11a. textField (child): "Door location" ───────────────────────
      -- Required child of repeatingSection.
      -- parentId = e_rep_section (coltorapps EntityParentMismatch rule: child must carry parentId).
      e_door_loc::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label',        'Door location',
          'required',     true,
          'placeholder',  'e.g. Main entrance',
          'helpText',     '',
          'prefillSource','',
          'attachPhotos', false
        ),
        'parentId', e_rep_section::text
      ),

      -- ─── 11b. selectField (child): "Door condition" ────────────────────
      -- Required child of repeatingSection. Options: Good / Marginal / Poor.
      -- allowMultiple=false (single selection).
      -- parentId = e_rep_section.
      e_door_cond::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Door condition',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'Good',     'value', 'good'),
            jsonb_build_object('label', 'Marginal', 'value', 'marginal'),
            jsonb_build_object('label', 'Poor',     'value', 'poor')
          ),
          'allowMultiple', false,
          'attachPhotos',  false
        ),
        'parentId', e_rep_section::text
      ),

      -- ─── 11c. numberField (child): "Gap (mm)" ──────────────────────────
      -- Optional child of repeatingSection. Unit "mm". No range constraint.
      -- parentId = e_rep_section.
      e_door_gap::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label',        'Gap (mm)',
          'required',     false,
          'unit',         'mm',
          'attachPhotos', false
        ),
        'parentId', e_rep_section::text
      )

    ), -- end entities

    -- root: 11 top-level entity IDs only.
    -- The 3 repeatingSection children (e_door_loc, e_door_cond, e_door_gap)
    -- are NOT in root — they carry parentId and are accessed via the
    -- repeatingSection's children array.
    'root', jsonb_build_array(
      e_site_name::text,
      e_insp_notes::text,
      e_observations::text,
      e_signature::text,
      e_rating::text,
      e_photos::text,
      e_geolocation::text,
      e_likelihood::text,
      e_consequence::text,
      e_computed::text,
      e_rep_section::text
    )

  ); -- end jsonb_build_object (schema)

  -- Insert the template_versions row (version 1, draft — admin publishes via builder if desired)
  INSERT INTO template_versions (template_id, version_number, schema_json, created_by)
  VALUES (v_template_id, 1, v_schema, v_admin_id);

  RAISE NOTICE 'Phase 14: Specialty Fields Smoke Test template created — template_id %', v_template_id;
END;
$$ LANGUAGE plpgsql;
