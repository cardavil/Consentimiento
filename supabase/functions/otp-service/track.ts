import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

export async function handle_track(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string || '').trim().toLowerCase();
  if (!email) return err('DATOS_INCOMPLETOS');

  const context = body.context as string || 'auth';
  const event_type = context === 'auth' ? 'auth_otp_sent' : 'signing_otp_sent';

  const admin = create_admin_client();

  await admin.from('audit_log').insert({
    organization_id: null,
    event_type,
    event_data: { email_domain: email.split('@')[1] },
    ip: (body.ip as string) || null,
    ua: (body.user_agent as string) || null,
  });

  return ok({});
}
