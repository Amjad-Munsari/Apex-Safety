-- 016_phase18_fra_seed.sql
-- 888 Safety & Training Platform
-- Seed: "Fire Risk Assessment (Type 3) — Single Premises" admin master template.
--
-- Phase 18 — Plan 18-01
-- Purpose: Insert the canonical FRA Type 3 admin master seed row so customer surfaces
--          can see and fill the template via the existing Phase 16 RLS policy
--          `form_templates_client_published`. This migration IS the deliverable — no
--          application code changes are needed (renderers + visibility engine already
--          ship this in Phase 14 / 15 / 16).
--
--          AGENTS.md "DB is source of truth for seed data" — the DB row is the master;
--          lib/forms/fra-template.ts is the deprecated fallback to be deleted in Phase 18-03.
--          UI-SPEC §Copywriting Contract — all FRA-specific labels are content-locked here.
--          RESEARCH §Q4 — SQL migration is the canonical seed mechanism (see rationale table).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DIVERGENCES FROM MIGRATIONS 011 / 012 (smoke-test seeds):
--
--   1. is_published = TRUE on form_templates (smoke tests set false — UAT-only).
--      Required so `form_templates_client_published` RLS policy makes the row
--      readable to all client_users. Without this, the FRA never appears on the
--      customer assignment surface. (RESEARCH Pitfall P2)
--
--   2. published_at = NOW() on template_versions (smoke tests omit this column).
--      Required by the `template_versions_client_published` RLS policy.
--      (RESEARCH Pitfall P2)
--
--   3. Fixed UUID literals for both rows + idempotency guard (ON CONFLICT + DO NOTHING)
--      on BOTH inserts — makes the migration safe for prod blue-green deploys and
--      CI re-runs. Smoke tests used gen_random_uuid() because they are never
--      deployed to prod. (RESEARCH §Q4)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ENTITY LAYOUT (30 entities total):
--
--   Root array (6 top-level sectionGroups):
--     §01  sectionGroup  "01 — Premises Details"
--     §02  sectionGroup  "02 — Fire Safety Management"
--     §03  sectionGroup  "03 — Means of Escape"
--     §04  sectionGroup  "04 — Fire Protection Measures"
--     §05  sectionGroup  "05 — Findings & Action Plan"
--     §06  sectionGroup  "06 — Sign-Off"
--
--   §01 children (5 entities):
--     01-a geolocationField "Site location" (FIRST — per CONTEXT §Specialty Fields)
--     01-b textField        "Premises name"
--     01-c textareaField    "Site address"
--     01-d textField        "Responsible person"
--     01-e selectField      "Occupancy type"
--
--   §02 children (4 entities):
--     02-a selectField      "Is a written fire safety policy in place?" (drives §02a)
--     02-b numberField      "Number of trained fire wardens"
--     02-c textareaField    "Observations on fire safety management"
--     §02a sectionGroup     "Policy remediation" (conditional — visible on out_of_date|no)
--       02a-i  dateField    "When was the last review?"
--       02a-ii textareaField "What needs updating?"
--
--   §03 children (4 entities):
--     03-a selectField      "Are all escape routes clear?" (drives §03a)
--     03-b textareaField    "Exit signage and emergency lighting findings"
--     03-c multiPhotoField  "Photographic evidence — Means of Escape" (required, maxPhotos:8)
--     §03a sectionGroup     "Obstruction details" (conditional — visible on partial|no)
--       03a-i  textareaField "Describe obstructions"
--       03a-ii multiPhotoField "Obstruction photos" (required, maxPhotos:5)
--
--   §04 children (4 entities):
--     04-a selectField      "Detection system" (drives §04a)
--     04-b dateField        "Last extinguisher service date"
--     04-c textareaField    "Fire door inspection findings"
--     04-d multiPhotoField  "Photographic evidence — Fire Protection Measures" (required, maxPhotos:8)
--     §04a sectionGroup     "Detection upgrade plan" (conditional — visible on none)
--       04a-i  textareaField "Recommended detection level"
--       04a-ii selectField  "Recommended grade" (L1/L2/L3/L4)
--
--   §05 children (5 entities + Action Plan children):
--     05-a numberField      "Likelihood (1–5)" (PAS 79 input)
--     05-b numberField      "Consequence (1–5)" (PAS 79 input)
--     05-c computedField    "Risk score (PAS 79)" (Pitfall P1 — use computedField with formula=pas79)
--     05-d repeatingSection "Action Plan"
--       05d-i  textareaField "Action description"
--       05d-ii textField     "Responsible person"
--       05d-iii dateField    "Target completion date"
--       05d-iv selectField   "Priority" (High/Medium/Low)
--     05-e textareaField    "General observations"
--
--   §06 children (1 entity):
--     06-a signatureField   "Responsible Person signature" (LAST field)
--
-- coltorapps parent/child consistency (EntityParentMismatch rule):
--   Every container lists its children in its own children array.
--   Every child carries parentId pointing back to the container.
--   Both must be present — neither alone is sufficient.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_admin_id    UUID;

  -- Pitfall P2: Fixed UUIDs for idempotency on prod blue-green deploys.
  -- These constants are stable across all environments — re-running this
  -- migration on a populated DB is a no-op (idempotent insert with conflict guard).
  v_template_id UUID := '00000000-0000-4000-a000-000000000018'::uuid;
  v_version_id  UUID := '00000000-0000-4000-a000-000000000118'::uuid;

  -- ── Top-level section UUIDs ────────────────────────────────────────────────
  e_section_01  UUID := gen_random_uuid();   -- §01 Premises Details
  e_section_02  UUID := gen_random_uuid();   -- §02 Fire Safety Management
  e_section_03  UUID := gen_random_uuid();   -- §03 Means of Escape
  e_section_04  UUID := gen_random_uuid();   -- §04 Fire Protection Measures
  e_section_05  UUID := gen_random_uuid();   -- §05 Findings & Action Plan
  e_section_06  UUID := gen_random_uuid();   -- §06 Sign-Off

  -- ── §01 Premises Details field UUIDs ──────────────────────────────────────
  e_site_geolocation UUID := gen_random_uuid();  -- geolocationField FIRST (CONTEXT §Specialty)
  e_premises_name    UUID := gen_random_uuid();  -- textField
  e_site_address     UUID := gen_random_uuid();  -- textareaField
  e_resp_person      UUID := gen_random_uuid();  -- textField (responsible person)
  e_occupancy_type   UUID := gen_random_uuid();  -- selectField

  -- ── §02 Fire Safety Management field UUIDs ────────────────────────────────
  e_policy_in_place  UUID := gen_random_uuid();  -- selectField (Yes/No driver for §02a)
  e_fire_warden_count UUID := gen_random_uuid(); -- numberField
  e_policy_obs       UUID := gen_random_uuid();  -- textareaField
  -- §02a conditional sub-section
  e_section_02a      UUID := gen_random_uuid();  -- sectionGroup "Policy remediation"
  e_last_review      UUID := gen_random_uuid();  -- dateField (child of §02a)
  e_what_updating    UUID := gen_random_uuid();  -- textareaField (child of §02a)

  -- ── §03 Means of Escape field UUIDs ───────────────────────────────────────
  e_escape_routes_clear UUID := gen_random_uuid(); -- selectField (driver for §03a)
  e_exit_signage     UUID := gen_random_uuid();  -- textareaField
  e_escape_photos    UUID := gen_random_uuid();  -- multiPhotoField (required, maxPhotos:8)
  -- §03a conditional sub-section
  e_section_03a      UUID := gen_random_uuid();  -- sectionGroup "Obstruction details"
  e_obstructions_desc UUID := gen_random_uuid(); -- textareaField (child of §03a)
  e_obstruction_photos UUID := gen_random_uuid(); -- multiPhotoField (child of §03a, maxPhotos:5)

  -- ── §04 Fire Protection Measures field UUIDs ──────────────────────────────
  e_detection_type   UUID := gen_random_uuid();  -- selectField (driver for §04a)
  e_extinguisher_date UUID := gen_random_uuid(); -- dateField
  e_fire_door_findings UUID := gen_random_uuid(); -- textareaField
  e_protection_photos UUID := gen_random_uuid(); -- multiPhotoField (required, maxPhotos:8)
  -- §04a conditional sub-section
  e_section_04a      UUID := gen_random_uuid();  -- sectionGroup "Detection upgrade plan"
  e_detection_level  UUID := gen_random_uuid();  -- textareaField (child of §04a)
  e_detection_grade  UUID := gen_random_uuid();  -- selectField (child of §04a, L1/L2/L3/L4)

  -- ── §05 Findings & Action Plan field UUIDs ────────────────────────────────
  e_likelihood       UUID := gen_random_uuid();  -- numberField (PAS 79 input, min:1 max:5)
  e_consequence      UUID := gen_random_uuid();  -- numberField (PAS 79 input, min:1 max:5)
  e_pas79            UUID := gen_random_uuid();  -- computedField formula='pas79'
  e_action_plan      UUID := gen_random_uuid();  -- repeatingSection
  -- Action Plan children (basic types only — Phase 14 §RepeatingSectionRenderer constraint)
  e_action_desc      UUID := gen_random_uuid();  -- textareaField child
  e_action_owner     UUID := gen_random_uuid();  -- textField child
  e_action_due       UUID := gen_random_uuid();  -- dateField child
  e_action_priority  UUID := gen_random_uuid();  -- selectField child (High/Medium/Low)
  e_general_obs      UUID := gen_random_uuid();  -- textareaField (after Action Plan)

  -- ── §06 Sign-Off field UUIDs ───────────────────────────────────────────────
  e_signature        UUID := gen_random_uuid();  -- signatureField LAST

  v_schema JSONB;

BEGIN
  -- Pitfall P3: owner_type='admin' requires a real admin_users.id — never NULL.
  -- Without a valid admin_users row this migration should fail loudly, not silently.
  SELECT id INTO v_admin_id FROM admin_users LIMIT 1;
  IF v_admin_id IS NULL THEN
    -- No self-seeded bootstrap admin here: silently inserting a passwordless
    -- auth.users + admin_users row is a full-admin backdoor if this migration
    -- ever replays against a database with an empty admin_users table. A fresh
    -- environment must create its first admin explicitly before replaying this
    -- seed (production had one before this ran).
    RAISE EXCEPTION 'migration 016 requires at least one admin_users row (owner_type=admin seeds need a real owner); create your first admin before replaying this migration';
  END IF;

  v_schema := jsonb_build_object(

    'entities', jsonb_build_object(

      -- ══════════════════════════════════════════════════════════════════════
      -- TOP-LEVEL SECTION GROUPS (6 — these are the only entities in root[])
      -- ══════════════════════════════════════════════════════════════════════

      -- ── §01: Premises Details ─────────────────────────────────────────────
      e_section_01::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       '01 — Premises Details',
          'description', 'Identify the premises and the responsible person.',
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'children', jsonb_build_array(
          e_site_geolocation::text,
          e_premises_name::text,
          e_site_address::text,
          e_resp_person::text,
          e_occupancy_type::text
        )
      ),

      -- ── §02: Fire Safety Management ──────────────────────────────────────
      e_section_02::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       '02 — Fire Safety Management',
          'description', 'Policies, procedures, and accountability.',
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'children', jsonb_build_array(
          e_policy_in_place::text,
          e_fire_warden_count::text,
          e_policy_obs::text,
          e_section_02a::text
        )
      ),

      -- ── §03: Means of Escape ──────────────────────────────────────────────
      e_section_03::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       '03 — Means of Escape',
          'description', 'Travel distances, exits, signage, and emergency lighting.',
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'children', jsonb_build_array(
          e_escape_routes_clear::text,
          e_exit_signage::text,
          e_escape_photos::text,
          e_section_03a::text
        )
      ),

      -- ── §04: Fire Protection Measures ────────────────────────────────────
      e_section_04::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       '04 — Fire Protection Measures',
          'description', 'Detection, suppression, and compartmentation systems.',
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'children', jsonb_build_array(
          e_detection_type::text,
          e_extinguisher_date::text,
          e_fire_door_findings::text,
          e_protection_photos::text,
          e_section_04a::text
        )
      ),

      -- ── §05: Findings & Action Plan ──────────────────────────────────────
      e_section_05::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       '05 — Findings & Action Plan',
          'description', 'Overall risk rating via PAS 79 + remedial actions.',
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'children', jsonb_build_array(
          e_likelihood::text,
          e_consequence::text,
          e_pas79::text,
          e_action_plan::text,
          e_general_obs::text
        )
      ),

      -- ── §06: Sign-Off ─────────────────────────────────────────────────────
      e_section_06::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       '06 — Sign-Off',
          'description', 'Confirm completion. Your signature certifies the findings and actions recorded above.',
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'children', jsonb_build_array(
          e_signature::text
        )
      ),

      -- ══════════════════════════════════════════════════════════════════════
      -- §01 PREMISES DETAILS — FIELD ENTITIES
      -- ══════════════════════════════════════════════════════════════════════

      -- ── §01-a: geolocationField "Site location" ───────────────────────────
      -- UI-SPEC §Copywriting Contract — label and helpText are content-locked.
      -- Placed FIRST in §01 per CONTEXT §Specialty Fields (industry FRA norm).
      e_site_geolocation::text, jsonb_build_object(
        'type', 'geolocationField',
        'attributes', jsonb_build_object(
          'label',       'Site location',
          'required',    true,
          'helpText',    'Captured automatically when you start the assessment. Tap the map to correct the pin if needed.',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_01::text
      ),

      -- ── §01-b: textField "Premises name" ──────────────────────────────────
      e_premises_name::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label',        'Premises name',
          'required',     true,
          'placeholder',  'e.g. Hallam House Care Home',
          'helpText',     '',
          'prefillSource','',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_01::text
      ),

      -- ── §01-c: textareaField "Site address" ───────────────────────────────
      e_site_address::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'Site address',
          'required',     true,
          'placeholder',  'Full street address including postcode',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_01::text
      ),

      -- ── §01-d: textField "Responsible person" ─────────────────────────────
      e_resp_person::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label',        'Responsible person',
          'required',     true,
          'placeholder',  'Name of duty holder',
          'helpText',     '',
          'prefillSource','',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_01::text
      ),

      -- ── §01-e: selectField "Occupancy type" ───────────────────────────────
      e_occupancy_type::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Occupancy type',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'Care home / sheltered housing', 'value', 'care_home'),
            jsonb_build_object('label', 'HMO / residential',             'value', 'hmo'),
            jsonb_build_object('label', 'Office / commercial',           'value', 'office'),
            jsonb_build_object('label', 'Hospitality',                   'value', 'hospitality'),
            jsonb_build_object('label', 'Education',                     'value', 'education'),
            jsonb_build_object('label', 'Retail',                        'value', 'retail')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_01::text
      ),

      -- ══════════════════════════════════════════════════════════════════════
      -- §02 FIRE SAFETY MANAGEMENT — FIELD ENTITIES
      -- ══════════════════════════════════════════════════════════════════════

      -- ── §02-a: selectField "Is a written fire safety policy in place?" ─────
      -- Pitfall P6: drivers are selectField (not a yes/no toggle entity), rules compare option VALUE strings.
      -- This field drives the conditional sub-section §02a via two equals rules with logic:'or'.
      e_policy_in_place::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Is a written fire safety policy in place?',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'Yes — current and signed', 'value', 'yes_current'),
            jsonb_build_object('label', 'Yes — but out of date',    'value', 'out_of_date'),
            jsonb_build_object('label', 'No',                       'value', 'no')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_02::text
      ),

      -- ── §02-b: numberField "Number of trained fire wardens" ───────────────
      e_fire_warden_count::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label',        'Number of trained fire wardens',
          'required',     false,
          'min',          0,
          'max',          999,
          'unit',         '',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_02::text
      ),

      -- ── §02-c: textareaField "Observations on fire safety management" ──────
      e_policy_obs::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'Observations on fire safety management',
          'required',     false,
          'placeholder',  'Note training gaps, staff awareness, last drill date, etc.',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_02::text
      ),

      -- ── §02a: sectionGroup "Policy remediation" (CONDITIONAL) ─────────────
      -- Pitfall P6: drivers are selectField (not a yes/no toggle entity), rules compare option VALUE strings.
      -- Revealed when policy_in_place = 'out_of_date' OR 'no'.
      -- Two equals rules with logic:'or' — never 'contains' for enum disjunction (RESEARCH §Q3).
      e_section_02a::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       'Policy remediation',
          'description', 'Complete this section when the fire safety policy is missing or out of date.',
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(
              jsonb_build_object(
                'sourceEntityId', e_policy_in_place::text,
                'operator',       'equals',
                'value',          'out_of_date',
                'action',         'show'
              ),
              jsonb_build_object(
                'sourceEntityId', e_policy_in_place::text,
                'operator',       'equals',
                'value',          'no',
                'action',         'show'
              )
            ),
            'logic', 'or'
          )
        ),
        'parentId', e_section_02::text,
        'children', jsonb_build_array(
          e_last_review::text,
          e_what_updating::text
        )
      ),

      -- ── §02a-i: dateField "When was the last review?" ─────────────────────
      e_last_review::text, jsonb_build_object(
        'type', 'dateField',
        'attributes', jsonb_build_object(
          'label',        'When was the last review?',
          'required',     true,
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_02a::text
      ),

      -- ── §02a-ii: textareaField "What needs updating?" ─────────────────────
      e_what_updating::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'What needs updating?',
          'required',     true,
          'placeholder',  'Describe the gaps or expired content in the current policy',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_02a::text
      ),

      -- ══════════════════════════════════════════════════════════════════════
      -- §03 MEANS OF ESCAPE — FIELD ENTITIES
      -- ══════════════════════════════════════════════════════════════════════

      -- ── §03-a: selectField "Are all escape routes clear?" ─────────────────
      -- Pitfall P6: drivers are selectField (not a yes/no toggle entity), rules compare option VALUE strings.
      -- Drives conditional sub-section §03a on 'partial' OR 'no'.
      e_escape_routes_clear::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Are all escape routes clear and unobstructed?',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'Yes',                              'value', 'yes'),
            jsonb_build_object('label', 'Partially — minor obstructions',   'value', 'partial'),
            jsonb_build_object('label', 'No — significant obstructions',    'value', 'no')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_03::text
      ),

      -- ── §03-b: textareaField "Exit signage and emergency lighting findings"
      e_exit_signage::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'Exit signage and emergency lighting findings',
          'required',     false,
          'placeholder',  'Note any missing or non-compliant signage and lights',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_03::text
      ),

      -- ── §03-c: multiPhotoField "Photographic evidence — Means of Escape" ──
      -- required=true, maxPhotos=8 (RESEARCH §Q7 resolution).
      -- UI-SPEC Delta 1: per-section photo evidence is a dedicated multiPhotoField
      -- placed as the last unconditional field of the section.
      e_escape_photos::text, jsonb_build_object(
        'type', 'multiPhotoField',
        'attributes', jsonb_build_object(
          'label',        'Photographic evidence — Means of Escape',
          'required',     true,
          'helpText',     'Capture each protected route, including final exits.',
          'maxPhotos',    8,
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_03::text
      ),

      -- ── §03a: sectionGroup "Obstruction details" (CONDITIONAL) ───────────
      -- Pitfall P6: drivers are selectField (not a yes/no toggle entity), rules compare option VALUE strings.
      -- Revealed when escape_routes_clear = 'partial' OR 'no'.
      e_section_03a::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       'Obstruction details',
          'description', 'Complete this section when escape routes are partially or fully obstructed.',
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(
              jsonb_build_object(
                'sourceEntityId', e_escape_routes_clear::text,
                'operator',       'equals',
                'value',          'partial',
                'action',         'show'
              ),
              jsonb_build_object(
                'sourceEntityId', e_escape_routes_clear::text,
                'operator',       'equals',
                'value',          'no',
                'action',         'show'
              )
            ),
            'logic', 'or'
          )
        ),
        'parentId', e_section_03::text,
        'children', jsonb_build_array(
          e_obstructions_desc::text,
          e_obstruction_photos::text
        )
      ),

      -- ── §03a-i: textareaField "Describe obstructions" ────────────────────
      e_obstructions_desc::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'Describe obstructions',
          'required',     true,
          'placeholder',  'Specify locations and nature of each obstruction',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_03a::text
      ),

      -- ── §03a-ii: multiPhotoField "Obstruction photos" ────────────────────
      -- required=true, maxPhotos=5 (RESEARCH §Q7 — conditional sub-section).
      e_obstruction_photos::text, jsonb_build_object(
        'type', 'multiPhotoField',
        'attributes', jsonb_build_object(
          'label',        'Obstruction photos',
          'required',     true,
          'helpText',     'Photograph each obstruction to support the written description above.',
          'maxPhotos',    5,
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_03a::text
      ),

      -- ══════════════════════════════════════════════════════════════════════
      -- §04 FIRE PROTECTION MEASURES — FIELD ENTITIES
      -- ══════════════════════════════════════════════════════════════════════

      -- ── §04-a: selectField "Detection system" ─────────────────────────────
      -- Pitfall P6: drivers are selectField (not a yes/no toggle entity), rules compare option VALUE strings.
      -- Drives conditional sub-section §04a when 'none'.
      e_detection_type::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Detection system',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'L1 — full coverage',     'value', 'l1'),
            jsonb_build_object('label', 'L2',                     'value', 'l2'),
            jsonb_build_object('label', 'L3',                     'value', 'l3'),
            jsonb_build_object('label', 'L4 — escape route only', 'value', 'l4'),
            jsonb_build_object('label', 'None / domestic only',   'value', 'none')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_04::text
      ),

      -- ── §04-b: dateField "Last extinguisher service date" ─────────────────
      -- Baseline had type:"text" with placeholder "e.g. 14 Feb 2026".
      -- Phase 18 promotes to dateField (RESEARCH mapping table §interfaces).
      e_extinguisher_date::text, jsonb_build_object(
        'type', 'dateField',
        'attributes', jsonb_build_object(
          'label',        'Last extinguisher service date',
          'required',     false,
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_04::text
      ),

      -- ── §04-c: textareaField "Fire door inspection findings" ──────────────
      e_fire_door_findings::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'Fire door inspection findings',
          'required',     false,
          'placeholder',  'Cold smoke seals, intumescent strips, self-closers, gaps...',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_04::text
      ),

      -- ── §04-d: multiPhotoField "Photographic evidence — Fire Protection" ──
      -- required=true, maxPhotos=8 (RESEARCH §Q7).
      e_protection_photos::text, jsonb_build_object(
        'type', 'multiPhotoField',
        'attributes', jsonb_build_object(
          'label',        'Photographic evidence — Fire Protection Measures',
          'required',     true,
          'helpText',     'Photograph any defects on doors, alarms, or extinguishers.',
          'maxPhotos',    8,
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_04::text
      ),

      -- ── §04a: sectionGroup "Detection upgrade plan" (CONDITIONAL) ─────────
      -- Pitfall P6: drivers are selectField (not a yes/no toggle entity), rules compare option VALUE strings.
      -- Revealed when detection_type = 'none'.
      e_section_04a::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title',       'Detection upgrade plan',
          'description', 'Complete this section when no detection system is in place.',
          'visibilityRules', jsonb_build_object(
            'rules', jsonb_build_array(
              jsonb_build_object(
                'sourceEntityId', e_detection_type::text,
                'operator',       'equals',
                'value',          'none',
                'action',         'show'
              )
            ),
            'logic', 'or'
          )
        ),
        'parentId', e_section_04::text,
        'children', jsonb_build_array(
          e_detection_level::text,
          e_detection_grade::text
        )
      ),

      -- ── §04a-i: textareaField "Recommended detection level" ──────────────
      e_detection_level::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'Recommended detection level',
          'required',     true,
          'placeholder',  'Describe the minimum acceptable detection coverage for this premises',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_04a::text
      ),

      -- ── §04a-ii: selectField "Recommended grade" ──────────────────────────
      -- Options: L1/L2/L3/L4 (RESEARCH Q3 mapping table).
      e_detection_grade::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Recommended grade',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'L1 — full coverage',     'value', 'L1'),
            jsonb_build_object('label', 'L2',                     'value', 'L2'),
            jsonb_build_object('label', 'L3',                     'value', 'L3'),
            jsonb_build_object('label', 'L4 — escape route only', 'value', 'L4')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_04a::text
      ),

      -- ══════════════════════════════════════════════════════════════════════
      -- §05 FINDINGS & ACTION PLAN — FIELD ENTITIES
      -- ══════════════════════════════════════════════════════════════════════

      -- ── §05-a: numberField "Likelihood (1–5)" ─────────────────────────────
      -- PAS 79 risk matrix input. UI-SPEC Delta 2 — label and helpText are content-locked.
      -- Feeds computedField e_pas79 via computedInputs.likelihood.
      e_likelihood::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label',        'Likelihood (1–5)',
          'required',     true,
          'min',          1,
          'max',          5,
          'unit',         '',
          'helpText',     '1 = Very Low, 2 = Low, 3 = Medium, 4 = High, 5 = Very High',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_05::text
      ),

      -- ── §05-b: numberField "Consequence (1–5)" ────────────────────────────
      -- PAS 79 risk matrix input. UI-SPEC Delta 2 — label and helpText are content-locked.
      -- Feeds computedField e_pas79 via computedInputs.consequence.
      e_consequence::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label',        'Consequence (1–5)',
          'required',     true,
          'min',          1,
          'max',          5,
          'unit',         '',
          'helpText',     '1 = Insignificant, 2 = Minor, 3 = Moderate, 4 = Major, 5 = Catastrophic',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_05::text
      ),

      -- ── §05-c: computedField "Risk score (PAS 79)" ────────────────────────
      -- Pitfall P1: PAS 79 is a computedField with formula='pas79' — never invent a fictional risk-matrix entity type.
      -- formula='pas79' is the string enum wired to lib/form-builder/risk/pas79.ts.
      -- UI-SPEC Delta 3 — label is content-locked: 'Risk score (PAS 79)'.
      -- computedInputs must reference the two numberField UUIDs above (D-09).
      e_pas79::text, jsonb_build_object(
        'type', 'computedField',
        'attributes', jsonb_build_object(
          'label',          'Risk score (PAS 79)',
          'formula',        'pas79',
          'computedInputs', jsonb_build_object(
            'likelihood',  e_likelihood::text,
            'consequence', e_consequence::text
          ),
          'helpText',       'Auto-calculated from Likelihood × Consequence above.',
          'attachPhotos',   false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_05::text
      ),

      -- ── §05-d: repeatingSection "Action Plan" ─────────────────────────────
      -- Phase 14 §RepeatingSectionRenderer constraint: Action Plan children must be
      -- basic types only — no signature/photo/geolocation/computed/rating/nested-repeating
      -- inside instances. The Phase 14 RepeatingSectionRenderer enforces this; nesting WILL break.
      -- minInstances:0 (no remediation needed is a valid outcome), maxInstances:50.
      -- UI-SPEC §Copywriting Contract — title and description are content-locked.
      e_action_plan::text, jsonb_build_object(
        'type', 'repeatingSection',
        'attributes', jsonb_build_object(
          'title',        'Action Plan',
          'description',  'One row per remedial action. Add as many as required.',
          'minInstances', 0,
          'maxInstances', 50,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_05::text,
        'children', jsonb_build_array(
          e_action_desc::text,
          e_action_owner::text,
          e_action_due::text,
          e_action_priority::text
        )
      ),

      -- ── §05-d-i: textareaField "Action description" ───────────────────────
      -- Phase 14 §RepeatingSectionRenderer constraint: only basic types inside Action Plan.
      -- parentId = e_action_plan (coltorapps EntityParentMismatch rule: child must carry parentId).
      e_action_desc::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'Action description',
          'required',     true,
          'placeholder',  'What needs doing?',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      ),

      -- ── §05-d-ii: textField "Responsible person" ──────────────────────────
      -- Phase 14 §RepeatingSectionRenderer constraint: only basic types inside Action Plan.
      e_action_owner::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label',        'Responsible person',
          'required',     true,
          'placeholder',  'Who owns this?',
          'helpText',     '',
          'prefillSource','',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      ),

      -- ── §05-d-iii: dateField "Target completion date" ─────────────────────
      -- Phase 14 §RepeatingSectionRenderer constraint: only basic types inside Action Plan.
      e_action_due::text, jsonb_build_object(
        'type', 'dateField',
        'attributes', jsonb_build_object(
          'label',        'Target completion date',
          'required',     true,
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      ),

      -- ── §05-d-iv: selectField "Priority" ──────────────────────────────────
      -- Phase 14 §RepeatingSectionRenderer constraint: only basic types inside Action Plan.
      -- Options: High / Medium / Low (UI-SPEC §Copywriting Contract — content-locked).
      e_action_priority::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',         'Priority',
          'required',      true,
          'options',       jsonb_build_array(
            jsonb_build_object('label', 'High',   'value', 'High'),
            jsonb_build_object('label', 'Medium', 'value', 'Medium'),
            jsonb_build_object('label', 'Low',    'value', 'Low')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      ),

      -- ── §05-e: textareaField "General observations" ───────────────────────
      e_general_obs::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label',        'General observations',
          'required',     false,
          'placeholder',  'Anything else noted during the walk-around',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_05::text
      ),

      -- ══════════════════════════════════════════════════════════════════════
      -- §06 SIGN-OFF — FIELD ENTITIES
      -- ══════════════════════════════════════════════════════════════════════

      -- ── §06-a: signatureField "Responsible Person signature" ──────────────
      -- UI-SPEC §Copywriting Contract — label and helpText are content-locked.
      -- Placed LAST in §06 (the final entity in the form).
      -- attachPhotos=false: signature canvas IS the input; no supplementary photos.
      e_signature::text, jsonb_build_object(
        'type', 'signatureField',
        'attributes', jsonb_build_object(
          'label',        'Responsible Person signature',
          'required',     true,
          'helpText',     'Sign to certify this assessment is complete and accurate.',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_section_06::text
      )

    ), -- end entities

    -- ══════════════════════════════════════════════════════════════════════
    -- ROOT ARRAY — only the 6 top-level sectionGroup UUIDs.
    -- All other entities are nested via parent/children relationships.
    -- This matches migration 012's sectionGroup-rooted pattern (NOT
    -- migration 011's flat-root pattern — 011 predates sectionGroups).
    -- ══════════════════════════════════════════════════════════════════════
    'root', jsonb_build_array(
      e_section_01::text,
      e_section_02::text,
      e_section_03::text,
      e_section_04::text,
      e_section_05::text,
      e_section_06::text
    )

  ); -- end jsonb_build_object (v_schema)

  -- Pitfall P5: this seed creates a TEMPLATE — submissions happen at fill time via existing actions.
  -- Migration 016 inserts EXACTLY two rows: one in form_templates, one in template_versions.
  -- Never touch submission-side tables (handled entirely by the fill flow at runtime).

  -- Pitfall P2: diverges from smoke-tests 011/012 — this seed is a real master,
  -- customers must see it (RLS form_templates_client_published).
  -- is_published=TRUE + published_at=NOW() are BOTH required for the RLS policies to expose the row.
  INSERT INTO form_templates (id, name, template_type, owner_id, owner_type, is_published)
  VALUES (v_template_id, 'Fire Risk Assessment (Type 3) — Single Premises', 'fra', v_admin_id, 'admin', TRUE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO template_versions (id, template_id, version_number, schema_json, created_by, published_at)
  VALUES (v_version_id, v_template_id, 1, v_schema, v_admin_id, NOW())
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Phase 18: FRA Type 3 seed installed — template_id %, version_id %',
               v_template_id, v_version_id;

END;
$$ LANGUAGE plpgsql;
