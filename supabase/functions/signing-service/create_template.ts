import { ok, err } from '../_shared/response.ts';
import { require_tenant } from '../_shared/auth.ts';

const LIMITS: Record<string, number> = { trial: 0, basic: 3, pro: 20, enterprise: Infinity };

// Creates a signature template, enforcing the per-plan active-template limit.
export async function handle_create_template(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const name = (body.name as string || '').trim();
  const fields = (body.fields as unknown[]) || [];
  const source_file_name = (body.source_file_name as string) || null;
  const page_count = Number(body.page_count) || null;
  if (!name) return err('NOMBRE_REQUERIDO');

  const { data: tenant } = await ctx.admin
    .from('tenants').select('plan').eq('id', ctx.tenant_id).maybeSingle();
  const plan = (tenant?.plan as string) || 'trial';
  const limit = LIMITS[plan] ?? 0;

  const { count } = await ctx.admin
    .from('signing_templates')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenant_id)
    .eq('active', true);

  if ((count ?? 0) >= limit) return err('LIMITE_PLANTILLAS', 403);

  const { data, error } = await ctx.admin
    .from('signing_templates')
    .insert({ tenant_id: ctx.tenant_id, name, source_file_name, page_count, fields })
    .select('id')
    .single();

  if (error) {
    console.error({ fn: 'create_template', error: error.message });
    return err('ERROR_SERVIDOR', 500);
  }
  return ok({ id: data.id });
}
