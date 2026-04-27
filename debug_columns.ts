import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nmghfkxlewiduuybcgdy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZ2hma3hsZXdpZHV1eWJjZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTQyMjUsImV4cCI6MjA5Mjg3MDIyNX0.SUTVEoj4rhnr5CbOSMT6A7TB86o4_Xje6kvtySUOLhE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugColumns() {
  const table = 'posts';
  console.log(`Checking table: ${table}`);
  const columns = ['userId', 'user_id', 'userName', 'user_name', 'userEmail', 'user_email'];
  for (const col of columns) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (error) {
      console.log(`❌ Column "${col}" does NOT exist in "${table}" (Error: ${error.message})`);
    } else {
      console.log(`✅ Column "${col}" EXISTS in "${table}"`);
    }
  }
}

debugColumns();
