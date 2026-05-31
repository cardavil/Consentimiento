document.addEventListener('DOMContentLoaded', async function () {
  const ctx = await init_app_page();
  if (!ctx) return;
  await load_historial(ctx.jwt, ctx.tenant_id);
  await load_onboarding_status();
});

async function load_historial(jwt, tenant_id) {
  try {
    var sessions = await supabase_fetch(
      '/signing_sessions_results?tenant_id=eq.' + tenant_id + '&select=id,status,mode,created_at&order=created_at.desc&limit=5',
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

async function load_onboarding_status() {
  try {
    var s = await call_edge_function('drive-service', { action: 'get_status' });
    if (!s || !s.connected) return;

    var item = document.getElementById('chk-cloud');
    if (item) {
      item.classList.add('dash-check-done');
      var icon = item.querySelector('.dash-check-icon');
      if (icon) { icon.classList.remove('dash-check-pending'); icon.innerHTML = '&#10003;'; }
    }
    var badge = document.getElementById('onb-badge');
    if (badge) { badge.className = 'badge badge-success'; badge.textContent = 'Nube conectada'; }
  } catch (_e) {}
}

