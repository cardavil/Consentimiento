var _audit_offset = 0;
var _audit_limit = 50;

document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_app_header({ container_id: 'app-header', session: _admin_session.session, tenant: _admin_session.tenant, on_logout: admin_sign_out });
  render_admin_nav();
  if (!require_permission('read:audit_log')) return;

  document.getElementById('filtro-evento').addEventListener('change', function () { _audit_offset = 0; load_audit(); });
  document.getElementById('filtro-fecha').addEventListener('change', function () { _audit_offset = 0; load_audit(); });
  document.getElementById('btn-anterior').addEventListener('click', function () {
    _audit_offset = Math.max(0, _audit_offset - _audit_limit);
    load_audit();
  });
  document.getElementById('btn-siguiente').addEventListener('click', function () {
    _audit_offset += _audit_limit;
    load_audit();
  });

  await load_audit();
});

async function load_audit() {
  var jwt = _admin_session.session.access_token;
  var event_type = document.getElementById('filtro-evento').value;
  var fecha = document.getElementById('filtro-fecha').value;

  var query = '/audit_log?select=id,tenant_id,event_type,event_data,ip,created_at&order=created_at.desc';
  query += '&limit=' + _audit_limit + '&offset=' + _audit_offset;

  if (event_type) query += '&event_type=eq.' + encodeURIComponent(event_type);
  if (fecha) query += '&created_at=gte.' + fecha + 'T00:00:00Z&created_at=lt.' + fecha + 'T23:59:59Z';

  try {
    var rows = await supabase_fetch(query, jwt) || [];
    render_audit_table(rows);

    document.getElementById('btn-anterior').disabled = _audit_offset === 0;
    document.getElementById('btn-siguiente').disabled = rows.length < _audit_limit;
    document.getElementById('paginacion-info').textContent =
      'Mostrando ' + (_audit_offset + 1) + '–' + (_audit_offset + rows.length);
  } catch (err) {
    show_error('Error cargando auditoría');
  }
}

function render_audit_table(rows) {
  var tbody = document.getElementById('audit-tbody');

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Sin registros</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var data_str = r.event_data ? JSON.stringify(r.event_data) : '';
    if (data_str.length > 80) data_str = data_str.substring(0, 80) + '...';

    html += '<tr>';
    html += '<td>' + escape_html(format_date(r.created_at)) + '</td>';
    html += '<td><span class="badge badge-neutral">' + escape_html(r.event_type) + '</span></td>';
    html += '<td class="text-mono text-xs">' + escape_html(r.tenant_id || '—') + '</td>';
    html += '<td class="text-xs">' + escape_html(data_str || '—') + '</td>';
    html += '<td class="text-mono text-xs">' + escape_html(r.ip || '—') + '</td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}
