var _orgs_all = [];

document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_app_header({ container_id: 'app-header', session: _admin_session.session, org: _admin_session.org, on_logout: admin_sign_out });
  render_admin_nav();
  if (!require_permission('read:orgs')) return;

  document.getElementById('filtro-busqueda').addEventListener('input', debounce(render_orgs_table));
  document.getElementById('filtro-plan').addEventListener('change', render_orgs_table);
  document.getElementById('filtro-estado').addEventListener('change', render_orgs_table);

  await load_orgs();
});

async function load_orgs() {
  var jwt = _admin_session.session.access_token;
  try {
    _orgs_all = await supabase_fetch(
      '/organizations?select=id,type,first_name,last_name,company_name,email,plan,active,created_at&order=created_at.desc',
      jwt
    ) || [];
    render_orgs_table();
  } catch (err) {
    show_error('Error cargando organizaciones');
  }
}

function render_orgs_table() {
  var search = (document.getElementById('filtro-busqueda').value || '').toLowerCase();
  var plan = document.getElementById('filtro-plan').value;
  var estado = document.getElementById('filtro-estado').value;

  var filtered = _orgs_all.filter(function (o) {
    var name = o.type === 'juridica' ? (o.company_name || '') : (o.first_name + ' ' + (o.last_name || ''));
    if (search && name.toLowerCase().indexOf(search) === -1 && (o.email || '').toLowerCase().indexOf(search) === -1) return false;
    if (plan && o.plan !== plan) return false;
    if (estado === 'active' && !o.active) return false;
    if (estado === 'inactive' && o.active) return false;
    return true;
  });

  var tbody = document.getElementById('orgs-tbody');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Sin resultados</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i];
    var name = o.type === 'juridica' ? (o.company_name || '') : (o.first_name + ' ' + (o.last_name || ''));
    var badge_class = o.active ? 'badge-teal' : 'badge-danger';
    var badge_text = o.active ? 'Activa' : 'Inactiva';

    html += '<tr>';
    html += '<td>' + escape_html(name) + '</td>';
    html += '<td>' + escape_html(o.email) + '</td>';
    html += '<td><span class="badge badge-neutral">' + escape_html(o.type) + '</span></td>';
    html += '<td><span class="badge badge-neutral">' + escape_html(o.plan) + '</span></td>';
    html += '<td><span class="badge ' + badge_class + '">' + badge_text + '</span></td>';
    html += '<td>';
    if (is_admin()) {
      html += '<button class="btn btn-ghost btn-sm" onclick="open_edit_org(\'' + o.id + '\')">Editar</button>';
    }
    html += '</td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function open_edit_org(org_id) {
  var org = null;
  for (var i = 0; i < _orgs_all.length; i++) {
    if (_orgs_all[i].id === org_id) { org = _orgs_all[i]; break; }
  }
  if (!org) return;

  document.getElementById('edit-org-id').value = org.id;
  document.getElementById('edit-org-plan').value = org.plan;
  document.getElementById('edit-org-active').checked = org.active;

  var name = org.type === 'juridica' ? org.company_name : (org.first_name + ' ' + (org.last_name || ''));
  document.getElementById('edit-org-name').textContent = name;

  var overlay = document.getElementById('modal-edit-org');
  overlay.classList.add('modal-visible');
}

function close_edit_org() {
  document.getElementById('modal-edit-org').classList.remove('modal-visible');
}

async function save_org_changes() {
  var org_id = document.getElementById('edit-org-id').value;
  var plan = document.getElementById('edit-org-plan').value;
  var active = document.getElementById('edit-org-active').checked;

  var btn = document.getElementById('btn-save-org');
  set_button_loading(btn, 'Guardando...');

  try {
    await call_edge_function('admin-service', {
      action: 'update_org',
      org_id: org_id,
      plan: plan,
      active: active,
    });
    close_edit_org();
    show_success('Organización actualizada');
    await load_orgs();
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Guardar');
  }
}
