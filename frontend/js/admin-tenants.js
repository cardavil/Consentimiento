var _tenants_all = [];

// Columnas reales de la tabla `tenants` en Supabase, en orden. Vista fiel: una
// columna por campo, valores crudos.
var TENANT_COLUMNS = [
  'id', 'type', 'company_name', 'company_nit', 'first_name', 'last_name',
  'doc_type', 'doc_number', 'position', 'email', 'phone', 'plan', 'active',
  'folio_prefix', 'created_at', 'updated_at',
];

document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_app_header({ container_id: 'app-header', session: _admin_session.session, tenant: _admin_session.tenant, on_logout: admin_sign_out });
  render_admin_nav();
  if (!require_permission('read:tenants')) return;

  document.getElementById('filtro-busqueda').addEventListener('input', debounce(render_tenants_table));
  document.getElementById('filtro-tipo').addEventListener('change', render_tenants_table);
  document.getElementById('filtro-plan').addEventListener('change', render_tenants_table);
  document.getElementById('filtro-estado').addEventListener('change', render_tenants_table);

  await load_tenants();
});

async function load_tenants() {
  var jwt = _admin_session.session.access_token;
  try {
    _tenants_all = await supabase_fetch(
      '/tenants?select=' + TENANT_COLUMNS.join(',') + '&order=created_at.desc',
      jwt
    ) || [];
    render_tenants_table();
  } catch (err) {
    show_error('Error cargando inscritos');
  }
}

function raw_cell(v) {
  if (v === null || v === undefined || v === '') return '<td class="text-sm">—</td>';
  return '<td class="text-sm">' + escape_html(String(v)) + '</td>';
}

function render_tenants_table() {
  var search = (document.getElementById('filtro-busqueda').value || '').toLowerCase();
  var tipo = document.getElementById('filtro-tipo').value;
  var plan = document.getElementById('filtro-plan').value;
  var estado = document.getElementById('filtro-estado').value;

  var filtered = _tenants_all.filter(function (t) {
    if (tipo && t.type !== tipo) return false;
    if (plan && t.plan !== plan) return false;
    if (estado === 'active' && !t.active) return false;
    if (estado === 'inactive' && t.active) return false;
    if (search) {
      var haystack = [t.company_name, t.first_name, t.last_name, t.company_nit, t.doc_number, t.email]
        .filter(Boolean).join(' ').toLowerCase();
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });

  var tbody = document.getElementById('tenants-tbody');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="17" class="admin-empty">Sin resultados</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var t = filtered[i];
    html += '<tr>';
    for (var c = 0; c < TENANT_COLUMNS.length; c++) {
      html += raw_cell(t[TENANT_COLUMNS[c]]);
    }
    html += '<td>';
    if (is_admin()) {
      html += '<button class="btn btn-ghost btn-sm" onclick="open_edit_tenant(\'' + t.id + '\')">Editar</button>';
    }
    html += '</td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function open_edit_tenant(tenant_id) {
  var tenant = null;
  for (var i = 0; i < _tenants_all.length; i++) {
    if (_tenants_all[i].id === tenant_id) { tenant = _tenants_all[i]; break; }
  }
  if (!tenant) return;

  document.getElementById('edit-tenant-id').value = tenant.id;
  document.getElementById('edit-tenant-plan').value = tenant.plan;
  document.getElementById('edit-tenant-active').checked = tenant.active;

  var display_name = tenant.type === 'juridica' ? tenant.company_name : (tenant.first_name + ' ' + (tenant.last_name || ''));
  document.getElementById('edit-tenant-name').textContent = 'Editar: ' + display_name;

  document.getElementById('modal-edit-tenant').classList.add('modal-visible');
}

function close_edit_tenant() {
  document.getElementById('modal-edit-tenant').classList.remove('modal-visible');
}

async function save_tenant_changes() {
  var tenant_id = document.getElementById('edit-tenant-id').value;
  var plan = document.getElementById('edit-tenant-plan').value;
  var active = document.getElementById('edit-tenant-active').checked;

  var btn = document.getElementById('btn-save-tenant');
  set_button_loading(btn, 'Guardando...');

  try {
    await call_edge_function('admin-service', {
      action: 'update_tenant',
      tenant_id: tenant_id,
      plan: plan,
      active: active,
    });
    close_edit_tenant();
    show_success('Inscrito actualizado');
    await load_tenants();
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Guardar');
  }
}
