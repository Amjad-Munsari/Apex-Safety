import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].replace(/"/g, '').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const { data: users } = await supabase.from('admin_users').select('id').limit(1);
  const adminId = users?.[0]?.id;

  const { data: template, error: err1 } = await supabase.from('form_templates').insert({
    name: 'Fire Risk Assessment 2026',
    template_type: 'FRA',
    owner_id: adminId,
    owner_type: 'admin',
    is_published: true
  }).select().single();

  if (err1) {
    console.error('Error creating template', err1);
    process.exit(1);
  }

  const schemaJson = {
    title: 'Fire Risk Assessment 2026',
    sections: [
      {
        id: 'sec_1',
        title: 'Building Information',
        description: 'General details about the premises.',
        fields: [
          { id: 'building_name', label: 'Building Name', type: 'text', required: true },
          { id: 'building_use', label: 'Primary Use', type: 'dropdown', options: [
            { label: 'Residential', value: 'residential' },
            { label: 'Commercial', value: 'commercial' },
            { label: 'Industrial', value: 'industrial' }
          ] },
          { id: 'num_floors', label: 'Number of Floors', type: 'text' }
        ]
      },
      {
        id: 'sec_2',
        title: 'Fire Protection Systems',
        description: 'Details of installed systems.',
        fields: [
          { id: 'alarm_type', label: 'Alarm System Type', type: 'text' },
          { id: 'extinguishers_present', label: 'Extinguishers Present?', type: 'dropdown', options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ] },
          { id: 'system_notes', label: 'General Notes', type: 'textarea' },
          { id: 'system_photos', label: 'System Photos', type: 'media' }
        ]
      }
    ]
  };

  const { error: err2 } = await supabase.from('template_versions').insert({
    template_id: template.id,
    version_number: 1,
    schema_json: schemaJson,
    published_at: new Date().toISOString(),
    created_by: adminId
  });

  if (err2) {
    console.error('Error creating version', err2);
    process.exit(1);
  } else {
    console.log('Successfully seeded template!');
  }
}

seed();
