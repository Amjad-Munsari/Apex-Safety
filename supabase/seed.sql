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
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Merlin Print Works Ltd', 'Unit 7, Ardwick Industrial Estate', 14, TRUE),
  ('b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'Argyll Self-Storage', 'Loch Road, Argyll', 16, TRUE),
  ('c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'Brooklyn Bakery', 'Beach Rd, Chorlton', 24, TRUE),
  ('d4e5f6a7-b8c9-4d8e-1f2a-3b4c5d6e7f8a', 'Hallam House Care Home', '12 Hallam St, Manchester', 2, TRUE),
  ('e5f6a7b8-c9d0-4e9f-2a3b-4c5d6e7f8a9b', 'Oakwood Letting Agency', 'Oakwood Square, Leeds', 11, TRUE),
  ('f6a7b8c9-d0e1-4f0a-3b4c-5d6e7f8a9b0c', 'Parkgate Primary School', 'Parkgate Lane, Cheshire', 34, TRUE),
  ('a1b2c3d4-b8c9-4d8e-1f2a-3b4c5d6e7f8b', 'Rowan & Ashe Solicitors', 'Rowan House, Manchester', 56, TRUE),
  ('b2c3d4e5-c9d0-4e9f-2a3b-4c5d6e7f8a9c', 'Stockley Joinery', 'Stockley Way, Salford', 74, TRUE)
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
-- SERVICES — mirror of production catalog (888 Safety)
-- ─────────────────────────────────────────────────────────────
-- Source: Course List Master.xlsx supplied by Matt Robinson.
-- Production is the source of truth; this block bootstraps fresh
-- environments to the same state. Refresh by re-running:
--   SELECT … FROM services WHERE deleted_at IS NULL ORDER BY category, name;
-- and pasting the result here.
--
-- Two categories only: 'Training courses' (priced per delegate) and
-- 'Services' (assessment / consultancy / testing — most are quote-on-request).

INSERT INTO services (id, name, description, category, unit_price, unit, active)
VALUES
  -- ── Monthly Packages (retainer tiers) ───────────────────────────────────
  ('53000000-0000-4000-8000-000000000001', 'Business Essentials',                             'Monthly retainer. Policy doc template, blank risk assessment, permit-to-work, training video, appointed person letter, business-hours phone consultancy. Optional CMS add-on £100/month.', 'Monthly Packages',  100.00, 'month',  TRUE),
  ('53000000-0000-4000-8000-000000000002', 'Business Plus',                                   'Monthly retainer. Everything in Business Essentials, plus 2 site visits per year, 4 quarterly remote review meetings, and CMS access for up to 5 users.',                                  'Monthly Packages',  350.00, 'month',  TRUE),
  ('53000000-0000-4000-8000-000000000003', 'Full Service',                                    'Monthly retainer. Everything in Business Plus, plus 5 hours of work credit per month (usually £475) and defence against negligence cover (up to 2 accident investigations per year).',         'Monthly Packages',  550.00, 'month',  TRUE),

  -- ── Training Courses ────────────────────────────────────────────────────
  ('51000000-0000-4000-8000-000000000001', 'First Aid at Work (3 day)',                       'FFA 3D — Ofqual Level 3, 6–12 delegates, 3 days. Classroom. Certificate £10.00 per delegate.', 'Training courses',  310.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000002', 'Emergency First Aid at Work',                     'EFAW — Ofqual Level 3, 6–12 delegates, 1 day. Classroom. Certificate £6.50 per delegate.',     'Training courses',  110.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000003', 'Basic Life Support',                              'BLS — Ofqual, 6–12 delegates, 1 day. Classroom. Certificate £6.50 per delegate.',             'Training courses',   60.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000004', 'CPR & Auto External Defibrillation',              'AED — Ofqual, 6–12 delegates, 1 day. Classroom. Certificate £6.50 per delegate.',             'Training courses',  100.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000005', 'Award in Health and Safety (Level 1)',            'HAS 1 — Ofqual Level 1, 6–16 delegates, 1/2 day. Classroom. Certificate £6.50 per delegate.', 'Training courses',  100.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000006', 'Award in Health and Safety (Level 2)',            'HAS 2 — Ofqual Level 2, 6–16 delegates, 1 day. Classroom. Certificate £6.50 per delegate.',   'Training courses',  150.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000007', 'Award in Health and Safety (Level 3)',            'HAS 3 — Ofqual Level 3, 5–16 delegates, 3 days. Classroom. Certificate £15.00 per delegate.', 'Training courses',  290.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000008', 'Award in Manual Handling (Level 2)',              'MAN 1 — Ofqual Level 2, 6–16 delegates, 1 day. Classroom. Certificate £6.50 per delegate.',   'Training courses',  110.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000009', 'Banksman Course',                                 'Bank 1 — Unregulated, 3–6 delegates, 1 day. Hybrid. Rate dependant on site.',                'Training courses',  110.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000010', 'Spillage and CoSHH Awareness',                    'SPILL 1 — Unregulated, 6–12 delegates, 1/2 day. Hybrid.',                                    'Training courses',   80.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000011', 'Fire Safety & Awareness (Level 1)',               'FAS 1 — Ofqual Level 1, 6–12 delegates, 1/2 day. Classroom. Certificate £6.50 per delegate.', 'Training courses',   60.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000012', 'Award in Fire Safety / Fire Marshal (Level 2)',   'FS MAS — Ofqual Level 2, 6–16 delegates, 1 day. Hybrid. Certificate £6.50 per delegate.',     'Training courses',  210.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000013', 'Fire Marshal Course Pro',                         'FIRE 1 — Unregulated, 6–12 delegates, 1 day. Hybrid.',                                       'Training courses',  190.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000014', 'Fire Extinguisher Training',                      'FIRE 2 — Unregulated, 6–10 delegates, 1/2 day. Hybrid. LFT variant £150 per delegate.',       'Training courses',  100.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000015', 'Mental Health',                                   'MEN 1 — Ofqual Level 2, 6–10 delegates, 1 day. Classroom. Certificate £8.00 per delegate.',   'Training courses',  110.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000016', 'Fleet Safe & Eco Driving',                        'Fleet SAFE — 1 delegate per session. Delivered at customer site.',                           'Training courses',  200.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000017', 'New Driver Assessment',                           'Fleet NDA — 1 delegate per session. Delivered at customer site.',                            'Training courses',  230.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000018', 'Safe Securing of Loads',                          'Fleet Load — 3–12 delegates, classroom + vehicle component. Delivered at customer site.',    'Training courses',  150.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000019', 'Post-Incident Assessment, Training & Report',     'Fleet Post — 1 delegate per session.',                                                       'Training courses',  300.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000020', 'Slow-Speed Manoeuvring and Reversing',            'Sleet SSMR — 1 delegate per session.',                                                       'Training courses',  220.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000021', 'CAT B Training (30 hrs)',                         'CAT B — DVSA, 1 delegate, 30 hours in-vehicle.',                                             'Training courses', 1800.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000022', 'CAT B Training (15 hrs)',                         'CAT B — DVSA, 1 delegate, 15 hours in-vehicle.',                                             'Training courses', 1500.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000023', 'CAT B Training (10 hrs)',                         'CAT B — DVSA, 1 delegate, 10 hours in-vehicle.',                                             'Training courses', 1100.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000024', 'Class 1 Training',                                'Class 1 — DVSA, 1 delegate, 5 days in-vehicle.',                                             'Training courses', 3900.00, 'person', TRUE),
  ('51000000-0000-4000-8000-000000000025', 'Class 2 Training',                                'Class 2 — DVSA, 1 delegate, 3 days in-vehicle.',                                             'Training courses', 2900.00, 'person', TRUE),

  -- ── Services (quote on request unless priced) ───────────────────────────
  ('52000000-0000-4000-8000-000000000001', 'Fire Risk Assessment',                            'FRA — Price is site-size dependant; quoted per project.',                                    'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000002', 'Risk Assessment / Safe Systems of Work',          'RAMS / SSW — Bespoke documentation. Quote on request.',                                      'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000003', 'Site Safety Tour',                                'SST — Walk-through inspection with written notes. Quote on request.',                        'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000004', 'Tool Box Talks',                                  'TBT — Writing and delivery of toolbox talks. Quote on request.',                             'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000005', 'Defence Against Negligence',                      'Def — Investigation and reporting in support of incident defence. Quote on request.',        'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000006', 'Competent Person',                                'Comp — Named competent person service. Quote on request.',                                   'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000007', 'Audit (1 day)',                                   'Audit Soft — 1-day audit. Quote on request.',                                                'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000008', 'Audit (Full)',                                    'Audit Full — 2–3 days, scope-dependant. Quote on request.',                                  'Services',           NULL, 'each',   TRUE),
  ('52000000-0000-4000-8000-000000000009', 'PAT Testing',                                     'Portable Appliance Testing — £1.00 per item.',                                               'Services',           1.00, 'item',   TRUE),
  ('52000000-0000-4000-8000-000000000010', 'Fire Extinguisher Servicing',                     'Servicing and replacement. Quote on request.',                                               'Services',           NULL, 'each',   TRUE)
ON CONFLICT (id) DO UPDATE
SET name        = EXCLUDED.name,
    description = EXCLUDED.description,
    category    = EXCLUDED.category,
    unit_price  = EXCLUDED.unit_price,
    unit        = EXCLUDED.unit,
    active      = EXCLUDED.active;

-- ─────────────────────────────────────────────────────────────
-- PROPOSALS
-- ─────────────────────────────────────────────────────────────
-- Proposals are created through the admin wizard at /admin/proposals/new.
-- No bootstrap rows — production should always start with an empty pipeline
-- and Matt builds the first real proposal himself.

-- ─────────────────────────────────────────────────────────────
-- ADMIN USERS (for admin portal login)
-- ─────────────────────────────────────────────────────────────
-- Note: auth.users must be created via the dashboard or Supabase Auth API.
-- These records link existing auth users to the admin surface.
-- The admin's app_metadata must also carry {"role": "admin"} (set in the
-- Supabase dashboard) for the admin RLS policies to apply.
-- Auth account: admin@test.com

INSERT INTO admin_users (id, name, email)
VALUES
  ('3497bbaa-f5c9-4d3b-a9d2-b13795d60e83', 'Matt Robinson', 'admin@test.com')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- CLIENT USERS (for testing portal login)
-- ─────────────────────────────────────────────────────────────
-- Note: auth.users must be created via the dashboard or Supabase Auth API.
-- These records link existing auth users to clients.
-- Auth account: user@test.com — linked to Merlin Print Works Ltd.

INSERT INTO client_users (id, client_id, name, email, role)
VALUES
  ('89ceb1b3-72fc-4c99-925e-266fbf3e1238', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Merlin Admin', 'user@test.com', 'admin')
ON CONFLICT (id) DO NOTHING;
