import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listAll(bucket) {
  const out = []
  async function walk(prefix) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    for (const item of data ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id == null) await walk(full)
      else out.push(full)
    }
  }
  await walk('')
  return out
}

async function main() {
  const [{ data: proposals }, { data: submissions }, proposalFiles, reportFiles] = await Promise.all([
    supabase.from('proposals').select('proposal_pdf_path, contract_pdf_path'),
    supabase.from('form_submissions').select('report_storage_path'),
    listAll('proposals'),
    listAll('reports'),
  ])

  const referencedProposals = new Set()
  for (const p of proposals ?? []) {
    if (p.proposal_pdf_path) referencedProposals.add(p.proposal_pdf_path)
    if (p.contract_pdf_path) referencedProposals.add(p.contract_pdf_path)
  }
  const referencedReports = new Set()
  for (const s of submissions ?? []) {
    if (s.report_storage_path) referencedReports.add(s.report_storage_path)
  }

  const proposalOrphans = proposalFiles.filter(f => !referencedProposals.has(f))
  const reportOrphans = reportFiles.filter(f => !referencedReports.has(f))

  console.log(`proposals/ — ${proposalFiles.length} files, ${proposalOrphans.length} orphans`)
  for (const f of proposalOrphans) console.log(`  ${f}`)
  console.log(`reports/   — ${reportFiles.length} files, ${reportOrphans.length} orphans`)
  for (const f of reportOrphans) console.log(`  ${f}`)

  if (proposalOrphans.length > 0) {
    const { error } = await supabase.storage.from('proposals').remove(proposalOrphans)
    console.log(error ? `proposals delete error: ${error.message}` : `deleted ${proposalOrphans.length} from proposals/`)
  }
  if (reportOrphans.length > 0) {
    const { error } = await supabase.storage.from('reports').remove(reportOrphans)
    console.log(error ? `reports delete error: ${error.message}` : `deleted ${reportOrphans.length} from reports/`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
