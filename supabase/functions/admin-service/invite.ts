import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

export async function handle_invite(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string || '').trim().toLowerCase();
  const name = (body.name as string || '').trim();

  if (!email || !name) return err('DATOS_INCOMPLETOS');

  const admin = create_admin_client();

  const { data: existing } = await admin
    .from('platform_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) return err('EMAIL_DUPLICADO');

  const { data: auth_user, error: auth_err } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { platform_role: 'analyst' },
  });

  if (auth_err) {
    if (auth_err.message.includes('already been registered')) {
      const { data: existing_auth } = await admin.auth.admin.listUsers();
      const found = existing_auth.users.find((u) => u.email === email);
      if (found) {
        await admin.auth.admin.updateUserById(found.id, {
          app_metadata: { ...found.app_metadata, platform_role: 'analyst' },
        });

        const { error: insert_err } = await admin.from('platform_users').insert({
          auth_user_id: found.id,
          email,
          name,
          role: 'analyst',
        });

        if (insert_err) return err('ERROR_SERVIDOR', 500);
        return ok({ email });
      }
    }
    console.error({ fn: 'invite', error: auth_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: insert_err } = await admin.from('platform_users').insert({
    auth_user_id: auth_user.user.id,
    email,
    name,
    role: 'analyst',
  });

  if (insert_err) {
    console.error({ fn: 'invite', error: insert_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  return ok({ email });
}
