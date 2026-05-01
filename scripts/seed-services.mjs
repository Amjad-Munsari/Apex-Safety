import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const services = [
  // Fire Risk Assessments (01)
  {
    name: 'Fire Risk Assessment — Type 1',
    description: 'Common parts only, non-destructive inspection.',
    category: 'Fire Risk Assessments',
    unit_price: 480,
    active: true
  },
  {
    name: 'Fire Risk Assessment — Type 3',
    description: 'Non-sleeping occupancy, full common parts + sample dwellings.',
    category: 'Fire Risk Assessments',
    unit_price: 620,
    active: true
  },
  {
    name: 'Fire Risk Assessment — Type 4',
    description: 'Sleeping risk, destructive inspection of sample dwellings.',
    category: 'Fire Risk Assessments',
    unit_price: 980,
    active: true
  },
  {
    name: 'Site Risk Assessment',
    description: 'Broader H&S site survey with written recommendations.',
    category: 'Fire Risk Assessments',
    unit_price: 540,
    active: true
  },
  // Training courses (02)
  {
    name: 'Fire Warden Training',
    description: 'Half-day course, up to 12 delegates, certificates issued.',
    category: 'Training courses',
    unit_price: 540,
    active: true
  },
  {
    name: 'Fire Marshal Training',
    description: 'Full-day course, up to 12 delegates, extinguisher practical.',
    category: 'Training courses',
    unit_price: 820,
    active: true
  },
  {
    name: 'Basic Fire Awareness',
    description: 'Short course suitable for all staff, up to 20 delegates.',
    category: 'Training courses',
    unit_price: 360,
    active: true
  },
  {
    name: 'Emergency First Aid at Work',
    description: '1-day EFAW, HSE-compliant, up to 12 delegates.',
    category: 'Training courses',
    unit_price: 680,
    active: true
  },
  {
    name: 'First Aid at Work (3-day)',
    description: 'Full FAW 3-day, HSE-compliant, up to 12 delegates.',
    category: 'Training courses',
    unit_price: 1650,
    active: true
  },
  {
    name: 'Manual Handling',
    description: 'Half-day practical, up to 12 delegates.',
    category: 'Training courses',
    unit_price: 420,
    active: true
  },
  {
    name: 'DSE Assessment',
    description: 'Per workstation review + written report.',
    category: 'Training courses',
    unit_price: 35,
    active: true
  },
  // Testing & retainer (03)
  {
    name: 'PAT Testing',
    description: 'Portable appliance testing, per item, minimum 20 items.',
    category: 'Testing & retainer',
    unit_price: 2.5,
    active: true
  },
  {
    name: 'Consulting Retainer — 5h',
    description: 'Five consulting hours, use any time within 12 months.',
    category: 'Testing & retainer',
    unit_price: 425,
    active: true
  },
  {
    name: 'Consulting Retainer — 10h',
    description: 'Ten consulting hours, use any time within 12 months.',
    category: 'Testing & retainer',
    unit_price: 800,
    active: true
  },
  {
    name: 'Consulting Retainer — 20h',
    description: 'Twenty consulting hours, use any time within 12 months.',
    category: 'Testing & retainer',
    unit_price: 1500,
    active: true
  }
]

async function seed() {
  console.log('Seeding services...')
  
  const { data, error } = await supabase
    .from('services')
    .insert(services)
    .select()

  if (error) {
    console.error('Error seeding services:', error)
  } else {
    console.log(`Successfully seeded ${data.length} services`)
  }
}

seed()
