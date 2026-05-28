import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { get_org_connection } from '../drive-service/connection.ts';
import { bytes_to_base64 } from '../drive-service/providers/mime.ts';
import { MAX_PDF_BYTES } from '../_shared/limits.ts';

// Returns the firma session's source PDF as base64 to the signer (token-scoped),
// so firmar.html can render it with pdf.js and overlay the fields.
export async function handle_get_document(_body: Record<string, unknown>, req: Request): Promise<Response> {
  const access_token = req.headers.get('x-access-token');
  if (!access_token) return err('TOKEN_REQUERIDO', 401);

  const admin = create_admin_client();
  const { data: session } = await admin
    .from('signing_sessions_results')
    .select('id, organization_id, status, token_expires_at')
    .eq('access_token', access_token)
    .maybeSingle();
  if (!session) return err('SESION_INVALIDA', 404);
  if (session.status === 'completed') return err('SESION_COMPLETADA', 409);
  if (new Date(session.token_expires_at) < new Date()) return err('SESION_EXPIRADA', 410);

  const { data: temp } = await admin
    .from('signing_sessions_temp')
    .select('documents')
    .eq('session_id', session.id)
    .maybeSingle();
  const documents = (temp?.documents as Array<unknown>) || [];
  if (!documents.length) return err('DATOS_NO_DISPONIBLES', 410);

  const doc = documents[0];
  const doc_id = typeof doc === 'string' ? doc : (doc as Record<string, string>).id;

  const conn = await get_org_connection(admin, session.organization_id);
  if (!conn) return err('SIN_NUBE_CONECTADA');

  try {
    const bytes = await conn.provider.download_file(conn.access_token, doc_id);
    if (bytes.length > MAX_PDF_BYTES) return err('ARCHIVO_MUY_GRANDE', 413);
    return ok({ bytes_b64: bytes_to_base64(bytes) });
  } catch (e) {
    console.error({ fn: 'get_document', error: (e as Error).message });
    return err('NUBE_ERROR', 502);
  }
}
