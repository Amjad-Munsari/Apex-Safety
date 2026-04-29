const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrc3hkcGdrYml1b3JqZHZlYmR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM5NzU0MiwiZXhwIjoyMDkyOTczNTQyfQ.S6qL-D3N6V6M3M7q6Y9v-S9v9v9v9v9v9v9v9v9v9v9' 
// Wait, I don't have the service role key. I should use the db query.

// I'll try one last time with simple SQL and no complex JSON strings if possible.
// Or I'll use double quotes for the query and single for the JSON.
