var _audit_offset = 0;
var _audit_limit = 50;
var _tenant_names = {}; // tenant_id -> nombre/empresa (cache por página)

// Eventos que registran las edge functions (valor en BD → etiqueta legible).
var AUDIT_EVENTS = [
  { v: 'tenant_registered', l: 'Registro de inscrito' },
  { v: 'tenant_bootstrapped', l: 'Alta de inscrito (admin)' },
  { v: 'session_created', l: 'Sesión de consentimiento creada' },
  { v: 'signature_session_created', l: 'Sesión de firma creada' },
  { v: 'auth_otp_sent', l: 'OTP de acceso enviado' },
  { v: 'signing_otp_sent', l: 'OTP de firma enviado' },
  { v: 'consent_signed', l: 'Consentimiento firmado' },
  { v: 'document_signed', l: 'Documento firmado' },
];

document.addEventListener('DOMContentLoaded', async function () {
  var session = await check_admin_session();
  if (!session) return;
  render_app_header({ container_id: 'app-header', session: _admin_session.session, tenant: _admin_session.tenant, profile: _admin_session.profile, on_logout: admin_sign_out });
  render_admin_nav();
  if (!require_permission('read:audit_log')) return;

  // Opciones del filtro desde la lista canónica (evita opciones que no existen).
  var sel = document.getElementById('filtro-evento');
  for (var i = 0; i < AUDIT_EVENTS.length; i++) {
    var opt = document.createElement('option');
    opt.value = AUDIT_EVENTS[i].v;
    opt.textContent = AUDIT_EVENTS[i].l;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', function () { _audit_offset = 0; load_audit(); });
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
    await resolve_tenant_names(rows, jwt);
    render_audit_table(rows);

    document.getElementById('btn-anterior').disabled = _audit_offset === 0;
    document.getElementById('btn-siguiente').disabled = rows.length < _audit_limit;
    document.getElementById('paginacion-info').textContent =
      rows.length ? ('Mostrando ' + (_audit_offset + 1) + '–' + (_audit_offset + rows.length)) : 'Sin registros';
  } catch (err) {
    show_error('Error cargando auditoría');
  }
}

// Resuelve tenant_id → nombre/empresa para los registros de la página (admin ve todos).
async function resolve_tenant_names(rows, jwt) {
  var ids = [];
  for (var i = 0; i < rows.length; i++) {
    var t = rows[i].tenant_id;
    if (t && !_tenant_names[t] && ids.indexOf(t) === -1) ids.push(t);
  }
  if (ids.length === 0) return;
  try {
    var tenants = await supabase_fetch(
      '/tenants?id=in.(' + ids.join(',') + ')&select=id,type,company_name,first_name,last_name', jwt) || [];
    for (var j = 0; j < tenants.length; j++) {
      var tn = tenants[j];
      _tenant_names[tn.id] = tn.type === 'juridica'
        ? (tn.company_name || tn.id)
        : (((tn.first_name || '') + ' ' + (tn.last_name || '')).trim() || tn.id);
    }
  } catch (_e) { /* si falla, se muestra el id crudo */ }
}

function _event_label(v) {
  for (var i = 0; i < AUDIT_EVENTS.length; i++) {
    if (AUDIT_EVENTS[i].v === v) return AUDIT_EVENTS[i].l;
  }
  return v; // evento no catalogado (p. ej. legacy) → crudo
}

function format_event_data(data) {
  if (!data || typeof data !== 'object') return '—';
  var parts = [];
  for (var k in data) {
    if (Object.prototype.hasOwnProperty.call(data, k)) parts.push(k + ': ' + String(data[k]));
  }
  return parts.length ? parts.join(' · ') : '—';
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
    var who = r.tenant_id ? (_tenant_names[r.tenant_id] || r.tenant_id) : '—';
    html += '<tr>';
    html += '<td>' + escape_html(format_date(r.created_at)) + '</td>';
    html += '<td><span class="badge badge-neutral">' + escape_html(_event_label(r.event_type)) + '</span></td>';
    html += '<td class="text-sm">' + escape_html(who) + '</td>';
    html += '<td class="text-xs">' + escape_html(format_event_data(r.event_data)) + '</td>';
    html += '<td class="text-mono text-xs">' + escape_html(r.ip || '—') + '</td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}
