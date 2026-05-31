import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

interface TenantData {
  type: string;
  first_name: string;
  last_name?: string;
  doc_type: string;
  doc_number: string;
  email: string;
  phone: string;
  position?: string;
  company_name?: string;
  company_nit?: string;
}

export async function handle_register(
  body: Record<string, unknown>,
  req: Request,
): Promise<Response> {
  const tenant_data = body.tenant_data as TenantData | undefined;
  if (!tenant_data || !tenant_data.email || !tenant_data.doc_number) return err('OTP_INVALID');

  const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!jwt) return err('SESSION_EXPIRED', 401);

  const admin = create_admin_client();

  const { data: { user }, error: user_err } = await admin.auth.getUser(jwt);
  if (user_err || !user) return err('SESSION_EXPIRED', 401);

  const dup = await check_duplicates(admin, tenant_data.email, tenant_data.doc_number);
  if (dup) return dup;

  const { data: tenant, error: tenant_err } = await admin
    .from('tenants')
    .insert({
      type: tenant_data.type,
      first_name: tenant_data.first_name,
      last_name: tenant_data.last_name || null,
      doc_type: tenant_data.doc_type,
      doc_number: tenant_data.doc_number,
      email: tenant_data.email,
      phone: tenant_data.phone,
      position: tenant_data.position || null,
      company_name: tenant_data.company_name || null,
      company_nit: tenant_data.company_nit || null,
    })
    .select('id')
    .single();

  if (tenant_err || !tenant) {
    console.error({ fn: 'register', error: tenant_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: meta_err } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, tenant_id: tenant.id },
  });

  if (meta_err) {
    console.error({ fn: 'register', error: meta_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  await admin.from('audit_log').insert({
    tenant_id: tenant.id,
    event_type: 'tenant_registered',
    event_data: { type: tenant_data.type },
    ip: (body.ip as string) || null,
    ua: (body.user_agent as string) || null,
  });

  return ok({});
}

async function check_duplicates(
  admin: ReturnType<typeof create_admin_client>,
  email: string,
  doc_number: string,
): Promise<Response | null> {
  const { data: by_email } = await admin
    .from('tenants')
    .select('id')
    .eq('email', email)
    .limit(1)
    .single();

  if (by_email) return err('EMAIL_DUPLICADO', 409);

  const { data: by_doc } = await admin
    .from('tenants')
    .select('id')
    .eq('doc_number', doc_number)
    .limit(1)
    .single();

  if (by_doc) return err('DOCUMENTO_DUPLICADO', 409);

  return null;
}
