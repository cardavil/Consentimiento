import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';

// Token-scoped: which OTP channels the tenant has enabled (for the signer's selector).
export async function handle_get_channels(_body: Record<string, unknown>, req: Request): Promise<Response> {
  const access_token = req.headers.get('x-access-token');
  if (!access_token) return err('TOKEN_REQUERIDO', 401);

  const admin = create_admin_client();
  const { data: session } = await admin
    .from('signing_sessions_results')
    .select('tenant_id')
    .eq('access_token', access_token)
    .maybeSingle();
  if (!session) return err('SESION_INVALIDA', 404);

  const tenant_id = session.tenant_id;
  const { data: oauth } = await admin.from('tenant_oauth').select('sender_email').eq('tenant_id', tenant_id).maybeSingle();
  const { data: sms } = await admin.from('tenant_sms_config').select('enabled').eq('tenant_id', tenant_id).maybeSingle();
  const { data: wa } = await admin.from('tenant_whatsapp_config').select('enabled').eq('tenant_id', tenant_id).maybeSingle();

  return ok({
    email: !!(oauth && oauth.sender_email),
    sms: !!(sms && sms.enabled),
    whatsapp: !!(wa && wa.enabled),
  });
}
