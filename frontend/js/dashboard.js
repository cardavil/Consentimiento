document.addEventListener('DOMContentLoaded', async function () {
  var client = init_supabase();
  var session = await get_session();
  if (!session) { window.location.href = 'login.html'; return; }

  var meta = session.user.app_metadata || {};
  if (!meta.org_id) { window.location.href = 'login.html'; return; }

  try {
    var org = await supabase_fetch(
      '/organizations?id=eq.' + meta.org_id + '&select=type,first_name,last_name,company_name,plan,email,phone',
      session.access_token
    );

    if (org && org.length > 0) {
      render_app_header({
        container_id: 'app-header',
        session: session,
        org: org[0],
        on_logout: org_sign_out,
      });
      await load_historial(session.access_token, meta.org_id);
    } else {
      render_app_header({
        container_id: 'app-header',
        session: session,
        on_logout: org_sign_out,
      });
    }
  } catch (_e) {
    render_app_header({
      container_id: 'app-header',
      session: session,
      on_logout: org_sign_out,
    });
  }
});

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
