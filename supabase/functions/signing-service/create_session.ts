import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ok, err } from '../_shared/response.ts';
import { require_org } from '../_shared/auth.ts';
import { get_org_connection } from '../drive-service/connection.ts';
import { invite_email } from '../_shared/email_templates.ts';

const VALID_MODES = ['natural_personal', 'natural_tutor', 'juridica'];

// Creates a firma session: results (session_type=firma, optional template_id) + temp
// (single document, signer, field definitions), then emails the signing link.
export async function handle_create_session(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_org(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const mode = body.mode as string;
  const signer = body.signer as Record<string, unknown> | undefined;
  const documents = (body.documents as unknown[]) || [];
  const fields = (body.fields as unknown[]) || [];
  const template_id = (body.template_id as string) || null;
  const context = (body.context as string) || '';
  const expires_in_hours = Number(body.expires_in_hours) || 72;

  if (!VALID_MODES.includes(mode)) return err('MODE_INVALID');
  if (!signer || typeof signer !== 'object') return err('SIGNER_REQUERIDO');
  const recipient = String((signer as Record<string, unknown>).email || '').trim().toLowerCase();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return err('EMAIL_INVALID');
  if (documents.length !== 1) return err('DOCUMENTO_UNICO_REQUERIDO');
  if (!fields.length) return err('CAMPOS_REQUERIDOS');

  const expires_at = new Date(Date.now() + expires_in_hours * 3600 * 1000).toISOString();

  const { data: result, error: result_err } = await ctx.admin
    .from('signing_sessions_results')
    .insert({
      organization_id: ctx.org_id,
      mode,
      session_type: 'firma',
      otp_channel: 'email',
      status: 'pending',
      template_id,
      token_expires_at: expires_at,
      expires_at,
    })
    .select('id, access_token')
    .single();

  if (result_err || !result) {
    console.error({ fn: 'firma.create_session', error: result_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: temp_err } = await ctx.admin.from('signing_sessions_temp').insert({
    session_id: result.id,
    documents,
    consents: [],
    signer,
    fields,
    context,
  });

  if (temp_err) {
    await ctx.admin.from('signing_sessions_results').delete().eq('id', result.id);
    console.error({ fn: 'firma.create_session', error: temp_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const base = Deno.env.get('OAUTH_REDIRECT_BASE') || '';
  const signing_url = `${base}/firmar.html?token=${result.access_token}`;

  let email_sent = false;
  try {
    const conn = await get_org_connection(ctx.admin, ctx.org_id);
    if (conn && conn.sender_email) {
      const org_name = await org_display_name(ctx.admin, ctx.org_id);
      const tpl = invite_email(signing_url, org_name, context);
      await conn.provider.send_email(conn.access_token, conn.sender_email, recipient, tpl.subject, tpl.html, tpl.text);
      email_sent = true;
    }
  } catch (e) {
    console.error({ fn: 'firma.create_session.invite', error: (e as Error).message });
  }

  await ctx.admin.from('audit_log').insert({
    organization_id: ctx.org_id,
    event_type: 'firma_session_created',
    event_data: { mode, fields: fields.length, template: !!template_id, email_sent },
  });

  return ok({ session_id: result.id, access_token: result.access_token, signing_url, expires_at, email_sent });
}

async function org_display_name(admin: SupabaseClient, org_id: string): Promise<string> {
  const { data } = await admin
    .from('organizations').select('type, first_name, last_name, company_name').eq('id', org_id).maybeSingle();
  if (!data) return 'Consentia';
  if (data.type === 'juridica') return data.company_name || 'Consentia';
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Consentia';
}
