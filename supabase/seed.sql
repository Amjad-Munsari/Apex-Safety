-- seed.sql
-- 888 Safety & Training Platform — Dummy Data Seed
-- This file populates the database with branded clients, documents, and proposals.

-- ─────────────────────────────────────────────────────────────
-- CLEANUP (Optional: Uncomment if you want a fresh start)
-- ─────────────────────────────────────────────────────────────
-- DELETE FROM notifications_sent;
-- DELETE FROM documents;
-- DELETE FROM proposals;
-- DELETE FROM client_users;
-- DELETE FROM clients;

-- ─────────────────────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────────────────────

INSERT INTO clients (id, name, site_address, hours_balance, active)
VALUES 
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Merlin Print Works Ltd', 'Unit 7, Ardwick Industrial Estate', 3.5, TRUE),
  ('b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'Argyll Self-Storage', 'Loch Road, Argyll', 4.0, TRUE),
  ('c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'Brooklyn Bakery', 'Beach Rd, Chorlton', 6.0, TRUE),
  ('d4e5f6a7-b8c9-4d8e-1f2a-3b4c5d6e7f8a', 'Hallam House Care Home', '12 Hallam St, Manchester', 0.5, TRUE),
  ('e5f6a7b8-c9d0-4e9f-2a3b-4c5d6e7f8a9b', 'Oakwood Letting Agency', 'Oakwood Square, Leeds', 2.8, TRUE),
  ('f6a7b8c9-d0e1-4f0a-3b4c-5d6e7f8a9b0c', 'Parkgate Primary School', 'Parkgate Lane, Cheshire', 8.5, TRUE),
  ('a1b2c3d4-b8c9-4d8e-1f2a-3b4c5d6e7f8b', 'Rowan & Ashe Solicitors', 'Rowan House, Manchester', 14.0, TRUE),
  ('b2c3d4e5-c9d0-4e9f-2a3b-4c5d6e7f8a9c', 'Stockley Joinery', 'Stockley Way, Salford', 18.5, TRUE)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, 
    hours_balance = EXCLUDED.hours_balance;

-- ─────────────────────────────────────────────────────────────
-- DOCUMENTS (Expiring/Overdue records to match dashboard)
-- ─────────────────────────────────────────────────────────────

INSERT INTO documents (client_id, filename, document_category, storage_path, expiry_date, active)
VALUES
  -- Hallam House: 15d overdue EICR
  ('d4e5f6a7-b8c9-4d8e-1f2a-3b4c5d6e7f8a', 'eicr_cert_2025.pdf', 'EICR', 'dummy/eicr.pdf', CURRENT_DATE - INTERVAL '15 days', TRUE),
  
  -- Oakwood Letting: 3d left Legionella
  ('e5f6a7b8-c9d0-4e9f-2a3b-4c5d6e7f8a9b', 'legionella_risk_2025.pdf', 'Legionella Risk Assessment', 'dummy/legionella.pdf', CURRENT_DATE + INTERVAL '3 days', TRUE),
  
  -- Merlin Print: 6d left PAT
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'pat_testing_2025.pdf', 'PAT Testing Certificate', 'dummy/pat.pdf', CURRENT_DATE + INTERVAL '6 days', TRUE),
  
  -- Argyll: 11d left Fire Extinguisher
  ('b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'fire_ext_service.pdf', 'Fire Extinguisher Service', 'dummy/fire_ext.pdf', CURRENT_DATE + INTERVAL '11 days', TRUE),
  
  -- Parkgate: 20d left Emergency Lighting
  ('f6a7b8c9-d0e1-4f0a-3b4c-5d6e7f8a9b0c', 'emerg_light_test.pdf', 'Emergency Lighting Test', 'dummy/emerg.pdf', CURRENT_DATE + INTERVAL '20 days', TRUE),
  
  -- Rowan & Ashe: 26d left Fire Warden
  ('a1b2c3d4-b8c9-4d8e-1f2a-3b4c5d6e7f8b', 'fire_warden_training.pdf', 'Fire Warden Training', 'dummy/warden.pdf', CURRENT_DATE + INTERVAL '26 days', TRUE),
  
  -- Brooklyn Bakery: Recent FRA
  ('c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'fra_2025.pdf', 'FRA', 'dummy/fra.pdf', CURRENT_DATE + INTERVAL '300 days', TRUE);

-- ─────────────────────────────────────────────────────────────
-- PROPOSALS
-- ─────────────────────────────────────────────────────────────

INSERT INTO proposals (client_id, status, services_json, created_at)
VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Sent', '[{"name": "FRA Type 3", "price": 640}]', NOW()),
  ('b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'Sent', '[{"name": "Site Risk Assessment", "price": 1840}]', NOW()),
  ('c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'Signed', '[{"name": "FRA Type 1", "price": 1240}]', NOW()),
  ('e5f6a7b8-c9d0-4e9f-2a3b-4c5d6e7f8a9b', 'Contract Issued', '[{"name": "Compliance Package", "price": 3120}]', NOW());

-- ─────────────────────────────────────────────────────────────
-- CLIENT USERS (Optional: for testing portal login)
-- ─────────────────────────────────────────────────────────────
-- Note: auth.users must be created via the dashboard or Supabase Auth API.
-- These records link existing auth users to clients.
-- INSERT INTO client_users (id, client_id, name, email, role)
-- VALUES 
--   ('UUID_FROM_AUTH_USERS', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Merlin Admin', 'merlin@test.com', 'admin');
