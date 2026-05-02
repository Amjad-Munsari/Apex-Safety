import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ── 8 High-quality demo clients ─────────────────────────────────────────────
const demoClients = [
  {
    name: "The Steel City Hotel",
    site_address: "15-20 Victoria St, Sheffield S1 2HG",
    contact_name: "Sarah Miller",
    contact_email: "sarah@steelcityhotel.co.uk",
    hours_balance: 15,
    sector: "Hospitality"
  },
  {
    name: "Kelham Island Brewery",
    site_address: "23 Alma St, Sheffield S3 8SA",
    contact_name: "Tom Harrison",
    contact_email: "tom@kelhambrewery.co.uk",
    hours_balance: 8,
    sector: "Manufacturing"
  },
  {
    name: "Park Hill Apartments",
    site_address: "Park Hill, Sheffield S2 5PN",
    contact_name: "James Wilson",
    contact_email: "j.wilson@urban-splash.co.uk",
    hours_balance: 24,
    sector: "Residential"
  },
  {
    name: "Crucible Theatre",
    site_address: "55 Norfolk St, Sheffield S1 1DA",
    contact_name: "Elena Rossi",
    contact_email: "elena@sheffieldtheatres.co.uk",
    hours_balance: 12,
    sector: "Entertainment"
  },
  {
    name: "Hallam University Campus",
    site_address: "City Campus, Howard St, Sheffield S1 1WB",
    contact_name: "David Brooks",
    contact_email: "d.brooks@shu.ac.uk",
    hours_balance: 45,
    sector: "Education"
  },
  {
    name: "The Moor Market",
    site_address: "77 The Moor, Sheffield S1 4PF",
    contact_name: "Linda Chen",
    contact_email: "linda@moormarket.co.uk",
    hours_balance: 5,
    sector: "Retail"
  },
  {
    name: "Weston Park Museum",
    site_address: "Western Bank, Sheffield S10 2TP",
    contact_name: "Robert Page",
    contact_email: "r.page@sheffieldmuseums.org.uk",
    hours_balance: 20,
    sector: "Leisure"
  },
  {
    name: "Advanced Manufacturing Research Centre",
    site_address: "Wallis Way, Catcliffe, Rotherham S60 5TZ",
    contact_name: "Prof. Alan Smith",
    contact_email: "a.smith@amrc.co.uk",
    hours_balance: 60,
    sector: "Science & Tech"
  }
]

async function seed() {
  console.log('--- 888 Safety: Seeding Demo Data (idempotent) ---')

  // ── Step 1: Wipe existing demo data in FK order ────────────────────────────
  console.log('Clearing existing data...')
  await supabase.from('form_submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('form_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('Cleared.')

  // ── Step 2: Get template version ─────────────────────────────────────────
  const { data: versions } = await supabase
    .from('template_versions')
    .select('id, template_id')
    .limit(1)

  if (!versions?.length) {
    console.error('No template versions found. Create a template first, then re-run.')
    return
  }
  const versionId = versions[0].id
  const templateId = versions[0].template_id

  // ── Step 3: Insert clients ────────────────────────────────────────────────
  const { data: insertedClients, error: clientError } = await supabase
    .from('clients')
    .insert(demoClients.map(c => ({
      name: c.name,
      site_address: c.site_address,
      hours_balance: c.hours_balance
    })))
    .select()

  if (clientError) {
    console.error('Error inserting clients:', clientError)
    return
  }
  console.log(`Inserted ${insertedClients.length} clients.`)

  // ── Step 4: Build documents ───────────────────────────────────────────────
  // Deliberately staged expiry dates for a realistic RAG mix
  const now = new Date()
  const days = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString()

  const documentScenarios = [
    -60,  // Expired 2 months ago
    -10,  // Expired 10 days ago
    6,    // Expiring in 6 days  (critical)
    12,   // Expiring in 12 days (warning)
    25,   // Expiring in 25 days (warning)
    90,   // Current — 3 months out
    180,  // Current — 6 months out
    365,  // Current — 1 year out
  ]

  const documents = insertedClients.map((client, i) => ({
    client_id: client.id,
    filename: `Fire Safety Certificate — ${client.name}.pdf`,
    document_category: 'Certifications',
    expiry_date: days(documentScenarios[i]),
    uploaded_at: now.toISOString(),
    storage_path: `documents/${client.id}/cert.pdf`
  }))

  // ── Step 5: Build assignments ─────────────────────────────────────────────
  const assignments = insertedClients.map(client => ({
    id: crypto.randomUUID(),
    client_id: client.id,
    template_id: templateId,
    template_version_id: versionId,
    status: 'assigned',
    created_at: now.toISOString()
  }))

  // ── Step 6: Build submissions (3 deliberate states) ───────────────────────
  // Client 0 (Steel City Hotel) — submitted, no AI draft yet
  // Client 1 (Kelham Brewery)   — AI draft ready for review
  // Client 2 (Park Hill)        — completed, report already generated
  const submissionBase = {
    template_version_id: versionId,
    created_at: now.toISOString()
  }

  const richAnswers = {
    notes: "Site inspection complete. Emergency lighting tested — 3 units in the east stairwell failed. Exit signage missing on Level 2 corridor near the kitchen. Fire extinguishers checked: 2 CO2 units expired in the server room. General housekeeping in storage areas is poor — combustible materials stacked against wall.",
    __appendix_notes: "Spoke with site manager David. He confirmed the stairwell lighting has been faulty for 6 weeks. Recommend urgent action before next inspection."
  }

  const draftReport = {
    executiveSummary: "An on-site Fire Risk Assessment was conducted at Kelham Island Brewery. The premises presented several fire safety deficiencies requiring prompt attention, particularly regarding emergency lighting, exit signage, and fire extinguisher maintenance. Immediate remediation is recommended to achieve compliance with the Regulatory Reform (Fire Safety) Order 2005.",
    hazards: [
      {
        location: "East Stairwell",
        description: "3 emergency lighting units found to be non-functional during testing. This presents a significant risk in the event of a power failure.",
        severity: "High",
        recommendedAction: "Replace failed emergency lighting units immediately. Arrange monthly testing schedule."
      },
      {
        location: "Level 2 Corridor (near Kitchen)",
        description: "Exit signage is absent from this corridor, which is a primary evacuation route.",
        severity: "Critical",
        recommendedAction: "Install illuminated exit signs in accordance with BS 5266-1 within 7 days."
      },
      {
        location: "Server Room",
        description: "2 CO2 fire extinguishers have exceeded their service date.",
        severity: "Medium",
        recommendedAction: "Service or replace CO2 extinguishers. Arrange annual service contract."
      },
      {
        location: "Storage Areas",
        description: "Combustible materials stacked directly against walls, creating a potential fire load risk.",
        severity: "Low",
        recommendedAction: "Reorganise storage to maintain 500mm clearance from walls. Conduct monthly housekeeping audits."
      }
    ],
    complianceStatus: "Action Required"
  }

  const submissions = [
    // State 1: Submitted — waiting for AI draft
    {
      ...submissionBase,
      assignment_id: assignments[0].id,
      client_id: insertedClients[0].id,
      answers_json: richAnswers,
      status: 'submitted',
    },
    // State 2: AI draft ready — waiting for Matt to review
    {
      ...submissionBase,
      assignment_id: assignments[1].id,
      client_id: insertedClients[1].id,
      answers_json: richAnswers,
      status: 'draft_ready_for_review',
      draft_report_json: draftReport,
    },
    // State 3: Completed — report already approved and generated
    {
      ...submissionBase,
      assignment_id: assignments[2].id,
      client_id: insertedClients[2].id,
      answers_json: richAnswers,
      status: 'completed',
      draft_report_json: draftReport,
      report_storage_path: `${insertedClients[2].id}/report_demo.pdf`,
    }
  ]

  // ── Step 7: Insert all ────────────────────────────────────────────────────
  const { error: assignError } = await supabase.from('form_assignments').insert(assignments)
  if (assignError) console.error('Error inserting assignments:', assignError)

  const { error: docError } = await supabase.from('documents').insert(documents)
  if (docError) console.error('Error inserting documents:', docError)

  const { error: subError } = await supabase.from('form_submissions').insert(submissions)
  if (subError) console.error('Error inserting submissions:', subError)

  console.log(`
✓ 8 clients with staged document expiry dates
✓ 3 deliberate assessment submissions:
  — Steel City Hotel: submitted (awaiting AI draft)
  — Kelham Island Brewery: draft_ready_for_review (ready for Matt to review)
  — Park Hill Apartments: completed (report generated)

Seeding complete.
  `)
}

seed()
