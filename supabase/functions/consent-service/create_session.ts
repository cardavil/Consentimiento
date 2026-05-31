import { ok, err } from '../_shared/response.ts';
import { require_tenant } from '../_shared/auth.ts';
import { get_tenant_connection } from '../drive-service/connection.ts';
import { invite_email } from '../_shared/email_templates.ts';
import { tenant_display_name } from '../_shared/tenant.ts';
import { MAX_DOCS_PER_SESSION } from '../_shared/limits.ts';

const VALID_SIGNER_TYPES = ['natural', 'natural_represented', 'juridica'];

// Creates a consent session: permanent row in results + transient row in temp,
// then emails the signing link to the recipient from the tenant's own account.
export async function handle_create_session(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const signer_type = body.signer_type as string;
  const signer = body.signer as Record<string, unknown> | undefined;
  const documents = (body.documents as unknown[]) || [];
  const consents = (body.consents as unknown[]) || [];
  const context = (body.context as string) || '';
  const expires_in_hours = Number(body.expires_in_hours) || 72;

  if (!VALID_SIGNER_TYPES.includes(signer_type)) return err('SIGNER_TYPE_INVALID');
  if (!signer || typeof signer !== 'object') return err('SIGNER_REQUERIDO');
  const recipient = String((signer as Record<string, unknown>).email || '').trim().toLowerCase();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return err('EMAIL_INVALID');
  if (!documents.length) return err('DOCUMENTOS_REQUERIDOS');
  if (documents.length > MAX_DOCS_PER_SESSION) return err('DEMASIADOS_DOCUMENTOS');
  if (!consents.length) return err('CONSENTIMIENTOS_REQUERIDOS');

  const expires_at = new Date(Date.now() + expires_in_hours * 3600 * 1000).toISOString();

  const { data: result, error: result_err } = await ctx.admin
    .from('signing_sessions_results')
    .insert({
      tenant_id: ctx.tenant_id,
      signer_type,
      session_type: 'consent',
      otp_channel: 'email',
      status: 'pending',
      token_expires_at: expires_at,
      expires_at,
    })
    .select('id, access_token')
    .single();

  if (result_err || !result) {
    console.error({ fn: 'create_session', error: result_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: temp_err } = await ctx.admin.from('signing_sessions_temp').insert({
    session_id: result.id,
    documents,
    consents,
    signer,
    context,
  });

  if (temp_err) {
    await ctx.admin.from('signing_sessions_results').delete().eq('id', result.id);
    console.error({ fn: 'create_session', error: temp_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const base = Deno.env.get('OAUTH_REDIRECT_BASE') || '';
  const signing_url = `${base}/firmar.html?token=${result.access_token}`;

  // Best-effort invite email from the tenant's own account (zero-knowledge).
  let email_sent = false;
  try {
    const conn = await get_tenant_connection(ctx.admin, ctx.tenant_id);
    if (conn && conn.sender_email) {
      const tenant_name = await tenant_display_name(ctx.admin, ctx.tenant_id);
      const tpl = invite_email(signing_url, tenant_name, context);
      await conn.provider.send_email(conn.access_token, conn.sender_email, recipient, tpl.subject, tpl.html, tpl.text);
      email_sent = true;
    }
  } catch (e) {
    console.error({ fn: 'create_session.invite', error: (e as Error).message });
  }

  await ctx.admin.from('audit_log').insert({
    tenant_id: ctx.tenant_id,
    event_type: 'session_created',
    event_data: { signer_type, documents: documents.length, consents: consents.length, email_sent },
  });

  return ok({ session_id: result.id, access_token: result.access_token, signing_url, expires_at, email_sent });
}
