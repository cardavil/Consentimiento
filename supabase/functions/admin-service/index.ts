import { handle_cors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { handle_invite } from './invite.ts';
import { handle_update_tenant } from './update_tenant.ts';
import { handle_set_permissions, handle_toggle_user } from './permissions.ts';
import { handle_metrics } from './metrics.ts';
import { handle_bootstrap_tenant } from './bootstrap_tenant.ts';

interface AuthInfo {
  user_id: string;
  role: string;
  permissions: string[];
}

async function get_auth_info(req: Request): Promise<AuthInfo | null> {
  const auth_header = req.headers.get('authorization');
  if (!auth_header) return null;

  const jwt = auth_header.replace('Bearer ', '');
  const admin = create_admin_client();
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;

  const role = (data.user.app_metadata?.platform_role as string) || '';
  if (!role) return null;

  let permissions: string[] = [];
  if (role === 'analyst') {
    const { data: perms } = await admin
      .from('platform_permissions')
      .select('permission')
      .eq('user_id', data.user.id);
    permissions = (perms || []).map((p: { permission: string }) => p.permission);
  }

  return { user_id: data.user.id, role, permissions };
}

Deno.serve(async (req) => {
  const cors = handle_cors(req);
  if (cors) return cors;

  try {
    const auth = await get_auth_info(req);
    if (!auth) return err('FORBIDDEN', 403);

    const body = await req.json();
    const action = body.action as string;

    if (action === 'metrics') {
      if (auth.role === 'admin' || auth.permissions.includes('read:metrics')) {
        return await handle_metrics();
      }
      return err('FORBIDDEN', 403);
    }

    if (auth.role !== 'admin') return err('FORBIDDEN', 403);

    switch (action) {
      case 'invite':
        return await handle_invite(body);
      case 'update_tenant':
        return await handle_update_tenant(body);
      case 'set_permissions':
        return await handle_set_permissions(body);
      case 'toggle_user':
        return await handle_toggle_user(body);
      case 'bootstrap_tenant':
        return await handle_bootstrap_tenant(body, auth.user_id);
      default:
        return err('INVALID_ACTION');
    }
  } catch (e) {
    console.error({ fn: 'admin-service', error: (e as Error).message });
    return err('ERROR_SERVIDOR', 500);
  }
});
