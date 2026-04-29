const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrc3hkcGdrYml1b3JqZHZlYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTc1NDIsImV4cCI6MjA5Mjk3MzU0Mn0.ZsBD0VZlQiDqmYNT_r-Iro04UXm4XQUhM6Praq73vb8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function updateEmail() {
  console.log('Updating client@test.com -> user@test.com...')
  
  // Sign in first to get session
  const { error: signinError } = await supabase.auth.signInWithPassword({
    email: 'client@test.com',
    password: 'user123'
  })

  if (signinError) {
    console.error('Signin error:', signinError.message)
    return
  }

  const { error: updateError } = await supabase.auth.updateUser({
    email: 'user@test.com'
  })

  if (updateError) {
    console.error('Email update error:', updateError.message)
  } else {
    console.log('Successfully updated email to user@test.com')
  }
}

updateEmail()
