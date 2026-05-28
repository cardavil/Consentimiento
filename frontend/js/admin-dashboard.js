document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_app_header({
    container_id: 'app-header',
    session: _admin_session.session,
    org: _admin_session.org,
    on_logout: admin_sign_out,
  });
  render_admin_nav();
  await load_dashboard();
});

async function load_dashboard() {
  var container = document.getElementById('dashboard-content');

  try {
    var data = await call_edge_function('admin-service', { action: 'metrics' });
    render_metrics(container, data);
  } catch (err) {
    container.innerHTML = '<div class="admin-empty">' +
      '<p class="icon-2xl mb-sm">&#9888;</p>' +
      '<p class="text-muted mb-sm">No se pudieron cargar las métricas</p>' +
      '<button class="btn btn-outline btn-sm" onclick="load_dashboard()">Reintentar</button></div>';
  }
}

function render_metrics(container, m) {
  var html = '';

  html += '<div class="admin-stats">';
  html += stat_card(m.orgs_total, 'Organizaciones totales');
  html += stat_card(m.active_orgs_month, 'Orgs activas este mes');
  html += stat_card(m.sessions_created_month, 'Sesiones creadas');
  html += stat_card(m.sessions_completed_month, 'Sesiones completadas');
  html += stat_card(m.auth_otps_month, 'OTPs auth (mes)');
  html += stat_card(m.signing_otps_month, 'OTPs firma (mes)');
  html += '</div>';

  html += '<h2 class="mt-md mb-sm">Organizaciones por plan</h2>';
  html += '<div class="admin-stats">';
  var plans = ['trial', 'basic', 'pro', 'enterprise'];
  var plan_labels = { trial: 'Trial', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
  for (var i = 0; i < plans.length; i++) {
    var p = plans[i];
    html += stat_card(m.orgs_by_plan[p] || 0, plan_labels[p], 'plan-' + p);
  }
  html += '</div>';

  html += '<h2 class="mt-md mb-sm">Límites Supabase (Free)</h2>';
  html += '<div class="card" style="padding:0;overflow:hidden">';
  html += '<div class="admin-limits">';
  html += limit_row('MAUs', '50,000', m.orgs_total || '—');
  html += limit_row('Database', '500 MB', '—');
  html += limit_row('Edge Function invocations', '500,000/mes', (m.sessions_created_month || 0) + (m.signing_otps_month || 0) + (m.auth_otps_month || 0) || '—');
  html += limit_row('Auth emails (custom SMTP)', 'Sin límite', m.auth_otps_month || '—');
  html += limit_row('Storage', '1 GB', '—');
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;
}

function stat_card(value, label, extra_class) {
  var cls = 'admin-stat-card';
  if (extra_class) cls += ' ' + extra_class;
  return '<div class="' + cls + '">' +
    '<div class="admin-stat-value">' + escape_html(String(value)) + '</div>' +
    '<div class="admin-stat-label">' + escape_html(label) + '</div>' +
    '</div>';
}

function limit_row(resource, limit, current) {
  return '<div class="admin-limit-row">' +
    '<span class="admin-limit-resource">' + escape_html(resource) + '</span>' +
    '<span class="admin-limit-current">' + escape_html(String(current)) + '</span>' +
    '<span class="admin-limit-value">' + escape_html(limit) + '</span>' +
    '</div>';
}
