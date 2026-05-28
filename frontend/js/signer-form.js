// Shared logic for the 3-mode signer form (natural_personal / natural_tutor / juridica).
// The markup lives in each page (identical fieldsets); this module fills the doc-type
// selects, toggles the mode, and builds the signer object. Call setup_signer_form()
// AFTER load_doc_types(); read the result with build_signer() / get_signer_mode().

function setup_signer_form() {
  _fill_signer_select('np-tipodoc', 'natural');
  _fill_signer_select('tr-tipodoc', 'natural_tutor_represented');
  _fill_signer_select('rp-tipodoc', 'natural_tutor_representative');
  _fill_signer_select('ju-tipodoc', 'juridica_signer');
  document.getElementById('modo').addEventListener('change', _on_signer_mode_change);
  _on_signer_mode_change();
}

function _fill_signer_select(id, context) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = get_doc_types_for(context)
    .map((t) => '<option value="' + escape_html(t.code) + '">' + escape_html(t.label) + '</option>').join('');
}

function _on_signer_mode_change() {
  const mode = get_signer_mode();
  document.getElementById('campos-natural').hidden = mode !== 'natural_personal';
  document.getElementById('campos-tutor').hidden = mode !== 'natural_tutor';
  document.getElementById('campos-juridica').hidden = mode !== 'juridica';
}

function get_signer_mode() {
  return document.getElementById('modo').value;
}

function build_signer() {
  const v = (id) => { const el = document.getElementById(id); return ((el && el.value) || '').trim(); };
  const mode = get_signer_mode();
  if (mode === 'natural_personal') {
    return { nombre: v('np-nombre'), apellido: v('np-apellido'), tipoDoc: v('np-tipodoc'), numero: v('np-numero'), email: v('np-email').toLowerCase(), telefono: v('np-telefono') };
  }
  if (mode === 'juridica') {
    return { nombre: v('ju-nombre'), apellido: v('ju-apellido'), tipoDoc: v('ju-tipodoc'), numero: v('ju-numero'), email: v('ju-email').toLowerCase(), telefono: v('ju-telefono'), empresa: v('ju-razon'), nit: v('ju-nit'), cargo: v('ju-cargo') };
  }
  return { nombre: v('rp-nombre'), apellido: v('rp-apellido'), tipoDoc: v('rp-tipodoc'), numero: v('rp-numero'), email: v('rp-email').toLowerCase(), telefono: v('rp-telefono'), calidad: v('rp-calidad'),
    represented: { nombre: v('tr-nombre'), apellido: v('tr-apellido'), tipoDoc: v('tr-tipodoc'), numero: v('tr-numero'), nacimiento: v('tr-nacimiento') } };
}
