// Builds the self-contained constancia PDF with pdf-lib:
// real pages of each signed document + accepted consent texts + evidence pages.
import { PDFDocument, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { GREY, Writer } from '../_shared/pdf_evidence.ts';

export interface ConsentResult {
  code: string;
  title: string;
  description: string;
  accepted: boolean;
  required: boolean;
  folio: string;
  hash: string;
}

export interface ConstanciaInput {
  source_pdfs: Array<{ name: string; bytes: Uint8Array; hash: string }>;
  signer: Record<string, unknown>;
  mode: string;
  consents: ConsentResult[];
  evidence: { ip: string; user_agent: string; timestamp: string };
  global_hash: string;
}

export async function generate_constancia(input: ConstanciaInput): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  // 1) Embed the real pages of each signed document.
  for (const doc of input.source_pdfs) {
    try {
      const src = await PDFDocument.load(doc.bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      for (const p of pages) out.addPage(p);
    } catch (_e) {
      // Unreadable PDF — skip its pages; its hash is still recorded in the evidence page.
    }
  }

  // 2) Evidence + consents pages.
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(out, font, bold);

  w.title('CONSTANCIA DE CONSENTIMIENTO INFORMADO');
  w.gap(6);

  w.heading('Firmante');
  for (const line of signer_lines(input.mode, input.signer)) w.line(line);
  w.gap(8);

  w.heading('Documentos firmados');
  for (const d of input.source_pdfs) {
    w.line(d.name, bold);
    w.mono('SHA-256: ' + d.hash);
  }
  w.gap(8);

  w.heading('Consentimientos');
  for (const c of input.consents) {
    w.line(`${c.code} — ${c.title}`, bold);
    w.line(`${c.accepted ? 'ACEPTADO' : 'RECHAZADO'} · ${c.required ? 'Obligatorio' : 'Voluntario'} · Folio ${c.folio}`);
    w.wrapped(c.description, GREY);
    w.mono('hash: ' + c.hash);
    w.gap(4);
  }
  w.gap(8);

  w.heading('Evidencia');
  w.line('Fecha y hora: ' + input.evidence.timestamp);
  w.line('IP: ' + (input.evidence.ip || '—'));
  w.wrapped('User agent: ' + (input.evidence.user_agent || '—'), GREY);
  w.gap(8);

  w.heading('Hash global');
  w.mono(input.global_hash);

  return await out.save();
}

function signer_lines(mode: string, s: Record<string, unknown>): string[] {
  const g = (k: string) => String(s[k] ?? '');
  if (mode === 'natural_tutor') {
    const rep = `${g('nombre')} ${g('apellido')}`.trim();
    const r = (s.represented as Record<string, unknown>) || {};
    const repd = `${r.nombre ?? ''} ${r.apellido ?? ''}`.toString().trim();
    return [
      `Firmado por ${rep}, en calidad de ${g('calidad')} de ${repd}.`,
      `Representante: ${g('tipoDoc')} ${g('numero')} · ${g('email')}`,
      `Representado: ${r.tipoDoc ?? ''} ${r.numero ?? ''}`,
    ];
  }
  if (mode === 'juridica') {
    return [
      `${g('empresa')} · NIT ${g('nit')}`,
      `Firmante: ${g('nombre')} ${g('apellido')} (${g('cargo')})`,
      `${g('tipoDoc')} ${g('numero')} · ${g('email')}`,
    ];
  }
  return [
    `${g('nombre')} ${g('apellido')}`,
    `${g('tipoDoc')} ${g('numero')}`,
    `${g('email')} · ${g('telefono')}`,
  ];
}
