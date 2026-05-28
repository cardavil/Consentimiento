var _jwt = null;
var _org_id = null;
var _drive_files = [];
var _consent_items = [];

document.addEventListener('DOMContentLoaded', async function () {
  const session = await get_session();
  if (!session) { window.location.href = 'login.html'; return; }
  const meta = session.user.app_metadata || {};
  if (!meta.org_id) { window.location.href = 'login.html'; return; }

  _jwt = session.access_token;
  _org_id = meta.org_id;

  try {
    const org = await supabase_fetch(
      '/organizations?id=eq.' + _org_id + '&select=type,first_name,last_name,company_name,plan,email,phone',
      _jwt
    );
    render_app_header({ container_id: 'app-header', session: session, org: org && org[0], on_logout: solicitar_sign_out });
  } catch (_e) {
    render_app_header({ container_id: 'app-header', session: session, on_logout: solicitar_sign_out });
  }

  await load_doc_types();
  populate_doc_selects();

  document.getElementById('modo').addEventListener('change', on_mode_change);
  document.getElementById('form-solicitar').addEventListener('submit', on_submit);
  document.getElementById('btn-copiar').addEventListener('click', copy_url);

  await Promise.all([load_documents(), load_consent_items()]);
});

function fill_select(id, context) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const types = get_doc_types_for(context);
  sel.innerHTML = types.map((t) => '<option value="' + escape_html(t.code) + '">' + escape_html(t.label) + '</option>').join('');
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
      '/consent_items?organization_id=eq.' + _org_id + '&active=eq.true&select=id,code,title,description,required&order=sort_order',
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

function build_signer(mode) {
  const v = (id) => (document.getElementById(id).value || '').trim();
  if (mode === 'natural_personal') {
    return { nombre: v('np-nombre'), apellido: v('np-apellido'), tipoDoc: v('np-tipodoc'), numero: v('np-numero'), email: v('np-email').toLowerCase(), telefono: v('np-telefono') };
  }
  if (mode === 'juridica') {
    return {
      nombre: v('ju-nombre'), apellido: v('ju-apellido'), tipoDoc: v('ju-tipodoc'), numero: v('ju-numero'),
      email: v('ju-email').toLowerCase(), telefono: v('ju-telefono'),
      empresa: v('ju-razon'), nit: v('ju-nit'), cargo: v('ju-cargo'),
    };
  }
  // natural_tutor: el representante firma y recibe el enlace
  return {
    nombre: v('rp-nombre'), apellido: v('rp-apellido'), tipoDoc: v('rp-tipodoc'), numero: v('rp-numero'),
    email: v('rp-email').toLowerCase(), telefono: v('rp-telefono'), calidad: v('rp-calidad'),
    represented: { nombre: v('tr-nombre'), apellido: v('tr-apellido'), tipoDoc: v('tr-tipodoc'), numero: v('tr-numero'), nacimiento: v('tr-nacimiento') },
  };
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
  const mode = document.getElementById('modo').value;
  const signer = build_signer(mode);
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

async function solicitar_sign_out() {
  const client = init_supabase();
  await client.auth.signOut();
  window.location.href = 'login.html';
}
