// Read-only diagnostic: does the client test user (user@test.com) have a
// client_users row mapping it to a client org? Without that row,
// getClientContext() returns null and /login/client lands in an empty portal —
// which is exactly the "client auth is broken" symptom (it's data, not code).
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TEST_EMAIL = 'user@test.com'

async function main() {
  // 1. Find the auth user
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) { console.error('listUsers error:', listErr.message); process.exit(1) }
  const authUser = list.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL)
  if (!authUser) {
    console.log(`AUTH USER: ${TEST_EMAIL} NOT FOUND in auth.users`)
    process.exit(0)
  }
  console.log(`AUTH USER: ${TEST_EMAIL} -> ${authUser.id}`)

  // 2. Is it an admin? (would explain a /client bounce)
  const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', authUser.id).maybeSingle()
  console.log(`admin_users row: ${adminRow ? 'YES (this user is an admin)' : 'no'}`)

  // 3. Does it have a client_users row?
  const { data: cu, error: cuErr } = await supabase
    .from('client_users')
    .select('id, client_id, name, email, role, deleted_at')
    .eq('id', authUser.id)
    .maybeSingle()
  if (cuErr) { console.error('client_users query error:', cuErr.message); process.exit(1) }

  if (!cu) {
    console.log('client_users row: MISSING  <-- this is why the portal is empty')
  } else {
    console.log('client_users row:', JSON.stringify(cu))
    const { data: org } = await supabase.from('clients').select('id, name, active, deleted_at').eq('id', cu.client_id).maybeSingle()
    console.log('linked clients org:', org ? JSON.stringify(org) : 'ORG MISSING / not readable')
  }

  // 4. Show available client orgs (to pick a link target if we need to seed)
  const { data: orgs } = await supabase.from('clients').select('id, name').is('deleted_at', null).order('name').limit(10)
  console.log('available client orgs:', JSON.stringify(orgs))
}

main()
