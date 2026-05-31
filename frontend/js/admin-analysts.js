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
  await load_doc_types();
  await load_analysts();
});

async function load_doc_types() {
  try {
    var client = get_supabase();
    var { data } = await client.from('catalog_doc_types').select('code,label').eq('active', true).order('sort_order');
    var select = document.getElementById('invite-doc-type');
    select.innerHTML = '<option value="">Seleccionar...</option>';
    for (var i = 0; i < (data || []).length; i++) {
      var opt = document.createElement('option');
      opt.value = data[i].code;
      opt.textContent = data[i].code + ' — ' + data[i].label;
      select.appendChild(opt);
    }
  } catch (_e) {}
}

async function load_analysts() {
  var jwt = _admin_session.session.access_token;
  try {
    _analysts_all = await supabase_fetch(
      '/platform_users?select=id,email,first_name,last_name,doc_type,doc_number,phone,role,active,created_at&order=created_at.desc',
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
    tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Sin usuarios de plataforma</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < _analysts_all.length; i++) {
    var a = _analysts_all[i];
    var display_name = (a.first_name || '') + ' ' + (a.last_name || '');
    var doc_info = a.doc_type ? a.doc_type + ' ' + (a.doc_number || '') : '';
    var contact = escape_html(a.email);
    if (a.phone) contact += '<br><span class="text-muted text-xs">' + escape_html(a.phone) + '</span>';
    var role_badge = a.role === 'admin' ? 'badge-teal' : 'badge-neutral';
    var status_badge = a.active ? 'badge-teal' : 'badge-danger';
    var status_text = a.active ? 'Activo' : 'Inactivo';

    html += '<tr>';
    html += '<td>' + escape_html(display_name.trim()) + '</td>';
    html += '<td class="text-sm">' + escape_html(doc_info) + '</td>';
    html += '<td class="text-sm">' + contact + '</td>';
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
  document.getElementById('invite-first-name').value = '';
  document.getElementById('invite-last-name').value = '';
  document.getElementById('invite-doc-type').value = '';
  document.getElementById('invite-doc-number').value = '';
  document.getElementById('invite-email').value = '';
  document.getElementById('invite-phone').value = '';
  document.getElementById('modal-invite').classList.add('modal-visible');
}

function close_invite_modal() {
  document.getElementById('modal-invite').classList.remove('modal-visible');
}

async function send_invite() {
  var first_name = document.getElementById('invite-first-name').value.trim();
  var last_name = document.getElementById('invite-last-name').value.trim();
  var doc_type = document.getElementById('invite-doc-type').value;
  var doc_number = document.getElementById('invite-doc-number').value.trim();
  var email = document.getElementById('invite-email').value.trim().toLowerCase();
  var phone = document.getElementById('invite-phone').value.trim();

  if (!first_name || !last_name || !doc_type || !doc_number || !validate_email(email)) {
    show_error('Completa todos los campos obligatorios');
    return;
  }

  var btn = document.getElementById('btn-send-invite');
  set_button_loading(btn, 'Invitando...');

  try {
    await call_edge_function('admin-service', {
      action: 'invite',
      first_name: first_name,
      last_name: last_name,
      doc_type: doc_type,
      doc_number: doc_number,
      email: email,
      phone: phone,
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
  document.getElementById('perm-user-name').textContent = (user.first_name || '') + ' ' + (user.last_name || '');

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
