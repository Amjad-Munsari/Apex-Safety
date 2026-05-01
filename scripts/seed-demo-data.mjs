import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
  console.log('--- Phase 11: High-Fidelity Seeding ---')

  // 1. Get Template Version (needed for reports/assignments)
  const { data: versions } = await supabase.from('template_versions').select('id, template_id').limit(1)
  if (!versions?.length) {
    console.error('No template versions found. Please create a template first.')
    return
  }
  const versionId = versions[0].id
  const templateId = versions[0].template_id

  // 2. Insert Clients
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

  // 3. Insert random Documents and Reports for each client
  const now = new Date()
  const documents = []
  const submissions = []
  const assignments = []

  for (const client of insertedClients) {
    // Create an assignment
    const assignmentId = crypto.randomUUID()
    assignments.push({
      id: assignmentId,
      client_id: client.id,
      template_id: templateId,
      template_version_id: versionId,
      status: 'assigned',
      created_at: now.toISOString()
    })

    // Random Document (Expired, Expiring, or Current)
    const randomDays = Math.floor(Math.random() * 60) - 30 // -30 to +30 days
    const expiry = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000)
    
    documents.push({
      client_id: client.id,
      filename: `Fire Safety Certificate - ${client.name}.pdf`,
      document_category: 'Certifications',
      expiry_date: expiry.toISOString(),
      uploaded_at: now.toISOString(),
      storage_path: `documents/${client.id}/cert.pdf`
    })

    // Random Report Awaiting Review (for some clients)
    if (Math.random() > 0.5) {
      submissions.push({
        assignment_id: assignmentId,
        client_id: client.id,
        template_version_id: versionId,
        status: 'draft_ready_for_review',
        answers_json: { notes: "Site inspection complete. Minor issues with exit signage." },
        created_at: now.toISOString()
      })
    }
  }

  // Insert assignments first (FK constraint)
  const { error: assignError } = await supabase.from('form_assignments').insert(assignments)
  if (assignError) console.error('Error inserting assignments:', assignError)

  // Insert documents
  const { error: docError } = await supabase.from('documents').insert(documents)
  if (docError) console.error('Error inserting documents:', docError)

  // Insert submissions
  const { error: subError } = await supabase.from('form_submissions').insert(submissions)
  if (subError) console.error('Error inserting submissions:', subError)

  console.log('Seeding complete. Dashboard should now be populated with realistic data.')
}

seed()
