import { ok, err } from '../_shared/response.ts';
import { require_tenant } from '../_shared/auth.ts';
import { encrypt_secret } from '../drive-service/connection.ts';
import { send_sms_otp } from '../_shared/channels/sms.ts';
import { send_whatsapp_otp } from '../_shared/channels/whatsapp.ts';

const TEST_OTP_CODE = '123456'; // dummy code for the onboarding "test channel" button

// Non-secret status of both 2FA channels (for the onboarding UI).
export async function handle_get_config(_body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const { data: sms } = await ctx.admin
    .from('tenant_sms_config').select('gateway_url, enabled').eq('tenant_id', ctx.tenant_id).maybeSingle();
  const { data: wa } = await ctx.admin
    .from('tenant_whatsapp_config').select('phone_number_id, waba_id, display_phone, enabled').eq('tenant_id', ctx.tenant_id).maybeSingle();

  return ok({
    sms: { configured: !!sms, gateway_url: sms?.gateway_url ?? null, enabled: sms?.enabled ?? false },
    whatsapp: { configured: !!wa, phone_number_id: wa?.phone_number_id ?? null, display_phone: wa?.display_phone ?? null, enabled: wa?.enabled ?? false },
  });
}

export async function handle_set_sms(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const gateway_url = (body.gateway_url as string || '').trim();
  const api_key = (body.api_key as string || '').trim();
  const hmac_secret = (body.hmac_secret as string || '').trim();
  if (!gateway_url || !api_key || !hmac_secret) return err('DATOS_REQUERIDOS');

  const row: Record<string, unknown> = {
    tenant_id: ctx.tenant_id,
    gateway_url,
    api_key: await encrypt_secret(ctx.admin, api_key),
    hmac_secret: await encrypt_secret(ctx.admin, hmac_secret),
    enabled: body.enabled !== false,
  };
  const { error } = await ctx.admin.from('tenant_sms_config').upsert(row, { onConflict: 'tenant_id' });
  if (error) { console.error({ fn: 'set_sms', error: error.message }); return err('ERROR_SERVIDOR', 500); }
  return ok({});
}

export async function handle_set_whatsapp(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const phone_number_id = (body.phone_number_id as string || '').trim();
  const waba_id = (body.waba_id as string || '').trim();
  const access_token = (body.access_token as string || '').trim();
  const display_phone = (body.display_phone as string || '').trim();
  if (!phone_number_id || !access_token) return err('DATOS_REQUERIDOS');

  const row: Record<string, unknown> = {
    tenant_id: ctx.tenant_id,
    phone_number_id,
    waba_id: waba_id || null,
    access_token: await encrypt_secret(ctx.admin, access_token),
    display_phone: display_phone || null,
    enabled: body.enabled !== false,
  };
  const { error } = await ctx.admin.from('tenant_whatsapp_config').upsert(row, { onConflict: 'tenant_id' });
  if (error) { console.error({ fn: 'set_whatsapp', error: error.message }); return err('ERROR_SERVIDOR', 500); }
  return ok({});
}

export async function handle_test(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);
  const channel = body.channel as string;
  const phone = (body.phone as string || '').trim();
  if (!phone) return err('TELEFONO_REQUERIDO');
  try {
    if (channel === 'whatsapp') await send_whatsapp_otp(ctx.admin, ctx.tenant_id, phone, TEST_OTP_CODE);
    else if (channel === 'sms') await send_sms_otp(ctx.admin, ctx.tenant_id, phone, TEST_OTP_CODE);
    else return err('CANAL_INVALIDO');
    return ok({});
  } catch (e) {
    console.error({ fn: 'test', channel, error: (e as Error).message });
    return err('PRUEBA_FALLIDA', 502);
  }
}
