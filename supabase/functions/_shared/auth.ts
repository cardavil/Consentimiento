import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create_admin_client } from './supabase.ts';

export interface TenantContext {
  admin: SupabaseClient;
  user_id: string;
  tenant_id: string;
}

// Validates the tenant user's JWT and resolves their tenant_id from app_metadata.
// Returns null when the token is missing/invalid or the user has no tenant.
export async function require_tenant(req: Request): Promise<TenantContext | null> {
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!jwt) return null;

  const admin = create_admin_client();
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return null;

  const tenant_id = (user.app_metadata as Record<string, unknown> | undefined)?.tenant_id as string | undefined;
  if (!tenant_id) return null;

  return { admin, user_id: user.id, tenant_id };
}
