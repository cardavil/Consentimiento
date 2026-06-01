import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { generate_otp, hash_code } from '../_shared/otp.ts';
import { get_tenant_connection } from '../drive-service/connection.ts';
import { otp_email } from '../_shared/email_templates.ts';
import { send_whatsapp_otp } from '../_shared/channels/whatsapp.ts';
import { send_sms_otp } from '../_shared/channels/sms.ts';
import { MAX_OTP_SENDS_PER_SESSION, OTP_TTL_MS, OTP_RATE_WINDOW_MS, MAX_ACTIVE_OTPS } from '../_shared/limits.ts';

// Issues + delivers a signer OTP. The signing session (x-access-token) is the source of truth:
// the recipient email/phone come from the session's stored signer, never from the request body.
export async function handle_send(body: Record<string, unknown>, req: Request): Promise<Response> {
  if (body.context !== 'sign') return err('INVALID_ACTION');

  const access_token = req.headers.get('x-access-token');
  if (!access_token) return err('TOKEN_REQUERIDO', 401);

  const admin = create_admin_client();

  // 1) Validate the session BEFORE any write (no token => no OTP row, no rate-budget spend).
  const { data: session } = await admin
    .from('signing_sessions_results')
    .select('id, tenant_id')
    .eq('access_token', access_token)
    .maybeSingle();
  if (!session) return err('SESION_INVALIDA', 404);

  // 2) Recipient is derived from the session's signer, not from body.email.
  const { data: temp } = await admin
    .from('signing_sessions_temp')
    .select('signer')
    .eq('session_id', session.id)
    .maybeSingle();
  const signer = (temp?.signer || {}) as Record<string, unknown>;
  const email = String(signer.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('SIGNER_SIN_EMAIL');

  const channel = ['email', 'sms', 'whatsapp'].includes(body.channel as string)
    ? (body.channel as string) : 'email';

  // 3) Anti-spam caps: per-session sends + per-email active codes.
  const { count: sends } = await admin
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'signing_otp_sent')
    .eq('event_data->>session', session.id);
  if ((sends ?? 0) >= MAX_OTP_SENDS_PER_SESSION) return err('OTP_MAX_ENVIOS', 429);

  const { count } = await admin
    .from('otp_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .is('verified_at', null)
    .gt('created_at', new Date(Date.now() - OTP_RATE_WINDOW_MS).toISOString());
  if ((count ?? 0) >= MAX_ACTIVE_OTPS) return err('RATE_LIMITED', 429);

  // 4) Issue and deliver.
  const code = generate_otp(8);
  const code_hash = await hash_code(code);

  const { error: insert_err } = await admin.from('otp_tokens').insert({
    email,
    code_hash,
    purpose: 'sign',
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (insert_err) {
    console.error({ fn: 'send', error: insert_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  try {
    if (channel === 'email') {
      const conn = await get_tenant_connection(admin, session.tenant_id);
      if (!conn || !conn.sender_email) return err('SIN_NUBE_CONECTADA');
      const tpl = otp_email(code, 'Verificación de tu firma.');
      await conn.provider.send_email(conn.access_token, conn.sender_email, email, tpl.subject, tpl.html, tpl.text);
    } else {
      const phone = String(signer.phone || '').trim();
      if (!phone) return err('SIN_TELEFONO');
      if (channel === 'whatsapp') await send_whatsapp_otp(admin, session.tenant_id, phone, code);
      else await send_sms_otp(admin, session.tenant_id, phone, code);
    }
  } catch (e) {
    console.error({ fn: 'send.delivery', channel, error: (e as Error).message });
    return err('OTP_ENVIO_FALLIDO', 502);
  }

  await admin.from('signing_sessions_results').update({ otp_channel: channel }).eq('id', session.id);
  await admin.from('audit_log').insert({
    tenant_id: session.tenant_id,
    event_type: 'signing_otp_sent',
    event_data: { channel, session: session.id },
  });

  return ok({});
}
