// Idempotent seed: guarantee the client test user (user@test.com) can land in a
// populated client portal. Safe to run repeatedly.
//
//   1. Find (or create) the auth user user@test.com.
//   2. Ensure a client org exists to link to (reuses TEST_CLIENT_NAME if present).
//   3. Ensure a client_users row maps the auth user -> that org.
//
// Requires a VALID SUPABASE_SERVICE_ROLE_KEY and an explicit strong
// TEST_CLIENT_PASSWORD in .env.local. Run only against a non-production
// project:
//   ALLOW_TEST_USER_SEED=true node scripts/ensure-client-test-user.mjs
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const TEST_EMAIL = 'user@test.com'
const TEST_PASSWORD = process.env.TEST_CLIENT_PASSWORD
const TEST_CLIENT_NAME = 'Demo Client Ltd'

async function main() {
  if (process.env.ALLOW_TEST_USER_SEED !== 'true') {
    throw new Error('Refusing to seed: set ALLOW_TEST_USER_SEED=true for an intentional non-production run')
  }
  if (!TEST_PASSWORD || TEST_PASSWORD.length < 16) {
    throw new Error('TEST_CLIENT_PASSWORD must be set explicitly and contain at least 16 characters')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. Auth user
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw new Error(`listUsers: ${listErr.message}`)
  let authUser = list.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL)
  if (!authUser) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (createErr) throw new Error(`createUser: ${createErr.message}`)
    authUser = created.user
    console.log(`created auth user ${TEST_EMAIL} -> ${authUser.id}`)
  } else {
    console.log(`auth user exists ${TEST_EMAIL} -> ${authUser.id}`)
  }

  // Guard: an admin must not also be a client (proxy would bounce them off /client).
  const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', authUser.id).maybeSingle()
  if (adminRow) {
    console.warn('WARNING: this user is in admin_users — it is an admin, not a client. Aborting client seed.')
    process.exit(1)
  }

  // 2. Client org
  let { data: org } = await supabase.from('clients').select('id, name').eq('name', TEST_CLIENT_NAME).is('deleted_at', null).maybeSingle()
  if (!org) {
    const { data: createdOrg, error: orgErr } = await supabase
      .from('clients')
      .insert({ name: TEST_CLIENT_NAME, site_address: '1 Test Street, London', active: true })
      .select('id, name')
      .single()
    if (orgErr) throw new Error(`create org: ${orgErr.message}`)
    org = createdOrg
    console.log(`created client org ${org.name} -> ${org.id}`)
  } else {
    console.log(`client org exists ${org.name} -> ${org.id}`)
  }

  // 3. client_users mapping (idempotent upsert on the PK = auth user id)
  const { data: existing } = await supabase.from('client_users').select('id, client_id').eq('id', authUser.id).maybeSingle()
  if (existing) {
    console.log(`client_users row already present -> org ${existing.client_id}`)
  } else {
    const { error: cuErr } = await supabase.from('client_users').insert({
      id: authUser.id,
      client_id: org.id,
      name: 'Test Client',
      email: TEST_EMAIL,
      role: 'member',
    })
    if (cuErr) throw new Error(`insert client_users: ${cuErr.message}`)
    console.log(`linked ${TEST_EMAIL} -> org ${org.id} (client_users)`)
  }

  console.log('DONE — /login/client should now land in a populated portal.')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
