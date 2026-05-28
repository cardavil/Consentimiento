document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_admin_nav();
  await load_dashboard();
});

async function load_dashboard() {
  var jwt = _admin_session.session.access_token;
  var stats = document.getElementById('stats-grid');
  var cards = [];

  try {
    var promises = [];

    if (has_permission('read:orgs')) {
      promises.push(
        supabase_fetch('/organizations?select=id&active=eq.true', jwt, { prefer: 'count=exact' })
          .then(function () { return null; })
      );
      promises.push(
        fetch(CONFIG.supabase_url + '/rest/v1/organizations?select=id&active=eq.true', {
          method: 'HEAD',
          headers: {
            'apikey': CONFIG.supabase_key,
            'Authorization': 'Bearer ' + jwt,
            'Prefer': 'count=exact',
          },
        }).then(function (r) { return parseInt(r.headers.get('content-range').split('/')[1]) || 0; })
      );
    } else {
      promises.push(Promise.resolve(null));
      promises.push(Promise.resolve(null));
    }

    if (has_permission('read:sessions')) {
      var month_start = new Date();
      month_start.setDate(1);
      month_start.setHours(0, 0, 0, 0);
      promises.push(
        fetch(CONFIG.supabase_url + '/rest/v1/signing_sessions_results?select=id&created_at=gte.' + month_start.toISOString(), {
          method: 'HEAD',
          headers: {
            'apikey': CONFIG.supabase_key,
            'Authorization': 'Bearer ' + jwt,
            'Prefer': 'count=exact',
          },
        }).then(function (r) { return parseInt(r.headers.get('content-range').split('/')[1]) || 0; })
      );
    } else {
      promises.push(Promise.resolve(null));
    }

    if (is_admin()) {
      promises.push(
        supabase_fetch('/platform_users?select=id&role=eq.analyst&active=eq.true', jwt)
      );
    } else {
      promises.push(Promise.resolve(null));
    }

    var results = await Promise.all(promises);
    var org_count = results[1];
    var session_count = results[2];
    var analysts = results[3];

    if (org_count !== null) {
      cards.push(render_stat_card(org_count, 'Organizaciones activas'));
    }
    if (session_count !== null) {
      cards.push(render_stat_card(session_count, 'Sesiones este mes'));
    }
    if (analysts !== null) {
      cards.push(render_stat_card(analysts.length, 'Analistas activos'));
    }

    if (cards.length === 0) {
      stats.innerHTML = '<div class="admin-empty"><p class="text-muted">No tienes permisos para ver métricas.</p></div>';
    } else {
      stats.innerHTML = cards.join('');
    }
  } catch (err) {
    stats.innerHTML = '<div class="admin-empty"><p class="text-muted">Error cargando datos.</p></div>';
  }
}

function render_stat_card(value, label) {
  return '<div class="admin-stat-card">' +
    '<div class="admin-stat-value">' + escape_html(String(value)) + '</div>' +
    '<div class="admin-stat-label">' + escape_html(label) + '</div>' +
    '</div>';
}
