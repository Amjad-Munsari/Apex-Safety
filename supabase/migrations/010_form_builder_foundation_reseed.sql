-- 010_form_builder_foundation_reseed.sql
-- 888 Safety & Training Platform
-- Drop existing form data (custom FormSchema shape) and reseed with coltorapps shape.
--
-- D-06 pre-condition: executor confirmed form_submissions contains only dev/test data
-- (1 row, status='draft', answers literally "test") — safe to truncate.
--
-- Truncation order: child tables first to respect FK constraints.
--   form_submissions  → FK → form_assignments, template_versions
--   form_assignments  → FK → clients, form_templates, template_versions
--   template_versions → FK → form_templates
--   form_templates    → (root of these 4 tables)
--
-- CASCADE handles any residual FK children automatically.

TRUNCATE TABLE form_submissions  CASCADE;
TRUNCATE TABLE form_assignments  CASCADE;
TRUNCATE TABLE template_versions CASCADE;
TRUNCATE TABLE form_templates    CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Basic Types Smoke Test template
-- Exercises all 7 coltorapps entity types:
--   textField, numberField, dateField, selectField,
--   textareaField, checkboxField, sectionGroup
--
-- Entity UUIDs are generated at migration runtime via gen_random_uuid().
-- The sectionGroup contains one child textField (parentId set on the child).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_admin_id        UUID;
  v_template_id     UUID;

  -- Entity IDs for the smoke-test schema
  e_section         UUID := gen_random_uuid();
  e_text_in_section UUID := gen_random_uuid();
  e_text            UUID := gen_random_uuid();
  e_number          UUID := gen_random_uuid();
  e_date            UUID := gen_random_uuid();
  e_select          UUID := gen_random_uuid();
  e_textarea        UUID := gen_random_uuid();
  e_checkbox        UUID := gen_random_uuid();

  v_schema          JSONB;
BEGIN
  -- Resolve admin user (the template owner)
  SELECT id INTO v_admin_id FROM admin_users LIMIT 1;

  -- Insert smoke-test form_templates row
  INSERT INTO form_templates (id, name, template_type, owner_id, owner_type, is_published)
  VALUES (gen_random_uuid(), 'Basic Types Smoke Test', 'fra', v_admin_id, 'admin', false)
  RETURNING id INTO v_template_id;

  -- Build the coltorapps { entities, root } schema_json.
  -- Root contains: sectionGroup first, then the 5 standalone fields.
  -- e_text_in_section is a child of e_section (parentId set, NOT in root).
  v_schema := jsonb_build_object(
    'entities', jsonb_build_object(
      -- sectionGroup container.
      -- coltorapps validateSchema enforces parent/child consistency
      -- (EntityParentMismatch): the parent MUST list its children, not just
      -- rely on the child's parentId.
      e_section::text, jsonb_build_object(
        'type', 'sectionGroup',
        'attributes', jsonb_build_object(
          'title', 'Basic Section',
          'description', 'A section grouping example'
        ),
        'children', jsonb_build_array(e_text_in_section::text)
      ),
      -- textField nested inside the sectionGroup
      e_text_in_section::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label', 'Name (in section)',
          'required', true,
          'placeholder', 'Enter your name',
          'prefillSource', ''
        ),
        'parentId', e_section::text
      ),
      -- standalone textField
      e_text::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label', 'Notes',
          'required', false,
          'placeholder', 'Enter notes',
          'prefillSource', ''
        )
      ),
      -- numberField
      e_number::text, jsonb_build_object(
        'type', 'numberField',
        'attributes', jsonb_build_object(
          'label', 'Staff Count',
          'required', false
        )
      ),
      -- dateField
      e_date::text, jsonb_build_object(
        'type', 'dateField',
        'attributes', jsonb_build_object(
          'label', 'Inspection Date',
          'required', true,
          'prefillSource', 'currentDate'
        )
      ),
      -- selectField with 2 options
      e_select::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label', 'Risk Level',
          'required', true,
          'options', jsonb_build_array(
            jsonb_build_object('label', 'Low', 'value', 'low'),
            jsonb_build_object('label', 'High', 'value', 'high')
          ),
          'allowMultiple', false
        )
      ),
      -- textareaField
      e_textarea::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label', 'Observations',
          'required', false,
          'placeholder', 'Describe any observations'
        )
      ),
      -- checkboxField
      e_checkbox::text, jsonb_build_object(
        'type', 'checkboxField',
        'attributes', jsonb_build_object(
          'label', 'Confirmed by assessor',
          'required', true,
          'defaultChecked', false
        )
      )
    ),
    -- root: only top-level entities (NOT e_text_in_section — it has a parentId)
    'root', jsonb_build_array(
      e_section::text,
      e_text::text,
      e_number::text,
      e_date::text,
      e_select::text,
      e_textarea::text,
      e_checkbox::text
    )
  );

  -- Insert the smoke-test template_versions row (version 1, unpublished draft)
  INSERT INTO template_versions (template_id, version_number, schema_json, created_by)
  VALUES (v_template_id, 1, v_schema, v_admin_id);
END;
$$;
