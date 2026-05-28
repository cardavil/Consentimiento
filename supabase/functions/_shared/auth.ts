import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create_admin_client } from './supabase.ts';

export interface OrgContext {
  admin: SupabaseClient;
  user_id: string;
  org_id: string;
}

// Validates the org user's JWT and resolves their organization_id from app_metadata.
// Returns null when the token is missing/invalid or the user has no org.
export async function require_org(req: Request): Promise<OrgContext | null> {
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!jwt) return null;

  const admin = create_admin_client();
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return null;

  const org_id = (user.app_metadata as Record<string, unknown> | undefined)?.org_id as string | undefined;
  if (!org_id) return null;

  return { admin, user_id: user.id, org_id };
}
