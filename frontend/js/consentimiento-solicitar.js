var _jwt = null;
var _tenant_id = null;
var _drive_files = [];
var _consent_items = [];

document.addEventListener('DOMContentLoaded', async function () {
  const ctx = await init_app_page();
  if (!ctx) return;
  _jwt = ctx.jwt;
  _tenant_id = ctx.tenant_id;

  await load_doc_types();
  setup_signer_form();

  document.getElementById('form-solicitar').addEventListener('submit', on_submit);
  document.getElementById('btn-copiar').addEventListener('click', copy_url);

  await Promise.all([load_documents(), load_consent_items()]);
});

async function load_documents() {
  const container = document.getElementById('docs-container');
  try {
    const data = await call_edge_function('drive-service', { action: 'list_files' });
    _drive_files = data.files || [];
    if (_drive_files.length === 0) {
      container.innerHTML = '<p class="text-sm text-muted">No hay PDFs en tu carpeta Consentia. Sube documentos a tu nube y vuelve.</p>';
      return;
    }
    let html = '';
    for (const f of _drive_files) {
      html += '<label class="dash-check-item"><input type="checkbox" class="doc-check" value="' + escape_html(f.id) + '" data-name="' + escape_html(f.name) + '"> ' + escape_html(f.name) + '</label>';
    }
    container.innerHTML = html;
  } catch (e) {
    if (e.message === 'SIN_NUBE_CONECTADA') {
      container.innerHTML = '<p class="text-sm">Aún no conectas tu nube. <a href="onboarding.html">Conectar ahora</a>.</p>';
    } else {
      container.innerHTML = '<p class="text-sm text-danger">No se pudieron cargar los documentos.</p>';
    }
  }
}

async function load_consent_items() {
  const container = document.getElementById('consents-container');
  try {
    _consent_items = await supabase_fetch(
      '/consent_items?tenant_id=eq.' + _tenant_id + '&active=eq.true&select=id,code,title,description,required&order=sort_order',
      _jwt
    ) || [];
    if (_consent_items.length === 0) {
      container.innerHTML = '<p class="text-sm">No tienes consentimientos activos. <a href="consentimientos.html">Crear consentimientos</a>.</p>';
      return;
    }
    let html = '<table class="tabla"><thead><tr><th>Incluir</th><th>Obligatorio</th><th>Consentimiento</th></tr></thead><tbody>';
    for (const c of _consent_items) {
      html += '<tr data-id="' + escape_html(c.id) + '">' +
        '<td><input type="checkbox" class="consent-include" checked></td>' +
        '<td><input type="checkbox" class="consent-required"' + (c.required ? ' checked' : '') + '></td>' +
        '<td><strong>' + escape_html(c.code) + '</strong> — ' + escape_html(c.title) + '</td></tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (_e) {
    container.innerHTML = '<p class="text-sm text-danger">No se pudieron cargar los consentimientos.</p>';
  }
}

function get_selected_documents() {
  const checks = document.querySelectorAll('.doc-check:checked');
  return Array.from(checks).map((c) => ({ id: c.value, name: c.dataset.name }));
}

function get_selected_consents() {
  const rows = document.querySelectorAll('#consents-container tr[data-id]');
  const result = [];
  for (const tr of rows) {
    const include = tr.querySelector('.consent-include');
    if (!include || !include.checked) continue;
    const id = tr.dataset.id;
    const item = _consent_items.find((c) => c.id === id);
    if (!item) continue;
    result.push({
      id: item.id, code: item.code, title: item.title, description: item.description,
      required: tr.querySelector('.consent-required').checked,
    });
  }
  return result;
}

async function on_submit(e) {
  e.preventDefault();
  const mode = get_signer_mode();
  const signer = build_signer();
  const documents = get_selected_documents();
  const consents = get_selected_consents();
  const exp_val = parseInt(document.getElementById('exp-valor').value) || 3;
  const exp_unit = document.getElementById('exp-unidad').value;
  const expires_in_hours = exp_unit === 'days' ? exp_val * 24 : exp_val;
  const context = document.getElementById('contexto').value.trim();

  if (!signer.email || !validate_email(signer.email)) { show_error('Email del firmante inválido.'); return; }
  if (!signer.nombre || !signer.numero) { show_error('Completa los datos del firmante.'); return; }
  if (documents.length === 0) { show_error('Selecciona al menos un documento.'); return; }
  if (consents.length === 0) { show_error('Selecciona al menos un consentimiento.'); return; }

  const btn = document.getElementById('btn-solicitar');
  set_button_loading(btn, 'Creando...');

  try {
    const data = await call_edge_function('consent-service', {
      action: 'create_session', mode: mode, signer: signer,
      documents: documents, consents: consents, expires_in_hours: expires_in_hours, context: context,
    });
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

