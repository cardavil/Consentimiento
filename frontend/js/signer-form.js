// Shared logic for the 3-type signer form (natural / natural_represented / juridica).
// The markup lives in each page (identical fieldsets); this module fills the doc-type
// selects, toggles the type, and builds the signer object. Call setup_signer_form()
// AFTER load_doc_types(); read the result with build_signer() / get_signer_type().

function setup_signer_form() {
  _fill_signer_select('np-tipodoc', 'natural');
  _fill_signer_select('tr-tipodoc', 'natural_represented');
  _fill_signer_select('rp-tipodoc', 'natural_representative');
  _fill_signer_select('ju-tipodoc', 'juridica_signer');
  document.getElementById('modo').addEventListener('change', _on_signer_type_change);
  _on_signer_type_change();
}

function _fill_signer_select(id, context) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = get_doc_types_for(context)
    .map((t) => '<option value="' + escape_html(t.code) + '">' + escape_html(t.label) + '</option>').join('');
}

function _on_signer_type_change() {
  const signer_type = get_signer_type();
  document.getElementById('campos-natural').hidden = signer_type !== 'natural';
  document.getElementById('campos-tutor').hidden = signer_type !== 'natural_represented';
  document.getElementById('campos-juridica').hidden = signer_type !== 'juridica';
}

function get_signer_type() {
  return document.getElementById('modo').value;
}

function build_signer() {
  const v = (id) => { const el = document.getElementById(id); return ((el && el.value) || '').trim(); };
  const signer_type = get_signer_type();
  if (signer_type === 'natural') {
    return { first_name: v('np-nombre'), last_name: v('np-apellido'), doc_type: v('np-tipodoc'), doc_number: v('np-numero'), email: v('np-email').toLowerCase(), phone: v('np-telefono') };
  }
  if (signer_type === 'juridica') {
    return { first_name: v('ju-nombre'), last_name: v('ju-apellido'), doc_type: v('ju-tipodoc'), doc_number: v('ju-numero'), email: v('ju-email').toLowerCase(), phone: v('ju-telefono'), company_name: v('ju-razon'), company_nit: v('ju-nit'), position: v('ju-cargo') };
  }
  return { first_name: v('rp-nombre'), last_name: v('rp-apellido'), doc_type: v('rp-tipodoc'), doc_number: v('rp-numero'), email: v('rp-email').toLowerCase(), phone: v('rp-telefono'), capacity: v('rp-calidad'),
    represented: { first_name: v('tr-nombre'), last_name: v('tr-apellido'), doc_type: v('tr-tipodoc'), doc_number: v('tr-numero'), birth_date: v('tr-nacimiento') } };
}
