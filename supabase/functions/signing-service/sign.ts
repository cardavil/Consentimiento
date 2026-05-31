import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { validate_otp, hash_code } from '../_shared/otp.ts';
import { sha256_bytes } from '../_shared/hash.ts';
import { tenant_display_name } from '../_shared/tenant.ts';
import { get_tenant_connection } from '../drive-service/connection.ts';
import { generate_firma_pdf, type SignField } from './pdf_firma.ts';
import { copy_email } from '../_shared/email_templates.ts';
import { MAX_PDF_BYTES } from '../_shared/limits.ts';

// Completes a firma session: verify OTP → apply field values to the original PDF
// → evidence → upload to Drive → history sheet → copy email → zero-knowledge cleanup.
export async function handle_sign(body: Record<string, unknown>, req: Request): Promise<Response> {
  const access_token = req.headers.get('x-access-token');
  if (!access_token) return err('TOKEN_REQUERIDO', 401);

  const otp_code = String(body.otp_code || '');
  const submitted = (body.fields as Array<{ key: string; value: string }>) || [];
  const ip = (body.ip as string) || '';
  const user_agent = (body.user_agent as string) || '';
  const admin = create_admin_client();

  const { data: session } = await admin
    .from('signing_sessions_results')
    .select('id, tenant_id, status, mode, session_type, token_expires_at')
    .eq('access_token', access_token)
    .maybeSingle();
  if (!session) return err('SESION_INVALIDA', 404);
  if (session.session_type !== 'firma') return err('SESION_INVALIDA', 409);
  if (session.status === 'completed') return err('SESION_COMPLETADA', 409);
  if (session.status === 'expired' || session.status === 'cancelled') return err('SESION_EXPIRADA', 410);
  if (new Date(session.token_expires_at) < new Date()) return err('SESION_EXPIRADA', 410);

  const { data: temp } = await admin
    .from('signing_sessions_temp')
    .select('signer, documents, fields')
    .eq('session_id', session.id)
    .maybeSingle();
  if (!temp) return err('DATOS_NO_DISPONIBLES', 410);

  const signer = (temp.signer || {}) as Record<string, unknown>;
  const signer_email = String(signer.email || '').toLowerCase();
  if (!signer_email) return err('SIGNER_SIN_EMAIL');

  const otp = await validate_otp(admin, signer_email, otp_code, 'sign');
  if (!otp.valid) return err(otp.error_code || 'OTP_INVALID');

  // Merge submitted values into the field definitions.
  const values: Record<string, string> = {};
  for (const s of submitted) values[s.key] = s.value;
  const defs = (temp.fields as SignField[]) || [];
  const fields: SignField[] = defs.map((d) => ({ ...d, value: values[d.key] ?? '' }));
  for (const f of fields) {
    if (f.required && (f.value === undefined || f.value === '')) return err('CAMPOS_OBLIGATORIOS_FALTANTES');
  }

  const conn = await get_tenant_connection(admin, session.tenant_id);
  if (!conn || !conn.drive_folder_id) return err('SIN_NUBE_CONECTADA');

  const timestamp = new Date().toISOString();
  const year = new Date().getUTCFullYear();

  const { data: folio, error: folio_err } = await admin.rpc('next_folio', {
    p_tenant_id: session.tenant_id, p_code: 'FIRMA', p_year: year,
  });
  if (folio_err || !folio) {
    console.error({ fn: 'firma.sign.folio', error: folio_err?.message });
    return err('ERROR_SERVIDOR', 500);
  }

  const doc = (temp.documents as Array<unknown>)[0];
  const doc_id = typeof doc === 'string' ? doc : (doc as Record<string, string>).id;
  const doc_name = typeof doc === 'object' && (doc as Record<string, string>).name ? (doc as Record<string, string>).name : doc_id;

  let source_bytes: Uint8Array;
  try {
    source_bytes = await conn.provider.download_file(conn.access_token, doc_id);
  } catch (e) {
    console.error({ fn: 'firma.sign.download', error: (e as Error).message });
    return err('NUBE_ERROR', 502);
  }
  if (source_bytes.length > MAX_PDF_BYTES) return err('ARCHIVO_MUY_GRANDE', 413);

  const values_fingerprint = fields.map((f) => `${f.key}:${f.type === 'firma' ? 'sig' : f.value}`).join('|');
  const global_hash = await hash_code(`${signer_email}|${folio}|${timestamp}|${ip}|${values_fingerprint}`);

  const pdf_bytes = await generate_firma_pdf({
    source: { name: doc_name, bytes: source_bytes },
    mode: session.mode, signer, fields,
    evidence: { ip, user_agent, timestamp }, folio: folio as string, global_hash,
  });
  const pdf_hash = await sha256_bytes(pdf_bytes);

  const filename = `Firmado_${folio}.pdf`;
  let pdf_url = '';
  try {
    const up = await conn.provider.upload_pdf(conn.access_token, conn.drive_folder_id, filename, pdf_bytes);
    pdf_url = up.url;
  } catch (e) {
    console.error({ fn: 'firma.sign.upload', error: (e as Error).message });
    return err('SUBIDA_FALLIDA', 502);
  }

  try {
    if (conn.history_sheet_id) {
      await conn.provider.append_sheet_row(conn.access_token, conn.history_sheet_id, [
        timestamp, folio as string, doc_name, 'Firma electrónica', pdf_hash,
      ]);
    }
  } catch (e) {
    console.error({ fn: 'firma.sign.sheet', error: (e as Error).message });
  }

  try {
    const tenant_name = await tenant_display_name(admin, session.tenant_id);
    const tpl = copy_email(tenant_name, [folio as string]);
    await conn.provider.send_email(
      conn.access_token, conn.sender_email!, signer_email, tpl.subject, tpl.html, tpl.text,
      { filename, bytes: pdf_bytes, mime: 'application/pdf' },
    );
  } catch (e) {
    console.error({ fn: 'firma.sign.copy', error: (e as Error).message });
  }

  await admin.from('signing_sessions_results').update({
    status: 'completed', completed_at: timestamp, folio, pdf_hash,
    consent_hashes: { document: { folio, hash: global_hash } },
  }).eq('id', session.id);

  await admin.from('signing_sessions_temp').delete().eq('session_id', session.id);

  await admin.from('audit_log').insert({
    tenant_id: session.tenant_id,
    event_type: 'document_signed',
    event_data: { folio, fields: fields.length },
  });

  return ok({ summary: [{ code: 'FIRMA', decision: 'Firmado', folio, hash: global_hash }], pdf_url });
}
