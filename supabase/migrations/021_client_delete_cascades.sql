-- 021_client_delete_cascades.sql
-- Make a hard delete of a client cascade cleanly through its relational subtree.
--
-- WHY: app/admin/clients/actions.ts gains a deleteClient() action (admin-only,
-- type-the-name confirmation). Most child tables already declare
-- `client_id ... REFERENCES clients(id) ON DELETE CASCADE`, but three FKs were
-- created without an ON DELETE action and would RESTRICT (block) the delete:
--   1. form_submissions.client_id      -> clients(id)
--   2. form_submissions.assignment_id  -> form_assignments(id)
--        (without this, the form_assignments cascade is itself blocked by any
--         submission still pointing at the assignment)
--   3. notifications_sent.client_id    -> clients(id)
--
-- field_media.submission_id and proposal_signatures.proposal_id are ALREADY
-- ON DELETE CASCADE, so they follow their parents automatically.
--
-- IDEMPOTENT: we look up the real constraint name from pg_constraint by
-- (table, column) rather than assuming the Postgres default `<tbl>_<col>_fkey`,
-- drop it if present, and re-create it with ON DELETE CASCADE. Re-running is a
-- no-op beyond recreating constraints that are already correct.

DO $$
DECLARE
  rec RECORD;
  -- (child table, child column, parent table, parent column)
  targets TEXT[][] := ARRAY[
    ARRAY['form_submissions',  'client_id',     'clients',          'id'],
    ARRAY['form_submissions',  'assignment_id', 'form_assignments', 'id'],
    ARRAY['notifications_sent','client_id',     'clients',          'id']
  ];
  t TEXT[];
  conname_found TEXT;
BEGIN
  FOREACH t SLICE 1 IN ARRAY targets
  LOOP
    -- Find the existing FK constraint on (child_table.child_column).
    SELECT con.conname
      INTO conname_found
      FROM pg_constraint con
      JOIN pg_class rel       ON rel.oid = con.conrelid
      JOIN pg_namespace nsp   ON nsp.oid = rel.relnamespace
      JOIN pg_attribute att   ON att.attrelid = con.conrelid
                              AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND nsp.nspname = 'public'
       AND rel.relname = t[1]
       AND att.attname = t[2]
       AND array_length(con.conkey, 1) = 1
     LIMIT 1;

    IF conname_found IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t[1], conname_found);
    END IF;

    -- Re-add with ON DELETE CASCADE under a deterministic name.
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE CASCADE',
      t[1], t[1] || '_' || t[2] || '_fkey', t[2], t[3], t[4]
    );
  END LOOP;
END $$;
