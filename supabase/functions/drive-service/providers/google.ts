// Google Workspace provider: Drive v3 + Sheets v4 + Gmail, all via REST (Deno-friendly).
import type { CloudFile, CloudProvider, EmailAttachment, OAuthTokens, UploadResult } from './types.ts';
import { build_mime, to_base64url } from './mime.ts';

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.readonly', // list + download the documents to sign
  'https://www.googleapis.com/auth/drive.file', // create our own folder / PDFs / sheets
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

function client_id(): string {
  return Deno.env.get('GOOGLE_CLIENT_ID')!;
}
function client_secret(): string {
  return Deno.env.get('GOOGLE_CLIENT_SECRET')!;
}

async function api<T>(url: string, access_token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${access_token}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`google_api ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.status === 204 ? (undefined as T) : await res.json() as T;
}

export const google: CloudProvider = {
  name: 'google_workspace',

  auth_url(redirect_uri, state) {
    const p = new URLSearchParams({
      client_id: client_id(),
      redirect_uri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  },

  async exchange_code(code, redirect_uri) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: client_id(),
        client_secret: client_secret(),
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`google_token ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return await res.json() as OAuthTokens;
  },

  async refresh(refresh_token) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token,
        client_id: client_id(),
        client_secret: client_secret(),
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`google_refresh ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return await res.json() as OAuthTokens;
  },

  async account_email(access_token) {
    const info = await api<{ email: string }>(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      access_token,
    );
    return info.email;
  },

  async ensure_folder(access_token, name) {
    const q = encodeURIComponent(
      `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const found = await api<{ files: CloudFile[] }>(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      access_token,
    );
    if (found.files?.length) return found.files[0].id;

    const created = await api<{ id: string }>(
      'https://www.googleapis.com/drive/v3/files?fields=id',
      access_token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
      },
    );
    return created.id;
  },

  async ensure_sheet(access_token, folder_id, title) {
    const sheet = await api<{ spreadsheetId: string }>(
      'https://sheets.googleapis.com/v4/spreadsheets',
      access_token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { title } }),
      },
    );
    // Move the new spreadsheet into the Consentia folder.
    await api(
      `https://www.googleapis.com/drive/v3/files/${sheet.spreadsheetId}?addParents=${folder_id}&fields=id`,
      access_token,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    return sheet.spreadsheetId;
  },

  async list_pdfs(access_token, folder_id) {
    const parent = folder_id ? `'${folder_id}' in parents and ` : '';
    const q = encodeURIComponent(`${parent}mimeType='application/pdf' and trashed=false`);
    const res = await api<{ files: CloudFile[] }>(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name`,
      access_token,
    );
    return res.files || [];
  },

  async download_file(access_token, file_id) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!res.ok) throw new Error(`google_download ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },

  async upload_pdf(access_token, folder_id, name, bytes) {
    const boundary = `consentia_${crypto.randomUUID()}`;
    const meta = JSON.stringify({ name, parents: [folder_id] });
    const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    const enc = new TextEncoder();
    const head_b = enc.encode(head);
    const tail_b = enc.encode(tail);
    const body = new Uint8Array(head_b.length + bytes.length + tail_b.length);
    body.set(head_b, 0);
    body.set(bytes, head_b.length);
    body.set(tail_b, head_b.length + bytes.length);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) throw new Error(`google_upload ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const { id } = await res.json() as { id: string };
    return { id, url: `https://drive.google.com/file/d/${id}/view` };
  },

  async append_sheet_row(access_token, sheet_id, row) {
    await api(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet_id}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      access_token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      },
    );
  },

  async send_email(access_token, from, to, subject, html, text, attachment?: EmailAttachment) {
    const mime = build_mime(from, to, subject, html, text, attachment);
    await api(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      access_token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: to_base64url(mime) }),
      },
    );
  },
};
