import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-supabase-url.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);