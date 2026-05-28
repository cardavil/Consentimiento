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

export async function handle_bootstrap_org(
  body: Record<string, unknown>,
  auth_user_id: string,
): Promise<Response> {
  const org_data = body.org_data as BootstrapData | undefined;
  if (!org_data || !org_data.email || !org_data.doc_number) {
    return err('DATOS_INCOMPLETOS');
  }

  const admin = create_admin_client();

  const { data: { user }, error: user_err } = await admin.auth.admin.getUserById(auth_user_id);
  if (user_err || !user) return err('USUARIO_NO_ENCONTRADO', 404);

  if (user.app_metadata?.org_id) {
    return err('ORG_YA_EXISTE', 409);
  }

  const { data: dup_email } = await admin
    .from('organizations')
    .select('id')
    .eq('email', org_data.email)
    .maybeSingle();
  if (dup_email) return err('EMAIL_DUPLICADO', 409);

  const { data: dup_doc } = await admin
    .from('organizations')
    .select('id')
    .eq('doc_number', org_data.doc_number)
    .maybeSingle();
  if (dup_doc) return err('DOCUMENTO_DUPLICADO', 409);

  const { data: org, error: org_err } = await admin
    .from('organizations')
    .insert({
      type: org_data.type,
      first_name: org_data.first_name,
      last_name: org_data.last_name || null,
      doc_type: org_data.doc_type,
      doc_number: org_data.doc_number,
      email: org_data.email,
      phone: org_data.phone,
      position: org_data.position || null,
      company_name: org_data.company_name || null,
      company_nit: org_data.company_nit || null,
    })
    .select('id')
    .single();

  if (org_err || !org) {
    console.error({ fn: 'bootstrap_org', error: org_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: meta_err } = await admin.auth.admin.updateUserById(auth_user_id, {
    app_metadata: { ...user.app_metadata, org_id: org.id },
  });

  if (meta_err) {
    console.error({ fn: 'bootstrap_org', error: meta_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  await admin.from('audit_log').insert({
    organization_id: org.id,
    event_type: 'org_bootstrapped',
    event_data: { type: org_data.type, admin_user_id: auth_user_id },
  });

  return ok({ org_id: org.id });
}
