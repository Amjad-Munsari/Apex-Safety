import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanup() {
  console.log('Fetching all proposals...')
  const { data: proposals, error: pError } = await supabase.from('proposals').select('id, proposal_pdf_path')
  
  if (pError) {
    console.error('Error fetching proposals:', pError)
    return
  }

  console.log(`Found ${proposals.length} proposals.`)

  // 1. Delete files from storage
  const paths = proposals
    .map(p => p.proposal_pdf_path)
    .filter(p => !!p)

  if (paths.length > 0) {
    console.log(`Deleting ${paths.length} files from storage...`)
    const { error: sError } = await supabase.storage.from('proposals').remove(paths)
    if (sError) console.error('Error deleting files:', sError)
    else console.log('Successfully deleted files from storage.')
  }

  // 2. Delete rows from DB
  console.log('Deleting all rows from proposals table...')
  const { error: dError } = await supabase.from('proposals').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
  
  if (dError) console.error('Error deleting rows:', dError)
  else console.log('Successfully cleared proposals table.')
}

cleanup()
