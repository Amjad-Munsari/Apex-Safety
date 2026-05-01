import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seed() {
  // 1. Get a client
  const { data: clients } = await supabase.from('clients').select('id').limit(1)
  if (!clients || clients.length === 0) {
    console.error('No clients found')
    return
  }
  const clientId = clients[0].id

  // 2. Get a template version
  const { data: versions } = await supabase.from('template_versions').select('id').limit(1)
  if (!versions || versions.length === 0) {
    console.error('No template versions found')
    return
  }
  const versionId = versions[0].id

  const assignmentId = 'af1f055c-351e-4058-91a7-1b9e00185f0f'

  console.log(`Seeding 2 reports for client ${clientId} and version ${versionId}`)

  // 3. Insert 2 reports
  const { error } = await supabase.from('form_submissions').insert([
    {
      assignment_id: assignmentId,
      client_id: clientId,
      template_version_id: versionId,
      status: 'draft_ready_for_review',
      answers_json: { test: true },
      created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
      assignment_id: assignmentId,
      client_id: clientId,
      template_version_id: versionId,
      status: 'draft_ready_for_review',
      answers_json: { test: true },
      created_at: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    }
  ])

  if (error) console.error(error)
  else console.log('Successfully seeded 2 dummy reports.')
}

seed()
