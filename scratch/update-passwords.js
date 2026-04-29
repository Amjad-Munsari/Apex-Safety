const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrc3hkcGdrYml1b3JqZHZlYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTc1NDIsImV4cCI6MjA5Mjk3MzU0Mn0.ZsBD0VZlQiDqmYNT_r-Iro04UXm4XQUhM6Praq73vb8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function updateUsers() {
  // Update Admin
  console.log('Updating admin@test.com...')
  const { error: adminError } = await supabase.auth.signInWithPassword({
    email: 'admin@test.com',
    password: 'password123'
  })
  
  if (!adminError) {
    const { error: updateAdminError } = await supabase.auth.updateUser({
      password: 'admin123'
    })
    if (updateAdminError) console.error('Admin update error:', updateAdminError.message)
    else console.log('Admin password updated to admin123')
  } else {
    console.error('Admin signin error:', adminError.message)
  }

  // Update Client -> User
  console.log('Updating client@test.com -> user...')
  const { error: clientError } = await supabase.auth.signInWithPassword({
    email: 'client@test.com',
    password: 'password123'
  })

  if (!clientError) {
    const { error: updateUserError } = await supabase.auth.updateUser({
      password: 'user123'
    })
    if (updateUserError) console.error('User update error:', updateUserError.message)
    else console.log('User password updated to user123')
  } else {
    console.error('Client signin error:', clientError.message)
  }
}

updateUsers()
