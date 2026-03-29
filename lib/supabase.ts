import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side ve Public işlemler için anon client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side işlemler (Cache yazma, Storage yükleme) için Admin client
// Bu SADECE server-side (Server Action veya Route Handler) içinde kullanılmalıdır.
export const getSupabaseAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
