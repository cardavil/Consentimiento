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

  const send_ok = await send_email(email, code);
  if (!send_ok) return err('ERROR_SERVIDOR', 500);

  return ok({});
}

async function send_email(to: string, code: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.error({ fn: 'send_email', error: 'RESEND_API_KEY not set' });
    return false;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Consentia <onboarding@resend.dev>',
      to: [to],
      subject: 'Tu codigo de verificacion - Consentia',
      html: build_email_html(code),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error({ fn: 'send_email', error: body, to });
    return false;
  }
  return true;
}

function build_email_html(code: string): string {
  const digits = code.split('').map((d) =>
    `<span style="display:inline-block;width:40px;height:48px;line-height:48px;text-align:center;font-size:28px;font-family:'IBM Plex Mono',monospace;font-weight:600;background:#E6F7F5;color:#1E2A3A;border-radius:8px;margin:0 3px;">${d}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F8FC;font-family:'DM Sans',system-ui,sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#1E2A3A,#0F4C5C,#17B3A3);padding:24px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-family:'DM Serif Display',Georgia,serif;font-size:24px;font-weight:400;">Consentia</h1>
  </div>
  <div style="padding:32px 24px;text-align:center;">
    <p style="color:#1F2937;font-size:16px;margin:0 0 8px;">Tu codigo de verificacion</p>
    <div style="margin:24px 0;">${digits}</div>
    <p style="color:#5F7D95;font-size:14px;margin:24px 0 0;">Este codigo expira en 5 minutos.</p>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #DCE5EE;text-align:center;">
    <p style="color:#5F7D95;font-size:12px;margin:0;">Si no solicitaste este codigo, puedes ignorar este mensaje.</p>
  </div>
</div>
</body>
</html>`;
}
