// WhatsApp Business API OTP delivery (Meta Graph), using the tenant's own account.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decrypt_secret } from '../../drive-service/connection.ts';

export async function send_whatsapp_otp(
  admin: SupabaseClient,
  tenant_id: string,
  to: string,
  code: string,
): Promise<void> {
  const { data: cfg } = await admin
    .from('tenant_whatsapp_config')
    .select('phone_number_id, access_token, enabled')
    .eq('tenant_id', tenant_id)
    .maybeSingle();
  if (!cfg || !cfg.enabled || !cfg.phone_number_id) throw new Error('WHATSAPP_NO_CONFIGURADO');

  const access_token = await decrypt_secret(admin, cfg.access_token);
  const template = Deno.env.get('WHATSAPP_OTP_TEMPLATE') || 'otp_code';
  const lang = Deno.env.get('WHATSAPP_OTP_LANG') || 'es';

  const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: lang },
        components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
      },
    }),
  });
  if (!res.ok) throw new Error(`whatsapp_send ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
