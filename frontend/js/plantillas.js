var _jwt = null;
var _tenant_id = null;
var _rows = [];
var _edit_template_id = null; // set when picking a doc to edit an existing template
var LIMITS = CONFIG.plan_limits;

document.addEventListener('DOMContentLoaded', async function () {
  const ctx = await init_app_page();
  if (!ctx) return;
  _jwt = ctx.jwt; _tenant_id = ctx.tenant_id;
  window._plan = (ctx.tenant && ctx.tenant.plan) || 'trial';

  document.getElementById('btn-nueva').addEventListener('click', () => { _edit_template_id = null; open_pick(); });
  await load_templates();
});

async function load_templates() {
  try {
    _rows = await supabase_fetch(
      '/signing_templates?tenant_id=eq.' + _tenant_id + '&select=id,name,source_file_name,fields,active,created_at&order=created_at.desc', _jwt) || [];
    const active = _rows.filter((r) => r.active).length;
    const limit = LIMITS[window._plan];
    document.getElementById('tpl-count').textContent = '(' + active + ' / ' + (limit === Infinity ? '∞' : limit) + ')';
    render_table();
  } catch (_e) {
    show_error('Error cargando plantillas');
  }
}

function render_table() {
  const tbody = document.getElementById('tpl-tbody');
  if (_rows.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Aún no hay plantillas.</td></tr>'; return; }
  let html = '';
  for (const r of _rows) {
    const badge = r.active ? '<span class="badge badge-teal">Activa</span>' : '<span class="badge badge-danger">Inactiva</span>';
    html += '<tr>' +
      '<td>' + escape_html(r.name) + '</td>' +
      '<td class="text-sm text-muted">' + escape_html(r.source_file_name || '—') + '</td>' +
      '<td>' + (r.fields ? r.fields.length : 0) + '</td>' +
      '<td>' + badge + '</td>' +
      '<td>' +
        '<button class="btn btn-ghost btn-sm" onclick="edit_tpl(\'' + escape_html(r.id) + '\')">Editar</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="toggle_tpl(\'' + escape_html(r.id) + '\',' + (!r.active) + ')">' + (r.active ? 'Desactivar' : 'Activar') + '</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="delete_tpl(\'' + escape_html(r.id) + '\')">Eliminar</button>' +
      '</td></tr>';
  }
  tbody.innerHTML = html;
}

function edit_tpl(id) { _edit_template_id = id; open_pick(); }

async function toggle_tpl(id, active) {
  try {
    await supabase_fetch('/signing_templates?id=eq.' + encodeURIComponent(id), _jwt, {
      method: 'PATCH', body: { active: active }, prefer: 'return=minimal',
    });
    await load_templates();
  } catch (e) { show_error(user_message(e.message)); }
}

async function delete_tpl(id) {
  try {
    await supabase_fetch('/signing_templates?id=eq.' + encodeURIComponent(id), _jwt, { method: 'DELETE', prefer: 'return=minimal' });
    show_success('Plantilla eliminada');
    await load_templates();
  } catch (e) { show_error(user_message(e.message)); }
}

async function open_pick() {
  show_modal('modal-pick');
  const list = document.getElementById('pick-list');
  list.innerHTML = '<p class="text-sm text-muted">Cargando documentos…</p>';
  try {
    const data = await call_edge_function('drive-service', { action: 'list_files' });
    const files = data.files || [];
    if (files.length === 0) { list.innerHTML = '<p class="text-sm">No hay PDFs en tu carpeta Consentia.</p>'; return; }
    let html = '';
    for (const f of files) {
      html += '<button class="btn btn-outline btn-block mb-sm" onclick="pick_doc(\'' + escape_html(f.id) + '\',\'' + escape_html(f.name) + '\')">' + escape_html(f.name) + '</button>';
    }
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<p class="text-sm">' + escape_html(user_message(e.message)) + '</p>';
  }
}

function close_pick() { hide_modal('modal-pick'); }

function pick_doc(id, name) {
  let url = 'documento-editor.html?doc_id=' + encodeURIComponent(id) + '&doc_name=' + encodeURIComponent(name);
  if (_edit_template_id) url += '&template_id=' + encodeURIComponent(_edit_template_id);
  window.location.href = url;
}

