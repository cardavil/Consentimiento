// Schema of the tenant's History sheet (lives in THEIR Drive). One column per field.
// The signer's personal data is recorded here (client-side) + in the PDF; never in
// Consentia's permanent DB (zero-knowledge). Header + builder kept together so both
// sign flows (consent + signature) write identical, aligned columns.

export const HISTORY_HEADER: string[] = [
  'Fecha', 'Folio', 'Operación', 'Documentos', 'Tipo de firmante',
  'Nombre', 'Apellido', 'Tipo doc.', 'N° doc.', 'Email', 'Teléfono',
  'Empresa', 'NIT', 'Cargo', 'Calidad',
  'Representado: Nombre', 'Representado: Apellido', 'Representado: Tipo doc.', 'Representado: N° doc.',
  'Detalle', 'Hash PDF',
];

const SIGNER_TYPE_LABEL: Record<string, string> = {
  natural: 'Natural',
  natural_represented: 'Representado',
  juridica: 'Jurídica',
};

const OPERATION_LABEL: Record<string, string> = {
  consent: 'Consentimiento',
  signature: 'Firma',
};

// Builds one history row aligned to HISTORY_HEADER. Columns that don't apply to the
// signer_type are left blank (e.g. natural has no Empresa/Representado).
export function history_row(input: {
  timestamp: string;
  session_type: string;
  documents: string;
  signer_type: string;
  signer: Record<string, unknown>;
  detail: string;
  folio: string;
  pdf_hash: string;
}): string[] {
  const s = input.signer || {};
  const g = (k: string) => String(s[k] ?? '');
  const r = (s.represented as Record<string, unknown>) || {};
  const rg = (k: string) => String(r[k] ?? '');
  return [
    input.timestamp,
    input.folio,
    OPERATION_LABEL[input.session_type] ?? input.session_type,
    input.documents,
    SIGNER_TYPE_LABEL[input.signer_type] ?? input.signer_type,
    g('first_name'), g('last_name'), g('doc_type'), g('doc_number'), g('email'), g('phone'),
    g('company_name'), g('company_nit'), g('position'), g('capacity'),
    rg('first_name'), rg('last_name'), rg('doc_type'), rg('doc_number'),
    input.detail,
    input.pdf_hash,
  ];
}
