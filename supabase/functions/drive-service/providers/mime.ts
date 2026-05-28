// RFC 822 MIME builder for sending HTML email with an optional PDF attachment.
import type { EmailAttachment } from './types.ts';

export function bytes_to_base64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// base64url of a UTF-8 string (Gmail raw message format).
export function to_base64url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return bytes_to_base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function chunk_b64(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

export function build_mime(
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachment?: EmailAttachment,
): string {
  const encoded_subject = `=?UTF-8?B?${bytes_to_base64(new TextEncoder().encode(subject))}?=`;
  const alt = `consentia_alt_${crypto.randomUUID()}`;

  const alt_part =
    `Content-Type: multipart/alternative; boundary="${alt}"\r\n\r\n` +
    `--${alt}\r\nContent-Type: text/plain; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n${chunk_b64(bytes_to_base64(new TextEncoder().encode(text)))}\r\n` +
    `--${alt}\r\nContent-Type: text/html; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n${chunk_b64(bytes_to_base64(new TextEncoder().encode(html)))}\r\n` +
    `--${alt}--`;

  const headers =
    `From: ${from}\r\nTo: ${to}\r\nSubject: ${encoded_subject}\r\nMIME-Version: 1.0\r\n`;

  if (!attachment) {
    return headers + alt_part;
  }

  const mixed = `consentia_mixed_${crypto.randomUUID()}`;
  return headers +
    `Content-Type: multipart/mixed; boundary="${mixed}"\r\n\r\n` +
    `--${mixed}\r\n${alt_part}\r\n` +
    `--${mixed}\r\nContent-Type: ${attachment.mime}; name="${attachment.filename}"\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n` +
    `${chunk_b64(bytes_to_base64(attachment.bytes))}\r\n` +
    `--${mixed}--`;
}
