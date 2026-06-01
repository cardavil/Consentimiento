import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function create_admin_client(): SupabaseClient {
  // Prefer the modern sb_secret_… key; fall back to the legacy JWT service_role key
  // during the migration. Once legacy JWT keys are disabled, only SUPABASE_SECRET_KEY remains.
  const secret_key = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    secret_key,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
