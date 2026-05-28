import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Display name of an organization (company name for jurídica, person name otherwise).
export async function org_display_name(admin: SupabaseClient, org_id: string): Promise<string> {
  const { data } = await admin
    .from('organizations')
    .select('type, first_name, last_name, company_name')
    .eq('id', org_id)
    .maybeSingle();
  if (!data) return 'Consentia';
  if (data.type === 'juridica') return data.company_name || 'Consentia';
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Consentia';
}
