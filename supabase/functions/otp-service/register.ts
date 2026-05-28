import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { validate_otp, generate_session } from './otp_check.ts';

interface OrgData {
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

export async function handle_register(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string || '').trim().toLowerCase();
  const code = (body.code as string || '').trim();
  const org_data = body.org_data as OrgData | undefined;

  if (!email || !code || code.length !== 6 || !org_data) return err('OTP_INVALID');

  const admin = create_admin_client();

  const otp_result = await validate_otp(admin, email, code);
  if (!otp_result.valid) return err(otp_result.error_code!);

  const dup = await check_duplicates(admin, org_data.email, org_data.doc_number);
  if (dup) return dup;

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
    console.error({ fn: 'register', error: org_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: auth_err } = await admin.auth.admin.createUser({
    email: org_data.email,
    email_confirm: true,
    app_metadata: { org_id: org.id },
    user_metadata: { name: org_data.first_name + ' ' + (org_data.last_name || '') },
  });

  if (auth_err) {
    console.error({ fn: 'register', error: auth_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const session = await generate_session(admin, org_data.email);
  if (!session) return err('ERROR_SERVIDOR', 500);

  await admin.from('audit_log').insert({
    organization_id: org.id,
    event_type: 'org_registered',
    event_data: { type: org_data.type },
    ip: (body.ip as string) || null,
    ua: (body.user_agent as string) || null,
  });

  return ok(session);
}

async function check_duplicates(
  admin: ReturnType<typeof create_admin_client>,
  email: string,
  doc_number: string,
): Promise<Response | null> {
  const { data: by_email } = await admin
    .from('organizations')
    .select('id')
    .eq('email', email)
    .limit(1)
    .single();

  if (by_email) return err('EMAIL_DUPLICADO', 409);

  const { data: by_doc } = await admin
    .from('organizations')
    .select('id')
    .eq('doc_number', doc_number)
    .limit(1)
    .single();

  if (by_doc) return err('DOCUMENTO_DUPLICADO', 409);

  return null;
}
