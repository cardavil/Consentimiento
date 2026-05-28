import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

const VALID_PLANS = ['trial', 'basic', 'pro', 'enterprise'];

export async function handle_update_org(body: Record<string, unknown>): Promise<Response> {
  const org_id = body.org_id as string;
  const plan = body.plan as string;
  const active = body.active as boolean;

  if (!org_id) return err('DATOS_INCOMPLETOS');

  const updates: Record<string, unknown> = {};

  if (plan !== undefined) {
    if (!VALID_PLANS.includes(plan)) return err('PLAN_INVALIDO');
    updates.plan = plan;
  }

  if (active !== undefined) {
    updates.active = active;
  }

  if (Object.keys(updates).length === 0) return err('DATOS_INCOMPLETOS');

  const admin = create_admin_client();

  const { error } = await admin
    .from('organizations')
    .update(updates)
    .eq('id', org_id);

  if (error) {
    console.error({ fn: 'update_org', error: error.message });
    return err('ERROR_SERVIDOR', 500);
  }

  return ok({ org_id });
}
