var _consent_rows = [];
var _org_id = null;
var _jwt = null;

document.addEventListener('DOMContentLoaded', async function () {
  const session = await get_session();
  if (!session) { window.location.href = 'login.html'; return; }
  const meta = session.user.app_metadata || {};
  if (!meta.org_id) { window.location.href = 'login.html'; return; }

  _org_id = meta.org_id;
  _jwt = session.access_token;

  try {
    const org = await supabase_fetch(
      '/organizations?id=eq.' + _org_id + '&select=type,first_name,last_name,company_name,plan,email,phone',
      _jwt
    );
    render_app_header({ container_id: 'app-header', session: session, org: org && org[0], on_logout: consent_sign_out });
  } catch (_e) {
    render_app_header({ container_id: 'app-header', session: session, on_logout: consent_sign_out });
  }

  document.getElementById('btn-nuevo').addEventListener('click', open_new_consent);
  await load_consents();
});

async function load_consents() {
  try {
    _consent_rows = await supabase_fetch(
      '/consent_items?organization_id=eq.' + _org_id + '&select=id,code,title,description,required,sort_order,active&order=sort_order',
      _jwt
    ) || [];
    render_consent_table();
  } catch (_e) {
    show_error('Error cargando consentimientos');
  }
}

function render_consent_table() {
  const tbody = document.getElementById('consent-tbody');
  if (_consent_rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Aún no has creado consentimientos.</td></tr>';
    return;
  }

  let html = '';
  for (let i = 0; i < _consent_rows.length; i++) {
    const r = _consent_rows[i];
    const badge_class = r.active ? 'badge-teal' : 'badge-danger';
    const badge_text = r.active ? 'Activo' : 'Inactivo';
    html += '<tr>';
    html += '<td class="text-mono">' + escape_html(r.code) + '</td>';
    html += '<td>' + escape_html(r.title) + '</td>';
    html += '<td>' + (r.required ? 'Sí' : 'No') + '</td>';
    html += '<td><span class="badge ' + badge_class + '">' + badge_text + '</span></td>';
    html += '<td><button class="btn btn-ghost btn-sm" onclick="open_edit_consent(\'' + escape_html(r.id) + '\')">Editar</button></td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function open_new_consent() {
  document.getElementById('modal-title').textContent = 'Nuevo consentimiento';
  document.getElementById('edit-code').value = '';
  document.getElementById('edit-code').dataset.id = '';
  document.getElementById('edit-title').value = '';
  document.getElementById('edit-description').value = '';
  document.getElementById('edit-sort-order').value = String(_consent_rows.length);
  document.getElementById('edit-required').checked = false;
  document.getElementById('edit-active').checked = true;
  document.getElementById('modal-edit-consent').classList.add('modal-visible');
}

function open_edit_consent(id) {
  const row = _consent_rows.find((r) => r.id === id);
  if (!row) return;
  document.getElementById('modal-title').textContent = 'Editar: ' + row.code;
  document.getElementById('edit-code').value = row.code;
  document.getElementById('edit-code').dataset.id = row.id;
  document.getElementById('edit-title').value = row.title;
  document.getElementById('edit-description').value = row.description;
  document.getElementById('edit-sort-order').value = row.sort_order || 0;
  document.getElementById('edit-required').checked = !!row.required;
  document.getElementById('edit-active').checked = !!row.active;
  document.getElementById('modal-edit-consent').classList.add('modal-visible');
}

function close_consent_modal() {
  document.getElementById('modal-edit-consent').classList.remove('modal-visible');
}

async function save_consent() {
  const code = document.getElementById('edit-code').value.trim().toUpperCase();
  const title = document.getElementById('edit-title').value.trim();
  const description = document.getElementById('edit-description').value.trim();
  const sort_order = parseInt(document.getElementById('edit-sort-order').value) || 0;
  const required = document.getElementById('edit-required').checked;
  const active = document.getElementById('edit-active').checked;
  const id = document.getElementById('edit-code').dataset.id;

  if (!code || !title || !description) {
    show_error('Completa código, título y texto.');
    return;
  }

  const btn = document.getElementById('btn-save-consent');
  set_button_loading(btn, 'Guardando...');

  try {
    if (id) {
      await supabase_fetch('/consent_items?id=eq.' + encodeURIComponent(id), _jwt, {
        method: 'PATCH',
        body: { code: code, title: title, description: description, sort_order: sort_order, required: required, active: active },
        prefer: 'return=minimal',
      });
    } else {
      await supabase_fetch('/consent_items', _jwt, {
        method: 'POST',
        body: { organization_id: _org_id, code: code, title: title, description: description, sort_order: sort_order, required: required, active: active },
        prefer: 'return=minimal',
      });
    }
    close_consent_modal();
    show_success('Consentimiento guardado');
    await load_consents();
  } catch (e) {
    show_error(user_message(e.message));
  } finally {
    reset_button(btn, 'Guardar');
  }
}

async function consent_sign_out() {
  const client = init_supabase();
  await client.auth.signOut();
  window.location.href = 'login.html';
}
