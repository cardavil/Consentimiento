// Consentia-branded HTML email templates (inline styles for email-client compatibility).
// Palette: --verde-profundo #0F4C5C, --teal #17B3A3, --gris-azulado #1E2A3A, --fondo #F5F8FC.

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shell(inner: string): string {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background-color:#F5F8FC;font-family:Helvetica,Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F8FC;">' +
    '<tr><td align="center" style="padding:40px 20px;">' +
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(30,42,58,0.08);">' +
    '<tr><td style="background-color:#0F4C5C;padding:24px 32px;text-align:center;">' +
    '<span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Consen<span style="color:#17B3A3;">tia</span></span>' +
    '</td></tr>' +
    '<tr><td style="padding:32px;color:#1E2A3A;font-size:15px;line-height:1.5;">' + inner + '</td></tr>' +
    '<tr><td style="padding:16px 32px;border-top:1px solid #DCE5EE;text-align:center;">' +
    '<span style="color:#5F7D95;font-size:12px;">Consentimiento informado y firma electrónica</span>' +
    '</td></tr></table></td></tr></table></body></html>';
}

export function otp_email(code: string, context_line: string): { subject: string; html: string; text: string } {
  const html = shell(
    '<p style="margin:0 0 8px;">' + esc(context_line) + '</p>' +
    '<p style="margin:0 0 24px;">Usa este código para verificar tu identidad:</p>' +
    '<table role="presentation" width="100%"><tr><td align="center" style="padding:16px;background-color:#E6F7F5;border:2px solid #17B3A3;border-radius:8px;">' +
    '<span style="font-family:monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#0F4C5C;">' + esc(code) + '</span>' +
    '</td></tr></table>' +
    '<p style="margin:24px 0 0;color:#5F7D95;font-size:13px;text-align:center;">Válido por 5 minutos. No lo compartas con nadie.</p>',
  );
  const text = `${context_line}\n\nTu código de verificación es: ${code}\n\nVálido por 5 minutos. No lo compartas con nadie.\n\n— Consentia`;
  return { subject: 'Tu código de verificación · Consentia', html, text };
}

export function invite_email(signing_url: string, org_name: string, context: string): { subject: string; html: string; text: string } {
  const ctx = context ? `<p style="margin:0 0 16px;color:#5F7D95;">${esc(context)}</p>` : '';
  const html = shell(
    '<p style="margin:0 0 16px;"><strong>' + esc(org_name) + '</strong> te ha enviado un documento para revisar y otorgar tu consentimiento.</p>' +
    ctx +
    '<table role="presentation" width="100%"><tr><td align="center" style="padding:8px 0 16px;">' +
    '<a href="' + esc(signing_url) + '" style="display:inline-block;background-color:#17B3A3;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Abrir documento</a>' +
    '</td></tr></table>' +
    '<p style="margin:8px 0 0;color:#5F7D95;font-size:13px;">Si el botón no funciona, copia este enlace:<br>' + esc(signing_url) + '</p>',
  );
  const text = `${org_name} te ha enviado un documento para otorgar tu consentimiento.\n\nAbre el enlace: ${signing_url}\n\n— Consentia`;
  return { subject: 'Documento para tu consentimiento · Consentia', html, text };
}

export function copy_email(org_name: string, folios: string[]): { subject: string; html: string; text: string } {
  const html = shell(
    '<p style="margin:0 0 16px;">Adjuntamos la constancia del consentimiento que otorgaste con <strong>' + esc(org_name) + '</strong>.</p>' +
    '<p style="margin:0 0 8px;">Folios:</p>' +
    '<p style="margin:0;font-family:monospace;color:#0F4C5C;">' + esc(folios.join(', ')) + '</p>' +
    '<p style="margin:24px 0 0;color:#5F7D95;font-size:13px;">Conserva este documento como evidencia.</p>',
  );
  const text = `Adjuntamos la constancia del consentimiento que otorgaste con ${org_name}.\n\nFolios: ${folios.join(', ')}\n\n— Consentia`;
  return { subject: 'Constancia de consentimiento · Consentia', html, text };
}
