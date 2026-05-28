import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

export async function handle_metrics(): Promise<Response> {
  const admin = create_admin_client();
  const now = new Date();
  const month_start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    orgs_total,
    orgs_by_plan,
    sessions_month,
    sessions_completed,
    signing_otps,
    auth_otps,
    active_orgs,
  ] = await Promise.all([
    admin.from('organizations').select('*', { count: 'exact', head: true }),

    admin.from('organizations').select('plan'),

    admin.from('signing_sessions_results').select('*', { count: 'exact', head: true })
      .gte('created_at', month_start),

    admin.from('signing_sessions_results').select('*', { count: 'exact', head: true })
      .gte('created_at', month_start)
      .eq('status', 'completed'),

    admin.from('otp_tokens').select('*', { count: 'exact', head: true })
      .gte('created_at', month_start),

    admin.from('audit_log').select('*', { count: 'exact', head: true })
      .eq('event_type', 'auth_otp_sent')
      .gte('created_at', month_start),

    admin.from('signing_sessions_results').select('organization_id')
      .gte('created_at', month_start),
  ]);

  const plan_counts: Record<string, number> = { trial: 0, basic: 0, pro: 0, enterprise: 0 };
  if (orgs_by_plan.data) {
    for (const row of orgs_by_plan.data) {
      const p = (row as { plan: string }).plan || 'trial';
      plan_counts[p] = (plan_counts[p] || 0) + 1;
    }
  }

  const unique_active = new Set(
    (active_orgs.data || []).map((r: { organization_id: string }) => r.organization_id),
  ).size;

  return ok({
    orgs_total: orgs_total.count ?? 0,
    orgs_by_plan: plan_counts,
    sessions_created_month: sessions_month.count ?? 0,
    sessions_completed_month: sessions_completed.count ?? 0,
    signing_otps_month: signing_otps.count ?? 0,
    auth_otps_month: auth_otps.count ?? 0,
    active_orgs_month: unique_active,
  });
}
