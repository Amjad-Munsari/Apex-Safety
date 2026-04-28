-- 001_initial_schema.sql
-- 888 Safety & Training Platform — initial database schema
-- Tables, RLS policies, indexes, storage buckets

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  site_address    TEXT,
  hours_balance   NUMERIC(10,2) NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_users (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  email    TEXT NOT NULL
);

CREATE TABLE client_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- FORM BUILDER
-- ─────────────────────────────────────────────────────────────

CREATE TABLE form_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  template_type TEXT NOT NULL,
  owner_id      UUID REFERENCES admin_users(id),
  owner_type    TEXT DEFAULT 'admin',
  is_published  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  schema_json     JSONB NOT NULL,
  published_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES admin_users(id),
  UNIQUE(template_id, version_number)
);

-- ─────────────────────────────────────────────────────────────
-- FORM ASSIGNMENTS & SUBMISSIONS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE form_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  template_id         UUID NOT NULL REFERENCES form_templates(id),
  template_version_id UUID NOT NULL REFERENCES template_versions(id),
  assigned_by         UUID REFERENCES admin_users(id),
  due_date            DATE,
  status              TEXT NOT NULL DEFAULT 'assigned',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE form_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id        UUID NOT NULL REFERENCES form_assignments(id),
  client_id            UUID NOT NULL REFERENCES clients(id),
  template_version_id  UUID NOT NULL REFERENCES template_versions(id),
  answers_json         JSONB NOT NULL,
  submitted_by         UUID,
  submitted_at         TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'draft',
  report_storage_path  TEXT,
  reviewed_by          UUID REFERENCES admin_users(id),
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filename          TEXT NOT NULL,
  document_category TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  expiry_date       DATE,
  uploaded_by       UUID REFERENCES admin_users(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────
-- HOURS / BILLING
-- ─────────────────────────────────────────────────────────────

CREATE TABLE hours_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  paypal_order_id  TEXT UNIQUE,
  transaction_type TEXT NOT NULL,
  hours_amount     NUMERIC(10,2) NOT NULL,
  gbp_amount       NUMERIC(10,2),
  notes            TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PROPOSALS & CONTRACTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  unit_price  NUMERIC(10,2),
  category    TEXT,
  active      BOOLEAN DEFAULT TRUE
);

CREATE TABLE proposals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  services_json             JSONB NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'draft',
  proposal_pdf_path         TEXT,
  contract_pdf_path         TEXT,
  signwell_proposal_doc_id  TEXT,
  signwell_contract_doc_id  TEXT,
  created_by                UUID REFERENCES admin_users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS (DEDUP)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE notifications_sent (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id),
  notification_type TEXT NOT NULL,
  document_id       UUID REFERENCES documents(id),
  alert_window      INTEGER,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, alert_window, notification_type)
);

-- ─────────────────────────────────────────────────────────────
-- RLS: ENABLE ON ALL TABLES WITH CLIENT DATA
-- ─────────────────────────────────────────────────────────────

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hours_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_sent ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: admin_users
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "admin_users_self_select" ON admin_users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "admin_users_self_update" ON admin_users
  FOR UPDATE USING (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: client_users
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "client_users_self_select" ON client_users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "client_users_admin_all" ON client_users
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: clients
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "clients_admin_all" ON clients
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "clients_own_select" ON clients
  FOR SELECT USING (
    id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: form_templates
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "form_templates_admin_all" ON form_templates
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "form_templates_client_published" ON form_templates
  FOR SELECT USING (is_published = TRUE);

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: template_versions
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "template_versions_admin_all" ON template_versions
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "template_versions_client_published" ON template_versions
  FOR SELECT USING (published_at IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: form_assignments
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "form_assignments_admin_all" ON form_assignments
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "form_assignments_client_own" ON form_assignments
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: form_submissions
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "form_submissions_admin_all" ON form_submissions
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "form_submissions_client_delivered" ON form_submissions
  FOR SELECT USING (
    status = 'delivered'
    AND client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

CREATE POLICY "form_submissions_client_insert" ON form_submissions
  FOR INSERT WITH CHECK (
    client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

CREATE POLICY "form_submissions_client_update_draft" ON form_submissions
  FOR UPDATE USING (
    status = 'draft'
    AND client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: documents
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "documents_admin_all" ON documents
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "documents_client_own" ON documents
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: hours_transactions
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "hours_transactions_admin_all" ON hours_transactions
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "hours_transactions_client_own" ON hours_transactions
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: services
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "services_admin_all" ON services
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "services_authenticated_select" ON services
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: proposals
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "proposals_admin_all" ON proposals
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "proposals_client_visible" ON proposals
  FOR SELECT USING (
    status IN ('sent', 'signed', 'contract_sent', 'contract_signed')
    AND client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: notifications_sent
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "notifications_sent_admin_select" ON notifications_sent
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─────────────────────────────────────────────────────────────
-- INDEXES (RLS performance + query patterns)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX idx_client_users_id ON client_users(id);
CREATE INDEX idx_client_users_client_id ON client_users(client_id);
CREATE INDEX idx_form_assignments_client_id ON form_assignments(client_id);
CREATE INDEX idx_form_submissions_client_id ON form_submissions(client_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_assignment_id ON form_submissions(assignment_id);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_expiry_date ON documents(expiry_date);
CREATE INDEX idx_hours_transactions_client_id ON hours_transactions(client_id);
CREATE INDEX idx_proposals_client_id ON proposals(client_id);
CREATE INDEX idx_notifications_sent_dedup ON notifications_sent(document_id, alert_window, notification_type);
CREATE INDEX idx_template_versions_template_id ON template_versions(template_id);

-- ─────────────────────────────────────────────────────────────
-- HELPER: credit_hours_from_paypal (atomic balance update)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION credit_hours_from_paypal(
  p_client_id UUID,
  p_order_id TEXT,
  p_hours NUMERIC(10,2),
  p_gbp NUMERIC(10,2)
) RETURNS VOID AS $$
BEGIN
  INSERT INTO hours_transactions (client_id, paypal_order_id, transaction_type, hours_amount, gbp_amount)
  VALUES (p_client_id, p_order_id, 'purchase', p_hours, p_gbp);

  UPDATE clients SET hours_balance = hours_balance + p_hours WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- STORAGE BUCKETS (all private, RLS on storage.objects)
-- ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', FALSE);
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', FALSE);
INSERT INTO storage.buckets (id, name, public) VALUES ('proposals', 'proposals', FALSE);
INSERT INTO storage.buckets (id, name, public) VALUES ('form-media', 'form-media', FALSE);
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', TRUE);

-- ─────────────────────────────────────────────────────────────
-- STORAGE RLS: client-documents
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "client_documents_admin_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'client-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "client_documents_client_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT client_id::text FROM client_users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- STORAGE RLS: reports
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "reports_admin_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'reports'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "reports_client_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] IN (
      SELECT client_id::text FROM client_users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- STORAGE RLS: proposals
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "proposals_storage_admin_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'proposals'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "proposals_storage_client_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'proposals'
    AND (storage.foldername(name))[1] IN (
      SELECT client_id::text FROM client_users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- STORAGE RLS: form-media
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "form_media_admin_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'form-media'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "form_media_client_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'form-media'
    AND (storage.foldername(name))[1] IN (
      SELECT client_id::text FROM client_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "form_media_client_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'form-media'
    AND (storage.foldername(name))[1] IN (
      SELECT client_id::text FROM client_users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- STORAGE RLS: brand-assets (public bucket — read-only for all)
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "brand_assets_admin_manage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'brand-assets'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "brand_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'brand-assets');
