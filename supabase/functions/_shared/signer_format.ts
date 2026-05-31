// Human-readable signer lines for evidence PDFs, shared by consent (constancia) and
// signature (firma). verbose=true adds the represented's document and the signer's email
// (consent constancia); verbose=false is the compact form used in the firma evidence page.
export function signer_lines(signer_type: string, s: Record<string, unknown>, verbose = false): string[] {
  const g = (k: string) => String(s[k] ?? '');

  if (signer_type === 'natural_represented') {
    const r = (s.represented as Record<string, unknown>) || {};
    const rg = (k: string) => String(r[k] ?? '');
    const head = `Firmado por ${g('first_name')} ${g('last_name')}, en calidad de ${g('capacity')} de ${rg('first_name')} ${rg('last_name')}.`;
    const rep = `Representante: ${g('doc_type')} ${g('doc_number')} · ${g('email')}`;
    return verbose ? [head, rep, `Representado: ${rg('doc_type')} ${rg('doc_number')}`] : [head, rep];
  }

  if (signer_type === 'juridica') {
    const company = `${g('company_name')} · NIT ${g('company_nit')}`;
    return verbose
      ? [company, `Firmante: ${g('first_name')} ${g('last_name')} (${g('position')})`, `${g('doc_type')} ${g('doc_number')} · ${g('email')}`]
      : [company, `Firmante: ${g('first_name')} ${g('last_name')} (${g('position')}) · ${g('doc_type')} ${g('doc_number')}`];
  }

  // natural
  return verbose
    ? [`${g('first_name')} ${g('last_name')}`, `${g('doc_type')} ${g('doc_number')}`, `${g('email')} · ${g('phone')}`]
    : [`${g('first_name')} ${g('last_name')}`, `${g('doc_type')} ${g('doc_number')} · ${g('email')}`];
}
