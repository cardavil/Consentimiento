var _jwt = null;
var _org_id = null;
var _drive_files = [];
var _templates = [];
var _inline = null; // {doc_id, doc_name, fields, page_count} from the editor

document.addEventListener('DOMContentLoaded', async function () {
  const session = await get_session();
  if (!session) { window.location.href = 'login.html'; return; }
  const meta = session.user.app_metadata || {};
  if (!meta.org_id) { window.location.href = 'login.html'; return; }
  _jwt = session.access_token; _org_id = meta.org_id;

  try {
    const org = await supabase_fetch(
      '/organizations?id=eq.' + _org_id + '&select=type,first_name,last_name,company_name,plan,email,phone', _jwt);
    render_app_header({ container_id: 'app-header', session: session, org: org && org[0], on_logout: ds_sign_out });
  } catch (_e) {
    render_app_header({ container_id: 'app-header', session: session, on_logout: ds_sign_out });
  }

  await load_doc_types();
  populate_doc_selects();

  const stored = sessionStorage.getItem('firma_inline');
  if (stored) { try { _inline = JSON.parse(stored); } catch (_e) { _inline = null; } }

  document.getElementById('modo').addEventListener('change', on_mode_change);
  document.getElementById('form-solicitar').addEventListener('submit', on_submit);
  document.getElementById('btn-config-campos').addEventListener('click', open_editor);
  document.getElementById('btn-copiar').addEventListener('click', copy_url);

  await Promise.all([load_documents(), load_templates()]);
  render_inline_status();
});

function fill_select(id, context) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = get_doc_types_for(context).map((t) => '<option value="' + escape_html(t.code) + '">' + escape_html(t.label) + '</option>').join('');
}
function populate_doc_selects() {
  fill_select('np-tipodoc', 'natural');
  fill_select('tr-tipodoc', 'natural_tutor_represented');
  fill_select('rp-tipodoc', 'natural_tutor_representative');
  fill_select('ju-tipodoc', 'juridica_signer');
}
function on_mode_change() {
  const mode = document.getElementById('modo').value;
  document.getElementById('campos-natural').hidden = mode !== 'natural_personal';
  document.getElementById('campos-tutor').hidden = mode !== 'natural_tutor';
  document.getElementById('campos-juridica').hidden = mode !== 'juridica';
}

async function load_documents() {
  const container = document.getElementById('docs-container');
  try {
    const data = await call_edge_function('drive-service', { action: 'list_files' });
    _drive_files = data.files || [];
    if (_drive_files.length === 0) {
      container.innerHTML = '<p class="text-sm text-muted">No hay PDFs en tu carpeta Consentia.</p>';
      return;
    }
    let html = '';
    for (const f of _drive_files) {
      const checked = _inline && _inline.doc_id === f.id ? ' checked' : '';
      html += '<label class="dash-check-item"><input type="radio" name="doc" class="doc-radio" value="' + escape_html(f.id) + '" data-name="' + escape_html(f.name) + '"' + checked + '> ' + escape_html(f.name) + '</label>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = e.message === 'SIN_NUBE_CONECTADA'
      ? '<p class="text-sm">Conecta tu nube primero. <a href="onboarding.html">Conectar</a>.</p>'
      : '<p class="text-sm text-danger">No se pudieron cargar los documentos.</p>';
  }
}

async function load_templates() {
  try {
    _templates = await supabase_fetch(
      '/signing_templates?organization_id=eq.' + _org_id + '&active=eq.true&select=id,name,fields&order=name', _jwt) || [];
    const sel = document.getElementById('tpl-select');
    for (const t of _templates) {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      sel.appendChild(opt);
    }
  } catch (_e) {}
}

function render_inline_status() {
  const el = document.getElementById('inline-status');
  if (_inline && _inline.fields) {
    el.textContent = 'Campos configurados manualmente: ' + _inline.fields.length + ' campo(s) sobre «' + _inline.doc_name + '».';
  } else {
    el.textContent = '';
  }
}

function selected_doc() {
  const r = document.querySelector('.doc-radio:checked');
  return r ? { id: r.value, name: r.dataset.name } : null;
}

function open_editor() {
  const doc = selected_doc();
  if (!doc) { show_error('Selecciona primero el documento.'); return; }
  window.location.href = 'documento-editor.html?doc_id=' + encodeURIComponent(doc.id) + '&doc_name=' + encodeURIComponent(doc.name);
}

function build_signer(mode) {
  const v = (id) => (document.getElementById(id).value || '').trim();
  if (mode === 'natural_personal') {
    return { nombre: v('np-nombre'), apellido: v('np-apellido'), tipoDoc: v('np-tipodoc'), numero: v('np-numero'), email: v('np-email').toLowerCase(), telefono: v('np-telefono') };
  }
  if (mode === 'juridica') {
    return { nombre: v('ju-nombre'), apellido: v('ju-apellido'), tipoDoc: v('ju-tipodoc'), numero: v('ju-numero'), email: v('ju-email').toLowerCase(), telefono: v('ju-telefono'), empresa: v('ju-razon'), nit: v('ju-nit'), cargo: v('ju-cargo') };
  }
  return { nombre: v('rp-nombre'), apellido: v('rp-apellido'), tipoDoc: v('rp-tipodoc'), numero: v('rp-numero'), email: v('rp-email').toLowerCase(), telefono: v('rp-telefono'), calidad: v('rp-calidad'),
    represented: { nombre: v('tr-nombre'), apellido: v('tr-apellido'), tipoDoc: v('tr-tipodoc'), numero: v('tr-numero') } };
}

function resolve_fields(doc) {
  const tpl_id = document.getElementById('tpl-select').value;
  if (tpl_id) {
    const t = _templates.find((x) => x.id === tpl_id);
    return { fields: t ? t.fields : [], template_id: tpl_id };
  }
  if (_inline && _inline.doc_id === doc.id) return { fields: _inline.fields, template_id: null };
  return { fields: [], template_id: null };
}

async function on_submit(e) {
  e.preventDefault();
  const mode = document.getElementById('modo').value;
  const signer = build_signer(mode);
  const doc = selected_doc();
  const exp_val = parseInt(document.getElementById('exp-valor').value) || 3;
  const expires_in_hours = document.getElementById('exp-unidad').value === 'days' ? exp_val * 24 : exp_val;
  const context = document.getElementById('contexto').value.trim();

  if (!signer.email || !validate_email(signer.email)) { show_error('Email del firmante inválido.'); return; }
  if (!signer.nombre || !signer.numero) { show_error('Completa los datos del firmante.'); return; }
  if (!doc) { show_error('Selecciona el documento a firmar.'); return; }
  const { fields, template_id } = resolve_fields(doc);
  if (!fields || fields.length === 0) { show_error('Configura los campos (plantilla o editor).'); return; }

  const btn = document.getElementById('btn-solicitar');
  set_button_loading(btn, 'Creando...');
  try {
    const data = await call_edge_function('signing-service', {
      action: 'create_session', mode: mode, signer: signer,
      documents: [doc], fields: fields, template_id: template_id,
      expires_in_hours: expires_in_hours, context: context,
    });
    sessionStorage.removeItem('firma_inline');
    show_result(data);
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Crear y enviar enlace');
  }
}

function show_result(data) {
  document.getElementById('form-solicitar').hidden = true;
  document.getElementById('resultado').hidden = false;
  document.getElementById('res-url').value = data.signing_url || '';
  document.getElementById('res-email-status').textContent = data.email_sent
    ? 'El enlace fue enviado por correo al firmante.'
    : 'No se pudo enviar el correo automáticamente. Comparte el enlace manualmente.';
}

function copy_url() {
  const input = document.getElementById('res-url');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => show_success('Enlace copiado'));
}

async function ds_sign_out() {
  const client = init_supabase();
  await client.auth.signOut();
  window.location.href = 'login.html';
}
