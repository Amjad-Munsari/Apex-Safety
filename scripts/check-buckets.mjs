import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
  const { data: buckets, error: bError } = await supabase.storage.listBuckets()
  if (bError) console.error(bError)
  else {
    console.log('Buckets Details:', JSON.stringify(buckets, null, 2))
  }
}

check()
