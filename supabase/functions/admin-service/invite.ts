import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AnalystData {
  email: string;
  first_name: string;
  last_name: string;
  doc_type: string;
  doc_number: string;
  phone: string;
}

function insert_analyst(admin: SupabaseClient, auth_user_id: string, d: AnalystData) {
  return admin.from('platform_users').insert({
    auth_user_id,
    email: d.email,
    first_name: d.first_name,
    last_name: d.last_name,
    doc_type: d.doc_type,
    doc_number: d.doc_number,
    phone: d.phone || null,
    role: 'analyst',
  });
}

export async function handle_invite(body: Record<string, unknown>): Promise<Response> {
  const d: AnalystData = {
    email: (body.email as string || '').trim().toLowerCase(),
    first_name: (body.first_name as string || '').trim(),
    last_name: (body.last_name as string || '').trim(),
    doc_type: (body.doc_type as string || '').trim(),
    doc_number: (body.doc_number as string || '').trim(),
    phone: (body.phone as string || '').trim(),
  };

  if (!d.email || !d.first_name || !d.last_name || !d.doc_type || !d.doc_number) return err('DATOS_INCOMPLETOS');

  const admin = create_admin_client();

  const { data: existing } = await admin
    .from('platform_users').select('id').eq('email', d.email).maybeSingle();
  if (existing) return err('EMAIL_DUPLICADO');

  const { data: auth_user, error: auth_err } = await admin.auth.admin.createUser({
    email: d.email,
    email_confirm: true,
    app_metadata: { platform_role: 'analyst' },
  });

  if (auth_err) {
    // Auth account already exists (but no platform_users row): re-link it.
    if (auth_err.message.includes('already been registered')) {
      const { data: existing_auth } = await admin.auth.admin.listUsers();
      const found = existing_auth.users.find((u) => u.email === d.email);
      if (found) {
        await admin.auth.admin.updateUserById(found.id, {
          app_metadata: { ...found.app_metadata, platform_role: 'analyst' },
        });
        const { error: insert_err } = await insert_analyst(admin, found.id, d);
        if (insert_err) return err('ERROR_SERVIDOR', 500);
        return ok({ email: d.email });
      }
    }
    console.error({ fn: 'invite', error: auth_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: insert_err } = await insert_analyst(admin, auth_user.user.id, d);
  if (insert_err) {
    console.error({ fn: 'invite', error: insert_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  return ok({ email: d.email });
}
