// Shared creation of a signing session (consent or signature): permanent results row +
// transient temp row (zero-knowledge) + best-effort invite email + audit log. The caller
// validates its own input and supplies the session_type, the temp payload, and the audit
// event/data; everything common lives here.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ok, err } from './response.ts';
import { get_tenant_connection } from '../drive-service/connection.ts';
import { invite_email } from './email_templates.ts';
import { tenant_display_name } from './tenant.ts';

export interface CreateSessionInput {
  admin: SupabaseClient;
  tenant_id: string;
  signer_type: string;
  session_type: 'consent' | 'signature';
  recipient: string;             // signer email (invite recipient)
  context: string;
  expires_in_hours: number;
  template_id?: string | null;   // signature sessions only
  temp: Record<string, unknown>; // documents, consents/fields, signer, context…
  audit_event: string;
  audit_data: Record<string, unknown>;
}

export async function create_session_record(input: CreateSessionInput): Promise<Response> {
  const { admin, tenant_id, signer_type, session_type, recipient, context,
    expires_in_hours, template_id, temp, audit_event, audit_data } = input;

  const expires_at = new Date(Date.now() + expires_in_hours * 3600 * 1000).toISOString();

  const row: Record<string, unknown> = {
    tenant_id, signer_type, session_type, otp_channel: 'email',
    status: 'pending', token_expires_at: expires_at, expires_at,
  };
  if (template_id !== undefined) row.template_id = template_id;

  const { data: result, error: result_err } = await admin
    .from('signing_sessions_results').insert(row).select('id, access_token').single();
  if (result_err || !result) {
    console.error({ fn: 'create_session_record', error: result_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const { error: temp_err } = await admin.from('signing_sessions_temp')
    .insert({ session_id: result.id, ...temp });
  if (temp_err) {
    await admin.from('signing_sessions_results').delete().eq('id', result.id);
    console.error({ fn: 'create_session_record', error: temp_err.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const base = Deno.env.get('OAUTH_REDIRECT_BASE') || '';
  const signing_url = `${base}/firmar.html?token=${result.access_token}`;

  // Best-effort invite email from the tenant's own account (zero-knowledge).
  let email_sent = false;
  try {
    const conn = await get_tenant_connection(admin, tenant_id);
    if (conn && conn.sender_email) {
      const tenant_name = await tenant_display_name(admin, tenant_id);
      const tpl = invite_email(signing_url, tenant_name, context);
      await conn.provider.send_email(conn.access_token, conn.sender_email, recipient, tpl.subject, tpl.html, tpl.text);
      email_sent = true;
    }
  } catch (e) {
    console.error({ fn: 'create_session_record.invite', error: (e as Error).message });
  }

  await admin.from('audit_log').insert({
    tenant_id, event_type: audit_event, event_data: { ...audit_data, email_sent },
  });

  return ok({ session_id: result.id, access_token: result.access_token, signing_url, expires_at, email_sent });
}
