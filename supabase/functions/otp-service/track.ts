import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

export async function handle_track(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string || '').trim().toLowerCase();
  if (!email) return err('DATOS_INCOMPLETOS');

  // Only the auth (login/registro) flows call track; signer OTPs are logged in send.ts.
  const admin = create_admin_client();

  await admin.from('audit_log').insert({
    tenant_id: null,
    event_type: 'auth_otp_sent',
    event_data: { email_domain: email.split('@')[1] },
    ip: (body.ip as string) || null,
    ua: (body.user_agent as string) || null,
  });

  return ok({});
}
