const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'http://127.0.0.1:54321'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetUsers() {
  const users = [
    { email: 'admin@test.com', password: 'admin123', role: 'admin' },
    { email: 'user@test.com', password: 'user123', role: 'user' }
  ]

  for (const u of users) {
    console.log(`Processing ${u.email}...`)
    
    // Get user by email
    const { data: { users: foundUsers }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
      console.error('Error listing users:', listError.message)
      return
    }

    const user = foundUsers.find(f => f.email === u.email)
    
    if (user) {
      console.log(`Updating user ${u.email}...`)
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: u.password,
        app_metadata: { role: u.role },
        email_confirm: true
      })
      if (updateError) console.error(`Error updating ${u.email}:`, updateError.message)
      else console.log(`Successfully updated ${u.email}`)
    } else {
      console.log(`Creating user ${u.email}...`)
      const { error: createError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        app_metadata: { role: u.role },
        email_confirm: true
      })
      if (createError) console.error(`Error creating ${u.email}:`, createError.message)
      else console.log(`Successfully created ${u.email}`)
    }
  }
}

resetUsers()
