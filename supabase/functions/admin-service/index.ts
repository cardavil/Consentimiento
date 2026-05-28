import { handle_cors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { handle_invite } from './invite.ts';
import { handle_update_org } from './update_org.ts';
import { handle_set_permissions, handle_toggle_user } from './permissions.ts';

async function get_platform_role(req: Request): Promise<string | null> {
  const auth_header = req.headers.get('authorization');
  if (!auth_header) return null;

  const jwt = auth_header.replace('Bearer ', '');
  const admin = create_admin_client();
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;

  return (data.user.app_metadata?.platform_role as string) || null;
}

Deno.serve(async (req) => {
  const cors = handle_cors(req);
  if (cors) return cors;

  try {
    const role = await get_platform_role(req);
    if (role !== 'admin') {
      return err('FORBIDDEN', 403);
    }

    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'invite':
        return await handle_invite(body);
      case 'update_org':
        return await handle_update_org(body);
      case 'set_permissions':
        return await handle_set_permissions(body);
      case 'toggle_user':
        return await handle_toggle_user(body);
      default:
        return err('INVALID_ACTION');
    }
  } catch (e) {
    console.error({ fn: 'admin-service', error: (e as Error).message });
    return err('ERROR_SERVIDOR', 500);
  }
});
