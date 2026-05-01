import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function update() {
  console.log('Updating proposals bucket to public...')
  const { data, error } = await supabase.storage.updateBucket('proposals', {
    public: true
  })

  if (error) console.error(error)
  else console.log('Successfully updated proposals bucket to public.')
}

update()
