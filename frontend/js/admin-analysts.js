var _analysts_all = [];
var ALL_PERMISSIONS = [
  { key: 'read:orgs', label: 'Ver organizaciones' },
  { key: 'read:audit_log', label: 'Ver auditoría' },
  { key: 'read:sessions', label: 'Ver sesiones' },
  { key: 'read:catalogs', label: 'Ver catálogos' },
  { key: 'write:catalogs', label: 'Editar catálogos' },
  { key: 'read:metrics', label: 'Ver métricas' },
];

document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_app_header({ container_id: 'app-header', session: _admin_session.session, org: _admin_session.org, on_logout: admin_sign_out });
  render_admin_nav();

  if (!is_admin()) {
    document.getElementById('main').innerHTML =
      '<div class="admin-empty"><h2>Solo admin</h2><p class="text-muted">Esta sección es exclusiva para administradores.</p></div>';
    return;
  }

  document.getElementById('btn-invitar').addEventListener('click', open_invite_modal);
  await load_analysts();
});

async function load_analysts() {
  var jwt = _admin_session.session.access_token;
  try {
    _analysts_all = await supabase_fetch(
      '/platform_users?select=id,email,name,role,active,created_at&order=created_at.desc',
      jwt
    ) || [];

    var perms = await supabase_fetch('/platform_permissions?select=user_id,permission', jwt) || [];
    var perms_map = {};
    for (var i = 0; i < perms.length; i++) {
      var p = perms[i];
      if (!perms_map[p.user_id]) perms_map[p.user_id] = [];
      perms_map[p.user_id].push(p.permission);
    }

    for (var j = 0; j < _analysts_all.length; j++) {
      _analysts_all[j]._permissions = perms_map[_analysts_all[j].id] || [];
    }

    render_analysts_table();
  } catch (err) {
    show_error('Error cargando analistas');
  }
}

function render_analysts_table() {
  var tbody = document.getElementById('analysts-tbody');

  if (_analysts_all.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Sin usuarios de plataforma</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < _analysts_all.length; i++) {
    var a = _analysts_all[i];
    var role_badge = a.role === 'admin' ? 'badge-teal' : 'badge-neutral';
    var status_badge = a.active ? 'badge-teal' : 'badge-danger';
    var status_text = a.active ? 'Activo' : 'Inactivo';

    html += '<tr>';
    html += '<td>' + escape_html(a.name) + '</td>';
    html += '<td>' + escape_html(a.email) + '</td>';
    html += '<td><span class="badge ' + role_badge + '">' + escape_html(a.role) + '</span></td>';
    html += '<td><span class="badge ' + status_badge + '">' + status_text + '</span></td>';
    html += '<td>';
    if (a.role === 'analyst') {
      html += '<button class="btn btn-ghost btn-sm" onclick="open_permissions(\'' + a.id + '\')">Permisos</button> ';
      html += '<button class="btn btn-ghost btn-sm" onclick="toggle_analyst_active(\'' + a.id + '\',' + !a.active + ')">' +
        (a.active ? 'Desactivar' : 'Activar') + '</button>';
    }
    html += '</td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function open_invite_modal() {
  document.getElementById('invite-email').value = '';
  document.getElementById('invite-name').value = '';
  document.getElementById('modal-invite').classList.add('modal-visible');
}

function close_invite_modal() {
  document.getElementById('modal-invite').classList.remove('modal-visible');
}

async function send_invite() {
  var email = document.getElementById('invite-email').value.trim().toLowerCase();
  var name = document.getElementById('invite-name').value.trim();

  if (!validate_email(email) || !name) {
    show_error('Completa email y nombre');
    return;
  }

  var btn = document.getElementById('btn-send-invite');
  set_button_loading(btn, 'Invitando...');

  try {
    await call_edge_function('admin-service', {
      action: 'invite',
      email: email,
      name: name,
    });
    close_invite_modal();
    show_success('Analista invitado: ' + email);
    await load_analysts();
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Invitar');
  }
}

function open_permissions(user_id) {
  var user = null;
  for (var i = 0; i < _analysts_all.length; i++) {
    if (_analysts_all[i].id === user_id) { user = _analysts_all[i]; break; }
  }
  if (!user) return;

  document.getElementById('perm-user-id').value = user.id;
  document.getElementById('perm-user-name').textContent = user.name;

  var grid = document.getElementById('perm-grid');
  var html = '';
  for (var j = 0; j < ALL_PERMISSIONS.length; j++) {
    var p = ALL_PERMISSIONS[j];
    var checked = user._permissions.indexOf(p.key) !== -1 ? ' checked' : '';
    html += '<label class="admin-perm-item">' +
      '<input type="checkbox" class="perm-check" value="' + p.key + '"' + checked + '> ' +
      escape_html(p.label) + '</label>';
  }
  grid.innerHTML = html;

  document.getElementById('modal-permissions').classList.add('modal-visible');
}

function close_permissions_modal() {
  document.getElementById('modal-permissions').classList.remove('modal-visible');
}

async function save_permissions() {
  var user_id = document.getElementById('perm-user-id').value;
  var checks = document.querySelectorAll('.perm-check');
  var permissions = [];
  for (var i = 0; i < checks.length; i++) {
    if (checks[i].checked) permissions.push(checks[i].value);
  }

  var btn = document.getElementById('btn-save-perms');
  set_button_loading(btn, 'Guardando...');

  try {
    await call_edge_function('admin-service', {
      action: 'set_permissions',
      user_id: user_id,
      permissions: permissions,
    });
    close_permissions_modal();
    show_success('Permisos actualizados');
    await load_analysts();
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Guardar');
  }
}

async function toggle_analyst_active(user_id, new_active) {
  try {
    await call_edge_function('admin-service', {
      action: 'toggle_user',
      user_id: user_id,
      active: new_active,
    });
    show_success(new_active ? 'Usuario activado' : 'Usuario desactivado');
    await load_analysts();
  } catch (err) {
    show_error(user_message(err.message));
  }
}
