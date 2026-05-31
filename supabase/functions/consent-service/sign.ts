import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { validate_otp, hash_code } from '../_shared/otp.ts';
import { sha256_bytes } from '../_shared/hash.ts';
import { tenant_display_name } from '../_shared/tenant.ts';
import { get_tenant_connection } from '../drive-service/connection.ts';
import { generate_constancia, type ConsentResult } from './pdf.ts';
import { copy_email } from '../_shared/email_templates.ts';
import { MAX_PDF_BYTES, MAX_TOTAL_PDF_BYTES } from '../_shared/limits.ts';
import { history_row } from '../_shared/history.ts';

// Completes a consent session: verify OTP → folios/hashes → constancia PDF
// (documents + evidence) → upload to Drive → history sheet → copy email → zero-knowledge cleanup.
export async function handle_sign(body: Record<string, unknown>, req: Request): Promise<Response> {
  const access_token = req.headers.get('x-access-token');
  if (!access_token) return err('TOKEN_REQUERIDO', 401);

  const otp_code = String(body.otp_code || '');
  const marked = (body.consents as Array<{ id: string; accepted: boolean }>) || [];
  const ip = (body.ip as string) || '';
  const user_agent = (body.user_agent as string) || '';
  const admin = create_admin_client();

  const { data: session } = await admin
    .from('signing_sessions_results')
    .select('id, tenant_id, status, signer_type, token_expires_at')
    .eq('access_token', access_token)
    .maybeSingle();
  if (!session) return err('SESION_INVALIDA', 404);
  if (session.status === 'completed') return err('SESION_COMPLETADA', 409);
  if (session.status === 'expired' || session.status === 'cancelled') return err('SESION_EXPIRADA', 410);
  if (new Date(session.token_expires_at) < new Date()) return err('SESION_EXPIRADA', 410);

  const { data: temp } = await admin
    .from('signing_sessions_temp')
    .select('signer, documents, consents, context')
    .eq('session_id', session.id)
    .maybeSingle();
  if (!temp) return err('DATOS_NO_DISPONIBLES', 410);

  const signer = (temp.signer || {}) as Record<string, unknown>;
  const signer_email = String(signer.email || '').toLowerCase();
  if (!signer_email) return err('SIGNER_SIN_EMAIL');

  const otp = await validate_otp(admin, signer_email, otp_code, 'sign');
  if (!otp.valid) return err(otp.error_code || 'OTP_INVALID');

  const accepted_by_id: Record<string, boolean> = {};
  for (const m of marked) accepted_by_id[m.id] = !!m.accepted;

  const temp_consents = (temp.consents as Array<Record<string, unknown>>) || [];
  for (const c of temp_consents) {
    if (c.required && !accepted_by_id[c.id as string]) return err('OBLIGATORIOS_FALTANTES');
  }

  const conn = await get_tenant_connection(admin, session.tenant_id);
  if (!conn || !conn.drive_folder_id) return err('SIN_NUBE_CONECTADA');

  const timestamp = new Date().toISOString();
  const year = new Date().getUTCFullYear();

  // Folios + hashes per consent.
  const consent_results: ConsentResult[] = [];
  const consent_hashes: Record<string, unknown> = {};
  const summary: Array<{ code: string; decision: string; folio: string; hash: string }> = [];
  for (const c of temp_consents) {
    const code = c.code as string;
    const accepted = !!accepted_by_id[c.id as string];
    const decision = accepted ? 'Aceptado' : 'Rechazado';
    const { data: folio, error: folio_err } = await admin.rpc('next_folio', {
      p_tenant_id: session.tenant_id, p_code: code, p_year: year,
    });
    if (folio_err || !folio) {
      console.error({ fn: 'sign.folio', error: folio_err?.message });
      return err('ERROR_SERVIDOR', 500);
    }
    const hash = await hash_code(`${signer_email}|${code}|${decision}|${timestamp}|${ip}`);
    consent_results.push({
      code, title: c.title as string, description: c.description as string,
      accepted, required: !!c.required, folio: folio as string, hash,
    });
    consent_hashes[code] = { accepted, folio, hash };
    summary.push({ code, decision, folio: folio as string, hash });
  }

  // Download the documents being signed (to embed their real pages).
  const source_pdfs: Array<{ name: string; bytes: Uint8Array; hash: string }> = [];
  const documents = (temp.documents as Array<unknown>) || [];
  let total_bytes = 0;
  for (const d of documents) {
    const id = typeof d === 'string' ? d : (d as Record<string, string>).id;
    const name = typeof d === 'object' && (d as Record<string, string>).name ? (d as Record<string, string>).name : id;
    try {
      const bytes = await conn.provider.download_file(conn.access_token, id);
      if (bytes.length > MAX_PDF_BYTES) return err('ARCHIVO_MUY_GRANDE', 413);
      total_bytes += bytes.length;
      if (total_bytes > MAX_TOTAL_PDF_BYTES) return err('DOCUMENTOS_MUY_GRANDES', 413);
      source_pdfs.push({ name, bytes, hash: await sha256_bytes(bytes) });
    } catch (e) {
      console.error({ fn: 'sign.download', error: (e as Error).message });
    }
  }

  const global_hash = await hash_code(
    consent_results.map((c) => c.hash).join('|') + '|' + source_pdfs.map((d) => d.hash).join('|'),
  );

  const pdf_bytes = await generate_constancia({
    source_pdfs, signer, signer_type: session.signer_type, consents: consent_results,
    evidence: { ip, user_agent, timestamp }, global_hash,
  });
  const pdf_hash = await sha256_bytes(pdf_bytes);

  const primary_folio = consent_results[0]?.folio || 'CONSTANCIA';
  const filename = `Constancia_${primary_folio}.pdf`;

  let pdf_url = '';
  try {
    const up = await conn.provider.upload_pdf(conn.access_token, conn.drive_folder_id, filename, pdf_bytes);
    pdf_url = up.url;
  } catch (e) {
    console.error({ fn: 'sign.upload', error: (e as Error).message });
    return err('SUBIDA_FALLIDA', 502);
  }

  // History sheet + copy email are best-effort (the record + PDF in Drive are the source of truth).
  try {
    if (conn.history_sheet_id) {
      await conn.provider.append_sheet_row(conn.access_token, conn.history_sheet_id, history_row({
        timestamp,
        session_type: 'consent',
        documents: source_pdfs.map((d) => d.name).join('; '),
        signer_type: session.signer_type,
        signer,
        detail: summary.map((s) => `${s.code}:${s.decision}`).join('; '),
        folio: consent_results.map((c) => c.folio).join(' '),
        pdf_hash,
      }));
    }
  } catch (e) {
    console.error({ fn: 'sign.sheet', error: (e as Error).message });
  }

  try {
    const tenant_name = await tenant_display_name(admin, session.tenant_id);
    const tpl = copy_email(tenant_name, consent_results.map((c) => c.folio));
    await conn.provider.send_email(
      conn.access_token, conn.sender_email!, signer_email, tpl.subject, tpl.html, tpl.text,
      { filename, bytes: pdf_bytes, mime: 'application/pdf' },
    );
  } catch (e) {
    console.error({ fn: 'sign.copy', error: (e as Error).message });
  }

  await admin.from('signing_sessions_results').update({
    status: 'completed', completed_at: timestamp, folio: primary_folio, pdf_hash, consent_hashes,
  }).eq('id', session.id);

  // Zero-knowledge: drop the signer's personal data once the record is sealed.
  await admin.from('signing_sessions_temp').delete().eq('session_id', session.id);

  await admin.from('audit_log').insert({
    tenant_id: session.tenant_id,
    event_type: 'consent_signed',
    event_data: { folios: consent_results.length, documents: source_pdfs.length },
  });

  return ok({ summary, pdf_url });
}
