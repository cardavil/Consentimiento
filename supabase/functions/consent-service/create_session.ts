import { err } from '../_shared/response.ts';
import { require_tenant } from '../_shared/auth.ts';
import { MAX_DOCS_PER_SESSION, DEFAULT_SESSION_EXPIRES_HOURS } from '../_shared/limits.ts';
import { create_session_record } from '../_shared/session.ts';

const VALID_SIGNER_TYPES = ['natural', 'natural_represented', 'juridica'];

// Creates a consent session (results + temp) and emails the signing link. Common
// persistence/invite/audit lives in _shared/session.ts.
export async function handle_create_session(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const signer_type = body.signer_type as string;
  const signer = body.signer as Record<string, unknown> | undefined;
  const documents = (body.documents as unknown[]) || [];
  const consents = (body.consents as unknown[]) || [];
  const context = (body.context as string) || '';
  const expires_in_hours = Number(body.expires_in_hours) || DEFAULT_SESSION_EXPIRES_HOURS;

  if (!VALID_SIGNER_TYPES.includes(signer_type)) return err('SIGNER_TYPE_INVALID');
  if (!signer || typeof signer !== 'object') return err('SIGNER_REQUERIDO');
  const recipient = String((signer as Record<string, unknown>).email || '').trim().toLowerCase();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return err('EMAIL_INVALID');
  if (!documents.length) return err('DOCUMENTOS_REQUERIDOS');
  if (documents.length > MAX_DOCS_PER_SESSION) return err('DEMASIADOS_DOCUMENTOS');
  if (!consents.length) return err('CONSENTIMIENTOS_REQUERIDOS');

  return create_session_record({
    admin: ctx.admin,
    tenant_id: ctx.tenant_id,
    signer_type,
    session_type: 'consent',
    recipient,
    context,
    expires_in_hours,
    temp: { documents, consents, signer, context },
    audit_event: 'session_created',
    audit_data: { signer_type, documents: documents.length, consents: consents.length },
  });
}
