import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { generate_otp, hash_code } from '../_shared/otp.ts';
import { get_org_connection } from '../drive-service/connection.ts';
import { otp_email } from '../_shared/email_templates.ts';
import { send_whatsapp_otp } from '../_shared/channels/whatsapp.ts';
import { send_sms_otp } from '../_shared/channels/sms.ts';

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ACTIVE_OTPS = 3;

export async function handle_send(body: Record<string, unknown>, req: Request): Promise<Response> {
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

  const code = generate_otp(8);
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

  // Signer OTP: deliver via the channel the signer chose, from the client's own account.
  if (purpose === 'sign') {
    const access_token = req.headers.get('x-access-token');
    if (!access_token) return err('TOKEN_REQUERIDO', 401);

    const channel = ['email', 'sms', 'whatsapp'].includes(body.channel as string)
      ? (body.channel as string) : 'email';

    const { data: session } = await admin
      .from('signing_sessions_results')
      .select('id, organization_id')
      .eq('access_token', access_token)
      .maybeSingle();
    if (!session) return err('SESION_INVALIDA', 404);

    try {
      if (channel === 'email') {
        const conn = await get_org_connection(admin, session.organization_id);
        if (!conn || !conn.sender_email) return err('SIN_NUBE_CONECTADA');
        const tpl = otp_email(code, 'Verificación de tu firma.');
        await conn.provider.send_email(conn.access_token, conn.sender_email, email, tpl.subject, tpl.html, tpl.text);
      } else {
        const phone = await signer_phone(admin, session.id);
        if (!phone) return err('SIN_TELEFONO');
        if (channel === 'whatsapp') await send_whatsapp_otp(admin, session.organization_id, phone, code);
        else await send_sms_otp(admin, session.organization_id, phone, code);
      }
    } catch (e) {
      console.error({ fn: 'send.delivery', channel, error: (e as Error).message });
      return err('OTP_ENVIO_FALLIDO', 502);
    }

    await admin.from('signing_sessions_results').update({ otp_channel: channel }).eq('id', session.id);
    await admin.from('audit_log').insert({
      organization_id: session.organization_id,
      event_type: 'signing_otp_sent',
      event_data: { channel },
    });
  }

  return ok({});
}

async function signer_phone(admin: ReturnType<typeof create_admin_client>, session_id: string): Promise<string> {
  const { data: temp } = await admin
    .from('signing_sessions_temp').select('signer').eq('session_id', session_id).maybeSingle();
  const signer = (temp?.signer || {}) as Record<string, unknown>;
  return String(signer.telefono || '').trim();
}
