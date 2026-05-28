const state = {
  token: null,
  session: null,
  session_type: null,
  signer_email: null,
  client_ip: null,
  timer_id: null,
  seconds_remaining: 0,
};

document.addEventListener('DOMContentLoaded', () => {
  get_ip().then((ip) => { state.client_ip = ip; }).catch(() => {});
  load_session();
});

async function load_session() {
  const params = new URLSearchParams(window.location.search);
  state.token = params.get('token');

  if (!state.token) {
    show_error_section('No se proporcionó un token de acceso.');
    return;
  }

  try {
    const data = await supabase_fetch(
      '/signing_sessions_results?access_token=eq.' + state.token + '&select=*',
      state.token,
      { method: 'GET' }
    );

    if (!data || data.length === 0) {
      show_error_section('Este enlace no es válido o ha expirado.');
      return;
    }

    state.session = data[0];
    state.session_type = state.session.session_type;

    if (state.session.status === 'expired' || state.session.status === 'cancelled') {
      show_error_section('Este enlace ha expirado o fue cancelado.');
      return;
    }

    if (state.session.status === 'completed') {
      show_error_section('Esta sesión ya fue completada.');
      return;
    }

    await load_temp_data();
    render_session();
  } catch (err) {
    show_error_section('Error al cargar la sesión: ' + err.message);
  }
}

async function load_temp_data() {
  try {
    const temp = await supabase_fetch(
      '/signing_sessions_temp?session_id=eq.' + state.session.id + '&select=*',
      state.token,
      { method: 'GET' }
    );
    if (temp && temp.length > 0) {
      state.temp = temp[0];
      state.signer_email = state.temp.signer ? state.temp.signer.email : null;
    }
  } catch (_err) {
    // temp data may not be accessible via this token
  }
}

function render_session() {
  document.getElementById('seccion-cargando').hidden = true;

  if (state.session_type === 'consent') {
    render_consent_mode();
  } else if (state.session_type === 'firma') {
    document.getElementById('seccion-firma').hidden = false;
  } else {
    show_error_section('Tipo de sesión no reconocido.');
  }
}

function render_consent_mode() {
  document.getElementById('seccion-consent').hidden = false;

  // Signer data
  if (state.temp && state.temp.signer) {
    const s = state.temp.signer;
    const html = '<p><strong>' + escape_html(s.nombre || '') + ' ' + escape_html(s.apellido || '') + '</strong></p>' +
      '<p>' + escape_html(format_doc_type(s.tipoDoc || '')) + ' ' + escape_html(s.numero || '') + '</p>' +
      '<p>' + escape_html(s.email || '') + '</p>';
    document.getElementById('datos-firmante').innerHTML = html;
  }

  document.getElementById('firma-fecha').textContent = format_date();
  document.getElementById('firma-ip').textContent = state.client_ip || '...';

  // Documents
  if (state.temp && state.temp.documents) {
    render_documents(state.temp.documents);
  }

  // Consent items
  if (state.temp && state.temp.consents) {
    render_consents(state.temp.consents);
  }

  bind_consent_events();
}

function render_documents(docs) {
  const container = document.getElementById('documentos-container');
  if (!docs || docs.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted">No hay documentos adjuntos.</p>';
    return;
  }

  let html = '';
  for (const doc of docs) {
    html += '<div style="margin-bottom:var(--spacing-md)">' +
      '<iframe src="https://drive.google.com/file/d/' + escape_html(doc) + '/preview" ' +
      'width="100%" height="400" style="border:1px solid var(--gris-claro);border-radius:var(--radius-sm)" ' +
      'allow="autoplay" loading="lazy"></iframe></div>';
  }
  container.innerHTML = html;
}

function render_consents(consents) {
  const container = document.getElementById('lista-consentimientos');
  let html = '';
  for (const c of consents) {
    const is_required = c.required;
    const id = (c.id || c.code || '').toLowerCase();
    html += '<div class="consentimiento" data-id="' + escape_html(c.id || '') + '">' +
      '<div class="consentimiento-cabecera">' +
      '<span class="consentimiento-titulo-texto">' + escape_html(c.title || c.code || '') + '</span>' +
      '<span class="badge ' + (is_required ? 'badge-danger' : 'badge-neutral') + '">' +
      (is_required ? 'OBLIGATORIO' : 'VOLUNTARIO') + '</span></div>' +
      '<div class="consentimiento-detalle">' +
      '<p>' + escape_html(c.description || '') + '</p>' +
      '<div class="consentimiento-aceptacion">' +
      '<input type="checkbox" id="check-' + escape_html(id) + '" class="consentimiento-check consent-check"' +
      ' data-id="' + escape_html(c.id || '') + '"' +
      ' data-required="' + (is_required ? 'true' : 'false') + '">' +
      '<label for="check-' + escape_html(id) + '">Leí y acepto</label>' +
      '</div></div></div>';
  }
  container.innerHTML = html;
}

function bind_consent_events() {
  const checks = document.querySelectorAll('.consent-check');
  for (const check of checks) {
    check.addEventListener('change', check_required_consents);
  }
  check_required_consents();

  document.getElementById('btn-enviar-otp-firma').addEventListener('click', on_send_otp);
  document.getElementById('btn-verificar-firma').addEventListener('click', on_verify_and_sign);
  document.getElementById('btn-reenviar').addEventListener('click', on_resend_otp);
}

function check_required_consents() {
  const required = document.querySelectorAll('.consent-check[data-required="true"]');
  let all_checked = true;
  for (const cb of required) {
    if (!cb.checked) { all_checked = false; break; }
  }
  document.getElementById('btn-enviar-otp-firma').disabled = !all_checked;
}

// --- OTP ---

async function on_send_otp() {
  const btn = document.getElementById('btn-enviar-otp-firma');
  set_button_loading(btn, 'Enviando...');

  try {
    await call_edge_function('otp-service', {
      action: 'send',
      email: state.signer_email,
      context: 'sign',
    }, state.token);

    document.getElementById('otp-email-firma').textContent = state.signer_email;
    document.getElementById('sub-enviar-otp-firma').hidden = true;
    document.getElementById('sub-ingresar-otp-firma').hidden = false;
    init_otp('btn-verificar-firma');
    start_timer(state);
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Enviar código de verificación');
  }
}

async function on_resend_otp() {
  const btn = document.getElementById('btn-reenviar');
  btn.disabled = true;
  try {
    await call_edge_function('otp-service', {
      action: 'send',
      email: state.signer_email,
      context: 'sign',
    }, state.token);
    show_success('Código reenviado');
    start_timer(state);
  } catch (err) {
    show_error(user_message(err.message));
    btn.disabled = false;
  }
}

async function on_verify_and_sign() {
  const code = get_otp_code();
  if (code.length !== 6) return;

  const btn = document.getElementById('btn-verificar-firma');
  set_button_loading(btn, 'Firmando...');

  try {
    const consents_marked = get_marked_consents();

    const result = await call_edge_function('consent-service', {
      action: 'sign',
      session_id: state.session.id,
      otp_code: code,
      consents: consents_marked,
      ip: state.client_ip,
      user_agent: navigator.userAgent,
    }, state.token);

    show_confirmation(result);
  } catch (err) {
    show_error(user_message(err.message));
    clear_otp('btn-verificar-firma');
  } finally {
    reset_button(btn, 'Firmar');
  }
}

function get_marked_consents() {
  const checks = document.querySelectorAll('.consent-check');
  const result = [];
  for (const cb of checks) {
    result.push({
      id: cb.dataset.id,
      accepted: cb.checked,
    });
  }
  return result;
}

function show_confirmation(result) {
  document.getElementById('seccion-consent').hidden = true;
  document.getElementById('seccion-confirmacion').hidden = false;

  const tbody = document.getElementById('tbody-confirmacion');
  tbody.innerHTML = '';
  if (result && result.summary) {
    for (const r of result.summary) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escape_html(r.code || '') + '</td>' +
        '<td>' + escape_html(r.decision || '') + '</td>' +
        '<td class="text-mono text-xs">' + escape_html(r.folio || '') + '</td>' +
        '<td class="tabla-celda-hash">' + escape_html(r.hash || '') + '</td>';
      tbody.appendChild(tr);
    }
  }

  document.getElementById('confirmacion-fecha').textContent = format_date();
  document.getElementById('confirmacion-ip').textContent = state.client_ip || '';
}

// --- Error display ---

function show_error_section(message) {
  document.getElementById('seccion-cargando').hidden = true;
  document.getElementById('error-mensaje').textContent = message;
  document.getElementById('seccion-error').hidden = false;
}
