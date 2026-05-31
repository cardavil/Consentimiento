// Microsoft 365 provider via Microsoft Graph (OneDrive + Mail).
// History sheet is kept as a CSV file in OneDrive (download→append→upload) to avoid
// the complexity of generating/maintaining a valid .xlsx workbook server-side.
import type { CloudFile, CloudProvider, EmailAttachment, OAuthTokens, UploadResult } from './types.ts';
import { bytes_to_base64 } from './mime.ts';

const SCOPES = 'offline_access openid email https://graph.microsoft.com/Files.ReadWrite https://graph.microsoft.com/Mail.Send';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH = 'https://graph.microsoft.com/v1.0';

function client_id(): string {
  return Deno.env.get('MS_CLIENT_ID')!;
}
function client_secret(): string {
  return Deno.env.get('MS_CLIENT_SECRET')!;
}

async function api<T>(url: string, access_token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${access_token}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`ms_graph ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.status === 204 ? (undefined as T) : await res.json() as T;
}

function csv_cell(v: string): string {
  return `"${(v ?? '').replace(/"/g, '""')}"`;
}

export const microsoft: CloudProvider = {
  name: 'microsoft_365',

  auth_url(redirect_uri, state) {
    const p = new URLSearchParams({
      client_id: client_id(),
      response_type: 'code',
      redirect_uri,
      response_mode: 'query',
      scope: SCOPES,
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${p}`;
  },

  async exchange_code(code, redirect_uri) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: client_id(),
        client_secret: client_secret(),
        redirect_uri,
        grant_type: 'authorization_code',
        scope: SCOPES,
      }),
    });
    if (!res.ok) throw new Error(`ms_token ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return await res.json() as OAuthTokens;
  },

  async refresh(refresh_token) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token,
        client_id: client_id(),
        client_secret: client_secret(),
        grant_type: 'refresh_token',
        scope: SCOPES,
      }),
    });
    if (!res.ok) throw new Error(`ms_refresh ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return await res.json() as OAuthTokens;
  },

  async account_email(access_token) {
    const me = await api<{ mail?: string; userPrincipalName?: string }>(`${GRAPH}/me`, access_token);
    return me.mail || me.userPrincipalName || '';
  },

  async ensure_folder(access_token, name) {
    try {
      const existing = await api<{ id: string }>(
        `${GRAPH}/me/drive/root:/${encodeURIComponent(name)}`,
        access_token,
      );
      if (existing?.id) return existing.id;
    } catch {
      // not found — create below
    }
    const created = await api<{ id: string }>(`${GRAPH}/me/drive/root/children`, access_token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
    });
    return created.id;
  },

  async ensure_sheet(access_token, folder_id, title) {
    const header = 'Fecha,Folio,Documento,Consentimientos,Hash PDF\r\n';
    const created = await api<{ id: string }>(
      `${GRAPH}/me/drive/items/${folder_id}:/${encodeURIComponent(title)}.csv:/content`,
      access_token,
      { method: 'PUT', headers: { 'Content-Type': 'text/csv' }, body: header },
    );
    return created.id;
  },

  async list_pdfs(access_token, folder_id) {
    const path = folder_id ? `items/${folder_id}/children` : 'root/children';
    const res = await api<{ value: Array<{ id: string; name: string; file?: { mimeType: string } }> }>(
      `${GRAPH}/me/drive/${path}?$select=id,name,file&$top=200`,
      access_token,
    );
    return (res.value || [])
      .filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.file?.mimeType === 'application/pdf')
      .map((f): CloudFile => ({ id: f.id, name: f.name }));
  },

  async download_file(access_token, file_id) {
    const res = await fetch(`${GRAPH}/me/drive/items/${file_id}/content`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) throw new Error(`ms_download ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },

  async upload_pdf(access_token, folder_id, name, bytes) {
    const item = await api<{ id: string; webUrl: string }>(
      `${GRAPH}/me/drive/items/${folder_id}:/${encodeURIComponent(name)}:/content`,
      access_token,
      { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: bytes },
    );
    return { id: item.id, url: item.webUrl };
  },

  // Append with optimistic concurrency (If-Match on the file ETag) + retry, so two
  // simultaneous signings cannot lose each other's row. O(n) per append (download+upload
  // the whole CSV) — acceptable at MVP volume; revisit with the Excel workbook API at scale.
  async append_sheet_row(access_token, sheet_id, row) {
    const line = row.map(csv_cell).join(',') + '\r\n';
    const MAX_SHEET_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_SHEET_RETRIES; attempt++) {
      const current = await fetch(`${GRAPH}/me/drive/items/${sheet_id}/content`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const prev = current.ok ? await current.text() : '';
      const etag = current.headers.get('etag');

      const headers: Record<string, string> = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'text/csv' };
      if (etag) headers['if-match'] = etag;

      const put = await fetch(`${GRAPH}/me/drive/items/${sheet_id}/content`, { method: 'PUT', headers, body: prev + line });
      if (put.ok) return;
      if (put.status !== 412) throw new Error(`ms_sheet_append ${put.status}`); // 412 = changed, retry
    }
    throw new Error('ms_sheet_append_conflict');
  },

  async send_email(_access_token, _from, to, subject, html, _text, attachment?: EmailAttachment) {
    const message: Record<string, unknown> = {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: to } }],
    };
    if (attachment) {
      message.attachments = [{
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.filename,
        contentType: attachment.mime,
        contentBytes: bytes_to_base64(attachment.bytes),
      }];
    }
    await api(`${GRAPH}/me/sendMail`, _access_token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
  },
};
