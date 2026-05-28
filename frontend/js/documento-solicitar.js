var _jwt = null;
var _org_id = null;
var _drive_files = [];
var _templates = [];
var _inline = null; // {doc_id, doc_name, fields, page_count} from the editor

document.addEventListener('DOMContentLoaded', async function () {
  const ctx = await init_app_page();
  if (!ctx) return;
  _jwt = ctx.jwt; _org_id = ctx.org_id;

  await load_doc_types();
  setup_signer_form();

  const stored = sessionStorage.getItem('firma_inline');
  if (stored) { try { _inline = JSON.parse(stored); } catch (_e) { _inline = null; } }

  document.getElementById('form-solicitar').addEventListener('submit', on_submit);
  document.getElementById('btn-config-campos').addEventListener('click', open_editor);
  document.getElementById('btn-copiar').addEventListener('click', copy_url);

  await Promise.all([load_documents(), load_templates()]);
  render_inline_status();
});

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
  const mode = get_signer_mode();
  const signer = build_signer();
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

