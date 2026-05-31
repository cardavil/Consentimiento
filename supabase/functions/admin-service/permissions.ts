import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

const VALID_PERMISSIONS = [
  'read:tenants', 'read:audit_log', 'read:sessions',
  'read:catalogs', 'write:catalogs', 'read:metrics',
];

export async function handle_set_permissions(body: Record<string, unknown>): Promise<Response> {
  const user_id = body.user_id as string;
  const permissions = body.permissions as string[];

  if (!user_id || !Array.isArray(permissions)) return err('DATOS_INCOMPLETOS');

  for (const p of permissions) {
    if (!VALID_PERMISSIONS.includes(p)) return err('PERMISO_INVALIDO: ' + p);
  }

  const admin = create_admin_client();

  const { data: user } = await admin
    .from('platform_users')
    .select('id, role')
    .eq('id', user_id)
    .single();

  if (!user || user.role !== 'analyst') return err('USUARIO_NO_ENCONTRADO');

  await admin
    .from('platform_permissions')
    .delete()
    .eq('user_id', user_id);

  if (permissions.length > 0) {
    const rows = permissions.map((p) => ({
      user_id,
      permission: p,
    }));

    const { error } = await admin
      .from('platform_permissions')
      .insert(rows);

    if (error) {
      console.error({ fn: 'set_permissions', error: error.message });
      return err('ERROR_SERVIDOR', 500);
    }
  }

  return ok({ user_id, permissions });
}

export async function handle_toggle_user(body: Record<string, unknown>): Promise<Response> {
  const user_id = body.user_id as string;
  const active = body.active as boolean;

  if (!user_id || active === undefined) return err('DATOS_INCOMPLETOS');

  const admin = create_admin_client();

  const { error } = await admin
    .from('platform_users')
    .update({ active })
    .eq('id', user_id)
    .neq('role', 'admin');

  if (error) {
    console.error({ fn: 'toggle_user', error: error.message });
    return err('ERROR_SERVIDOR', 500);
  }

  return ok({ user_id, active });
}
