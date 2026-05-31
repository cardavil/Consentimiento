// SMS OTP delivery via the tenant's Android gateway (Cloudflare Tunnel), HMAC-signed.
// Mirrors the 5 security layers verified on the device: API key, timestamp, nonce, HMAC, rate limit.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decrypt_secret } from '../../drive-service/connection.ts';

async function hmac_sha256_hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function send_sms_otp(
  admin: SupabaseClient,
  tenant_id: string,
  to: string,
  code: string,
): Promise<void> {
  const { data: cfg } = await admin
    .from('tenant_sms_config')
    .select('gateway_url, api_key, hmac_secret, enabled')
    .eq('tenant_id', tenant_id)
    .maybeSingle();
  if (!cfg || !cfg.enabled || !cfg.gateway_url) throw new Error('SMS_NO_CONFIGURADO');

  const api_key = await decrypt_secret(admin, cfg.api_key);
  const hmac_secret = await decrypt_secret(admin, cfg.hmac_secret);

  const message = `Tu codigo Consentia: ${code}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const canonical = `${to}|${message}|${timestamp}|${nonce}`;
  const signature = await hmac_sha256_hex(hmac_secret, canonical);

  const res = await fetch(cfg.gateway_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': api_key },
    body: JSON.stringify({ to, message, timestamp, nonce, signature }),
  });
  if (!res.ok) throw new Error(`sms_send ${res.status}`);
}
