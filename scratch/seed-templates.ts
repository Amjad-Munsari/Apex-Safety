import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seed() {
  console.log("Seeding templates...")

  // 1. Get an admin user
  const { data: admins } = await supabase.from("admin_users").select("id").limit(1)
  if (!admins || admins.length === 0) {
    console.error("No admin user found. Run auth setup first.")
    return
  }
  const adminId = admins[0].id

  // 2. Create Fire Risk Assessment Template
  const { data: template, error: tError } = await supabase
    .from("form_templates")
    .insert({
      name: "Fire Risk Assessment (Type 3)",
      template_type: "fire_risk",
      owner_id: adminId,
      owner_type: "admin",
      is_published: true
    })
    .select()
    .single()

  if (tError) {
    console.error("Error creating template:", tError)
    return
  }

  console.log("Template created:", template.id)

  // 3. Create Version 1 with FRA Schema
  const fraSchema = {
    title: "Fire Risk Assessment - Type 3",
    description: "Comprehensive fire risk assessment for residential care homes.",
    sections: [
      {
        id: "sec_building",
        title: "Building Information",
        fields: [
          { id: "bld_name", label: "Building Name", type: "text", placeholder: "e.g. North Block, Level 2" },
          { id: "bld_usage", label: "Primary Usage", type: "dropdown", options: [
            { label: "Residential Care", value: "care" },
            { label: "Office", value: "office" },
            { label: "Industrial", value: "industrial" }
          ]}
        ]
      },
      {
        id: "sec_hazards",
        title: "Hazards & Observations",
        fields: [
          { id: "obs_general", label: "General Observations", type: "textarea", placeholder: "Narrate findings..." },
          { id: "obs_photos", label: "Evidence Photos", type: "media" }
        ]
      }
    ]
  }

  const { data: version, error: vError } = await supabase
    .from("template_versions")
    .insert({
      template_id: template.id,
      version_number: 1,
      schema_json: fraSchema,
      published_at: new Date().toISOString(),
      created_by: adminId
    })
    .select()
    .single()

  if (vError) {
    console.error("Error creating version:", vError)
    return
  }

  console.log("Version 1 created:", version.id)
  console.log("Seed complete!")
}

seed()
