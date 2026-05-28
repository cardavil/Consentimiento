var _catalog_rows = [];

document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_app_header({ container_id: 'app-header', session: _admin_session.session, on_logout: admin_sign_out });
  render_admin_nav();
  if (!require_permission('read:catalogs')) return;

  if (has_permission('write:catalogs')) {
    document.getElementById('btn-nuevo-tipo').hidden = false;
    document.getElementById('btn-nuevo-tipo').addEventListener('click', open_new_doc_type);
  }

  await load_catalog();
});

async function load_catalog() {
  var jwt = _admin_session.session.access_token;
  try {
    _catalog_rows = await supabase_fetch(
      '/catalog_doc_types?select=code,label,contexts,regex,sort_order,active&order=sort_order',
      jwt
    ) || [];
    render_catalog_table();
  } catch (err) {
    show_error('Error cargando catálogo');
  }
}

function render_catalog_table() {
  var tbody = document.getElementById('catalog-tbody');
  if (_catalog_rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Sin tipos de documento</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < _catalog_rows.length; i++) {
    var r = _catalog_rows[i];
    var badge_class = r.active ? 'badge-teal' : 'badge-danger';
    var badge_text = r.active ? 'Activo' : 'Inactivo';

    html += '<tr>';
    html += '<td class="text-mono">' + escape_html(r.code) + '</td>';
    html += '<td>' + escape_html(r.label) + '</td>';
    html += '<td class="text-xs">' + escape_html((r.contexts || []).join(', ')) + '</td>';
    html += '<td class="text-mono text-xs">' + escape_html(r.regex || '—') + '</td>';
    html += '<td><span class="badge ' + badge_class + '">' + badge_text + '</span></td>';
    html += '<td>';
    if (has_permission('write:catalogs')) {
      html += '<button class="btn btn-ghost btn-sm" onclick="open_edit_doc_type(\'' + escape_html(r.code) + '\')">Editar</button>';
    }
    html += '</td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function open_new_doc_type() {
  document.getElementById('modal-title').textContent = 'Nuevo tipo de documento';
  document.getElementById('edit-code').value = '';
  document.getElementById('edit-code').disabled = false;
  document.getElementById('edit-label').value = '';
  document.getElementById('edit-regex').value = '';
  document.getElementById('edit-sort-order').value = '0';
  document.getElementById('edit-active').checked = true;

  var checks = document.querySelectorAll('.ctx-check');
  for (var i = 0; i < checks.length; i++) checks[i].checked = false;

  document.getElementById('modal-edit-catalog').classList.add('modal-visible');
}

function open_edit_doc_type(code) {
  var row = null;
  for (var i = 0; i < _catalog_rows.length; i++) {
    if (_catalog_rows[i].code === code) { row = _catalog_rows[i]; break; }
  }
  if (!row) return;

  document.getElementById('modal-title').textContent = 'Editar: ' + row.code;
  document.getElementById('edit-code').value = row.code;
  document.getElementById('edit-code').disabled = true;
  document.getElementById('edit-label').value = row.label;
  document.getElementById('edit-regex').value = row.regex || '';
  document.getElementById('edit-sort-order').value = row.sort_order || 0;
  document.getElementById('edit-active').checked = row.active;

  var contexts = row.contexts || [];
  var checks = document.querySelectorAll('.ctx-check');
  for (var i = 0; i < checks.length; i++) {
    checks[i].checked = contexts.indexOf(checks[i].value) !== -1;
  }

  document.getElementById('modal-edit-catalog').classList.add('modal-visible');
}

function close_catalog_modal() {
  document.getElementById('modal-edit-catalog').classList.remove('modal-visible');
}

async function save_doc_type() {
  var code = document.getElementById('edit-code').value.trim().toUpperCase();
  var label = document.getElementById('edit-label').value.trim();
  var regex = document.getElementById('edit-regex').value.trim() || null;
  var sort_order = parseInt(document.getElementById('edit-sort-order').value) || 0;
  var active = document.getElementById('edit-active').checked;

  var contexts = [];
  var checks = document.querySelectorAll('.ctx-check');
  for (var i = 0; i < checks.length; i++) {
    if (checks[i].checked) contexts.push(checks[i].value);
  }

  if (!code || !label || contexts.length === 0) {
    show_error('Completa código, nombre y al menos un contexto');
    return;
  }

  var btn = document.getElementById('btn-save-catalog');
  set_button_loading(btn, 'Guardando...');

  try {
    var is_new = !document.getElementById('edit-code').disabled;
    var jwt = _admin_session.session.access_token;

    if (is_new) {
      await supabase_fetch('/catalog_doc_types', jwt, {
        method: 'POST',
        body: { code: code, label: label, contexts: contexts, regex: regex, sort_order: sort_order, active: active },
        prefer: 'return=minimal',
      });
    } else {
      await supabase_fetch('/catalog_doc_types?code=eq.' + encodeURIComponent(code), jwt, {
        method: 'PATCH',
        body: { label: label, contexts: contexts, regex: regex, sort_order: sort_order, active: active },
        prefer: 'return=minimal',
      });
    }

    close_catalog_modal();
    show_success('Tipo de documento guardado');
    await load_catalog();
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Guardar');
  }
}
