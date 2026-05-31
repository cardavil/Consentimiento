let _admin_session = null;
let _admin_permissions = [];

async function check_admin_session() {
  const client = init_supabase();
  const { data } = await client.auth.getSession();

  if (!data || !data.session) {
    window.location.href = '../login.html';
    return null;
  }

  const meta = data.session.user.app_metadata || {};
  if (!meta.platform_role) {
    window.location.href = '../login.html';
    return null;
  }

  _admin_session = {
    session: data.session,
    role: meta.platform_role,
    email: data.session.user.email,
    tenant: null,
    profile: null,
  };

  if (meta.tenant_id) {
    try {
      var tenants = await client
        .from('tenants')
        .select('type,first_name,last_name,company_name,plan')
        .eq('id', meta.tenant_id);
      if (tenants.data && tenants.data.length > 0) _admin_session.tenant = tenants.data[0];
    } catch (_e) {}
  }

  // Identidad del usuario de plataforma (para el header cuando no hay inscrito).
  try {
    var pu = await client
      .from('platform_users')
      .select('first_name,last_name,company_name')
      .eq('auth_user_id', data.session.user.id);
    if (pu.data && pu.data.length > 0) _admin_session.profile = pu.data[0];
  } catch (_e) {}

  if (meta.platform_role === 'analyst') {
    const { data: perms } = await client
      .from('platform_permissions')
      .select('permission');
    _admin_permissions = (perms || []).map(function (p) { return p.permission; });
  } else {
    _admin_permissions = [
      'read:tenants', 'read:audit_log', 'read:sessions',
      'read:catalogs', 'write:catalogs', 'read:metrics',
    ];
  }

  return _admin_session;
}

function is_admin() {
  return _admin_session && _admin_session.role === 'admin';
}

function has_permission(perm) {
  if (is_admin()) return true;
  return _admin_permissions.indexOf(perm) !== -1;
}

function require_permission(perm) {
  if (!has_permission(perm)) {
    document.getElementById('main').innerHTML =
      '<div class="admin-empty">' +
      '<h2>Sin acceso</h2>' +
      '<p class="text-muted">No tienes permiso para ver esta sección.</p>' +
      '</div>';
    return false;
  }
  return true;
}

async function admin_sign_out() {
  const client = init_supabase();
  await client.auth.signOut();
  window.location.href = '../login.html';
}
