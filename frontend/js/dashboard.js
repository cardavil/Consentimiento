document.addEventListener('DOMContentLoaded', async function () {
  var client = init_supabase();
  var session = await get_session();
  if (!session) { window.location.href = 'login.html'; return; }

  var meta = session.user.app_metadata || {};
  if (!meta.org_id) { window.location.href = 'login.html'; return; }

  if (meta.platform_role) {
    var link = document.getElementById('dash-admin-link');
    link.href = 'admin/index.html';
    link.hidden = false;
  }

  document.getElementById('dash-email').textContent = session.user.email;

  try {
    var org = await supabase_fetch(
      '/organizations?id=eq.' + meta.org_id + '&select=type,first_name,last_name,company_name,plan,email,phone',
      session.access_token
    );

    if (org && org.length > 0) {
      render_org_info(org[0]);
      await load_historial(session.access_token, meta.org_id);
    } else {
      document.getElementById('dash-nombre').textContent = session.user.email;
    }
  } catch (_e) {
    document.getElementById('dash-nombre').textContent = session.user.email;
  }
});

function render_org_info(org) {
  var display_name = org.company_name || ((org.first_name || '') + ' ' + (org.last_name || '')).trim();
  var initials = display_name.split(' ').map(function (w) { return w[0] || ''; }).slice(0, 2).join('').toUpperCase();

  document.getElementById('dash-avatar').textContent = initials;
  document.getElementById('dash-nombre').textContent = display_name;
  document.getElementById('dash-plan').textContent = (org.plan || 'trial').toUpperCase();

  var tipo_badge = document.getElementById('dash-tipo');
  tipo_badge.textContent = org.type === 'juridica' ? 'Jurídica' : 'Natural';
  tipo_badge.classList.add(org.type === 'juridica' ? 'badge-info' : 'badge-teal');
}

async function load_historial(jwt, org_id) {
  try {
    var sessions = await supabase_fetch(
      '/signing_sessions_results?organization_id=eq.' + org_id + '&select=id,status,mode,created_at&order=created_at.desc&limit=5',
      jwt
    );

    if (!sessions || sessions.length === 0) return;

    var html = '<table class="tabla"><thead><tr><th>Fecha</th><th>Modo</th><th>Estado</th></tr></thead><tbody>';
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var fecha = new Date(s.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
      var modo = s.mode === 'firma' ? 'Firma' : 'Consentimiento';
      var estado = s.status || 'pending';
      html += '<tr><td>' + escape_html(fecha) + '</td><td>' + escape_html(modo) + '</td><td><span class="badge">' + escape_html(estado) + '</span></td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById('dash-historial').innerHTML = html;
  } catch (_e) {}
}

async function org_sign_out() {
  var client = init_supabase();
  await client.auth.signOut();
  window.location.href = 'login.html';
}
