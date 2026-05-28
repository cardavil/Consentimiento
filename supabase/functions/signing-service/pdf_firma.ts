// Builds the signed-document PDF: the original document with the signer's field
// values drawn ("flattened") onto the pages, plus an evidence page.
import { PDFDocument, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { DARK, GREY, Writer } from '../_shared/pdf_evidence.ts';

export interface SignField {
  key: string;
  type: 'firma' | 'fecha' | 'iniciales' | 'checkbox' | 'texto';
  label: string;
  required: boolean;
  page: number; // 0-based
  x: number; y: number; w: number; h: number; // normalized 0–1 (origin top-left)
  value?: string; // text, or PNG dataURL for 'firma', or 'true'/'' for checkbox
}

export interface FirmaInput {
  source: { name: string; bytes: Uint8Array };
  mode: string;
  signer: Record<string, unknown>;
  fields: SignField[];
  evidence: { ip: string; user_agent: string; timestamp: string };
  folio: string;
  global_hash: string;
}

function dataurl_to_bytes(dataurl: string): Uint8Array {
  const b64 = dataurl.includes(',') ? dataurl.split(',')[1] : dataurl;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function generate_firma_pdf(input: FirmaInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.source.bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const f of input.fields) {
    if (f.value === undefined || f.value === null || f.value === '') continue;
    const page = pages[f.page];
    if (!page) continue;
    const pw = page.getWidth();
    const ph = page.getHeight();
    const x = f.x * pw;
    const w = f.w * pw;
    const h = f.h * ph;
    const y = ph - (f.y * ph) - h; // convert top-left normalized to pdf bottom-left

    if (f.type === 'firma') {
      try {
        const png = await doc.embedPng(dataurl_to_bytes(f.value));
        page.drawImage(png, { x, y, width: w, height: h });
      } catch {
        page.drawText('[firma]', { x, y: y + 2, size: 10, font, color: DARK });
      }
    } else if (f.type === 'checkbox') {
      if (f.value === 'true' || f.value === '1') {
        page.drawText('X', { x, y: y + 2, size: Math.min(h, 14), font: bold, color: DARK });
      }
    } else {
      const size = Math.min(Math.max(h * 0.7, 8), 14);
      page.drawText(String(f.value).slice(0, 120), { x, y: y + (h - size) / 2, size, font, color: DARK });
    }
  }

  // Evidence page(s).
  const w = new Writer(doc, font, bold);
  w.title('EVIDENCIA DE FIRMA ELECTRÓNICA');
  w.gap(4);
  w.heading('Documento');
  w.line(input.source.name, bold);
  w.gap(6);
  w.heading('Firmante');
  for (const line of signer_lines(input.mode, input.signer)) w.line(line);
  w.gap(6);
  w.heading('Campos diligenciados');
  for (const f of input.fields) {
    const shown = f.type === 'firma' ? '(firma manuscrita)' : (f.value || '—');
    w.line(`${f.label || f.key} [${f.type}]: ${shown}`);
  }
  w.gap(6);
  w.heading('Evidencia');
  w.line('Folio: ' + input.folio);
  w.line('Fecha y hora: ' + input.evidence.timestamp);
  w.line('IP: ' + (input.evidence.ip || '—'));
  w.wrapped('User agent: ' + (input.evidence.user_agent || '—'), GREY);
  w.gap(6);
  w.heading('Hash global');
  w.mono(input.global_hash);

  return await doc.save();
}

function signer_lines(mode: string, s: Record<string, unknown>): string[] {
  const g = (k: string) => String(s[k] ?? '');
  if (mode === 'natural_tutor') {
    const r = (s.represented as Record<string, unknown>) || {};
    return [
      `Firmado por ${g('nombre')} ${g('apellido')}, en calidad de ${g('calidad')} de ${r.nombre ?? ''} ${r.apellido ?? ''}.`,
      `Representante: ${g('tipoDoc')} ${g('numero')} · ${g('email')}`,
    ];
  }
  if (mode === 'juridica') {
    return [
      `${g('empresa')} · NIT ${g('nit')}`,
      `Firmante: ${g('nombre')} ${g('apellido')} (${g('cargo')}) · ${g('tipoDoc')} ${g('numero')}`,
    ];
  }
  return [`${g('nombre')} ${g('apellido')}`, `${g('tipoDoc')} ${g('numero')} · ${g('email')}`];
}
