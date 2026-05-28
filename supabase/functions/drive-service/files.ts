import { ok, err } from '../_shared/response.ts';
import { require_org } from '../_shared/auth.ts';
import { get_org_connection } from './connection.ts';
import { bytes_to_base64 } from './providers/mime.ts';

// Lists the PDF documents available in the org's connected Consentia folder.
export async function handle_list_files(_body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_org(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const conn = await get_org_connection(ctx.admin, ctx.org_id);
  if (!conn) return err('SIN_NUBE_CONECTADA');

  try {
    const files = await conn.provider.list_pdfs(conn.access_token, conn.drive_folder_id);
    return ok({ files });
  } catch (e) {
    console.error({ fn: 'list_files', error: (e as Error).message });
    return err('NUBE_ERROR', 502);
  }
}

// Downloads a PDF as base64 (for the template editor to render it with pdf.js).
export async function handle_download_b64(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_org(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);
  const file_id = body.file_id as string;
  if (!file_id) return err('FILE_ID_REQUERIDO');

  const conn = await get_org_connection(ctx.admin, ctx.org_id);
  if (!conn) return err('SIN_NUBE_CONECTADA');

  try {
    const bytes = await conn.provider.download_file(conn.access_token, file_id);
    return ok({ bytes_b64: bytes_to_base64(bytes) });
  } catch (e) {
    console.error({ fn: 'download_b64', error: (e as Error).message });
    return err('NUBE_ERROR', 502);
  }
}

// Reports whether the org has a cloud connection and its basic settings.
export async function handle_get_status(_body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_org(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const { data: row } = await ctx.admin
    .from('org_oauth')
    .select('provider, sender_email, drive_folder_id, history_sheet_id')
    .eq('organization_id', ctx.org_id)
    .maybeSingle();

  return ok({
    connected: !!row,
    provider: row?.provider ?? null,
    sender_email: row?.sender_email ?? null,
    folder_id: row?.drive_folder_id ?? null,
  });
}

// Removes the org's cloud connection (e.g., to reconnect a different account).
export async function handle_disconnect(_body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_org(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  await ctx.admin.from('org_oauth').delete().eq('organization_id', ctx.org_id);
  await ctx.admin.from('audit_log').insert({
    organization_id: ctx.org_id,
    event_type: 'org_oauth_disconnected',
    event_data: {},
  });
  return ok({});
}
