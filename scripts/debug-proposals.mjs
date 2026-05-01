import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
  const { data, error } = await supabase.from('proposals').select('*').limit(5)
  if (error) console.error(error)
  else console.log('Proposals:', JSON.stringify(data, null, 2))

  const { data: buckets, error: bError } = await supabase.storage.listBuckets()
  if (bError) console.error(bError)
  else console.log('Buckets:', buckets.map(b => b.name))
}

check()
