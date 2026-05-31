import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

export async function handle_metrics(): Promise<Response> {
  const admin = create_admin_client();
  const now = new Date();
  const month_start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    tenants_total,
    tenants_by_plan,
    sessions_month,
    sessions_completed,
    signing_otps,
    auth_otps,
    active_tenants,
    db_size,
  ] = await Promise.all([
    admin.from('tenants').select('*', { count: 'exact', head: true }),

    admin.from('tenants').select('plan'),

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

    admin.from('signing_sessions_results').select('tenant_id')
      .gte('created_at', month_start),

    admin.rpc('get_db_size'),
  ]);

  const plan_counts: Record<string, number> = { trial: 0, basic: 0, pro: 0, enterprise: 0 };
  if (tenants_by_plan.data) {
    for (const row of tenants_by_plan.data) {
      const p = (row as { plan: string }).plan || 'trial';
      plan_counts[p] = (plan_counts[p] || 0) + 1;
    }
  }

  const unique_active = new Set(
    (active_tenants.data || []).map((r: { tenant_id: string }) => r.tenant_id),
  ).size;

  const sizes = db_size.data ?? { db_bytes: 0, storage_bytes: 0 };
  const to_mb = (b: number) => Math.round((b / 1024 / 1024) * 10) / 10;

  return ok({
    tenants_total: tenants_total.count ?? 0,
    tenants_by_plan: plan_counts,
    sessions_created_month: sessions_month.count ?? 0,
    sessions_completed_month: sessions_completed.count ?? 0,
    signing_otps_month: signing_otps.count ?? 0,
    auth_otps_month: auth_otps.count ?? 0,
    active_tenants_month: unique_active,
    db_size_mb: to_mb(sizes.db_bytes ?? 0),
    storage_size_mb: to_mb(sizes.storage_bytes ?? 0),
  });
}
