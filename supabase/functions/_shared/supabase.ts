import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function create_admin_client(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
