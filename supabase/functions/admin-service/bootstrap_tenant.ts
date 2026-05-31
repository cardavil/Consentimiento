import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

interface BootstrapData {
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

export async function handle_bootstrap_tenant(
  body: Record<string, unknown>,
  auth_user_id: string,
): Promise<Response> {
  const tenant_data = body.tenant_data as BootstrapData | undefined;
  if (!tenant_data || !tenant_data.email || !tenant_data.doc_number) {
    return err('DATOS_INCOMPLETOS');
  }

  const admin = create_admin_client();

  const { data: { user }, error: user_err } = await admin.auth.admin.getUserById(auth_user_id);
  if (user_err || !user) return err('USUARIO_NO_ENCONTRADO', 404);

  if (user.app_metadata?.tenant_id) {
    return err('TENANT_YA_EXISTE', 409);
  }

  const { data: dup_email } = await admin
    .from('tenants')
    .select('id')
    .eq('email', tenant_data.email)
    .maybeSingle();
  if (dup_email) return err('EMAIL_DUPLICADO', 409);

  const { data: dup_doc } = await admin
    .from('tenants')
    .select('id')
    .eq('doc_number', tenant_data.doc_number)
    .maybeSingle();
  if (dup_doc) return err('DOCUMENTO_DUPLICADO', 409);

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
    console.error({ fn: 'bootstrap_tenant', error: tenant_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: meta_err } = await admin.auth.admin.updateUserById(auth_user_id, {
    app_metadata: { ...user.app_metadata, tenant_id: tenant.id },
  });

  if (meta_err) {
    console.error({ fn: 'bootstrap_tenant', error: meta_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  await admin.from('audit_log').insert({
    tenant_id: tenant.id,
    event_type: 'tenant_bootstrapped',
    event_data: { type: tenant_data.type, admin_user_id: auth_user_id },
  });

  return ok({ tenant_id: tenant.id });
}
