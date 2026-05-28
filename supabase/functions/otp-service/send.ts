import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { generate_otp, hash_code } from './otp_check.ts';

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ACTIVE_OTPS = 3;

export async function handle_send(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err('EMAIL_INVALID');
  }

  const purpose = body.context === 'sign' ? 'sign' : 'login';
  const admin = create_admin_client();

  const { count } = await admin
    .from('otp_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .is('verified_at', null)
    .gt('created_at', new Date(Date.now() - RATE_WINDOW_MS).toISOString());

  if ((count ?? 0) >= MAX_ACTIVE_OTPS) return err('RATE_LIMITED', 429);

  const code = generate_otp(6);
  const code_hash = await hash_code(code);

  const { error: insert_err } = await admin.from('otp_tokens').insert({
    email,
    code_hash,
    purpose,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });

  if (insert_err) {
    console.error({ fn: 'send', error: insert_err.message, email });
    return err('ERROR_SERVIDOR', 500);
  }

  // Email transport for signing OTP — uses client's OAuth (Gmail/Microsoft)
  // via org_oauth table. Implementation pending with consent-service.
  console.log({ fn: 'send', email, purpose, code_length: code.length });

  if (purpose === 'sign') {
    await admin.from('audit_log').insert({
      organization_id: null,
      event_type: 'signing_otp_sent',
      event_data: { email_domain: email.split('@')[1] },
    });
  }

  return ok({});
}
