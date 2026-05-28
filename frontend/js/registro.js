const state = {
  type: null,
  is_juridica: false,
  current_step: 1,
  client_ip: null,
  timer_id: null,
  seconds_remaining: 0,
};

document.addEventListener('DOMContentLoaded', async () => {
  get_ip().then((ip) => { state.client_ip = ip; }).catch(() => {});
  try { await load_doc_types(); } catch (_e) { show_error('Error cargando catálogo de documentos'); }
  bind_events();
});

function bind_events() {
  document.getElementById('tipo-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.tipo-card');
    if (card) on_select_type(card.dataset.tipo);
  });
  document.getElementById('btn-paso-1').addEventListener('click', () => go_to_step(2));
  document.getElementById('btn-volver-1').addEventListener('click', () => show_step(1));
  document.getElementById('btn-paso-2').addEventListener('click', on_continue_step_2);
  document.getElementById('btn-volver-2').addEventListener('click', on_back_from_step_3);
  document.getElementById('check-terminos').addEventListener('change', on_terms_change);
  document.getElementById('btn-enviar-codigo').addEventListener('click', on_send_otp);
  document.getElementById('btn-verificar-otp').addEventListener('click', on_verify_and_register);
  document.getElementById('btn-reenviar').addEventListener('click', on_resend_otp);
  bind_blur_validation();
}

function bind_blur_validation() {
  const fields = [
    'campo-nombre', 'campo-apellido', 'campo-razon-social', 'campo-nit',
    'campo-nombre-firmante', 'campo-apellido-firmante', 'campo-cargo',
    'campo-tipo-doc', 'campo-num-doc', 'campo-email', 'campo-telefono',
  ];
  for (const id of fields) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', (e) => validate_field(e.target.id));
  }
}

// --- Step 1: Type selection ---

function on_select_type(type) {
  state.type = type;
  state.is_juridica = type === 'juridica';

  const cards = document.querySelectorAll('.tipo-card');
  for (const card of cards) {
    card.classList.toggle('seleccionado', card.dataset.tipo === type);
  }
  document.getElementById('btn-paso-1').disabled = false;
}

// --- Step 2: Data ---

function prepare_form() {
  document.getElementById('campos-natural').hidden = state.is_juridica;
  document.getElementById('campos-juridica').hidden = !state.is_juridica;
  populate_doc_types();
}

function populate_doc_types() {
  const select = document.getElementById('campo-tipo-doc');
  const context = state.is_juridica ? 'juridica_signer' : 'natural';
  const types = get_doc_types_for(context);
  select.innerHTML = '<option value="">Seleccionar</option>';
  for (const t of types) {
    select.innerHTML += '<option value="' + t.code + '">' + escape_html(t.label) + '</option>';
  }
}

function on_continue_step_2() {
  if (validate_step_data()) go_to_step(3);
}

function validate_step_data() {
  const results = [];

  if (state.is_juridica) {
    results.push(validate_field('campo-razon-social'));
    results.push(validate_field('campo-nit'));
    results.push(validate_field('campo-nombre-firmante'));
    results.push(validate_field('campo-apellido-firmante'));
    results.push(validate_field('campo-cargo'));
  } else {
    results.push(validate_field('campo-nombre'));
    results.push(validate_field('campo-apellido'));
  }

  results.push(validate_field('campo-tipo-doc'));
  results.push(validate_field('campo-num-doc'));
  results.push(validate_field('campo-email'));
  results.push(validate_field('campo-telefono'));

  return results.every(Boolean);
}

function validate_field(id) {
  const input = document.getElementById(id);
  if (!input || input.hidden || (input.closest && input.closest('[hidden]'))) return true;

  const value = input.value.trim();
  let valid = true;

  switch (id) {
    case 'campo-email':
      valid = validate_email(value); break;
    case 'campo-num-doc':
      const doc_type = document.getElementById('campo-tipo-doc').value;
      valid = doc_type ? validate_document(doc_type, value) : value.length > 0; break;
    case 'campo-nit':
      valid = validate_document('NIT', value); break;
    case 'campo-telefono':
      valid = validate_phone(value); break;
    case 'campo-tipo-doc':
      valid = value.length > 0; break;
    default:
      valid = value.length > 0;
  }

  const error_el = document.getElementById(id + '-error');
  input.classList.toggle('campo-error', !valid);
  input.classList.toggle('campo-valido', valid && value.length > 0);
  if (error_el) error_el.hidden = valid;

  return valid;
}

// --- Step 3: Terms + OTP ---

function on_terms_change() {
  document.getElementById('btn-enviar-codigo').disabled = !document.getElementById('check-terminos').checked;
}

async function on_send_otp() {
  const btn = document.getElementById('btn-enviar-codigo');
  set_button_loading(btn, 'Enviando...');

  try {
    const email = get_email();
    const client = init_supabase();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);

    call_edge_function('otp-service', { action: 'track', email: email, context: 'auth' }).catch(function() {});
    document.getElementById('otp-email-confirmado').textContent = email;
    document.getElementById('sub-enviar-otp').hidden = true;
    document.getElementById('sub-ingresar-otp').hidden = false;
    init_otp('btn-verificar-otp');
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
    const client = init_supabase();
    const { error } = await client.auth.signInWithOtp({
      email: get_email(),
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);

    call_edge_function('otp-service', { action: 'track', email: get_email(), context: 'auth' }).catch(function() {});
    show_success('Código reenviado a ' + get_email());
    start_timer(state);
  } catch (err) {
    show_error(user_message(err.message));
    btn.disabled = false;
  }
}

async function on_verify_and_register() {
  const code = get_otp_code();
  if (code.length !== CONFIG.otp_length) return;

  const btn = document.getElementById('btn-verificar-otp');
  set_button_loading(btn, 'Verificando...');

  try {
    const client = init_supabase();
    const { data, error } = await client.auth.verifyOtp({
      email: get_email(),
      token: code,
      type: 'email',
    });

    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('ERROR_SERVIDOR');

    var jwt = data.session.access_token;
    var reg_res = await fetch(CONFIG.edge_fn_base + '/otp-service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.supabase_key,
        'Authorization': 'Bearer ' + jwt,
      },
      body: JSON.stringify({
        action: 'register',
        org_data: build_org_data(),
        ip: state.client_ip,
        user_agent: navigator.userAgent,
      }),
    });
    var reg_data = await reg_res.json();
    if (!reg_data.ok) throw new Error(reg_data.error || 'ERROR_EDGE_FUNCTION');

    await client.auth.refreshSession();

    document.getElementById('sub-ingresar-otp').hidden = true;
    document.getElementById('seccion-confirmacion').hidden = false;
    document.getElementById('nav-paso-3').hidden = true;
    update_step_indicator(4);

    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
  } catch (err) {
    show_error(user_message(err.message));
    clear_otp('btn-verificar-otp');
  } finally {
    reset_button(btn, 'Registrarme');
  }
}

function build_org_data() {
  if (state.is_juridica) {
    return {
      type: 'juridica',
      company_name: document.getElementById('campo-razon-social').value.trim(),
      company_nit: document.getElementById('campo-nit').value.trim(),
      first_name: document.getElementById('campo-nombre-firmante').value.trim(),
      last_name: document.getElementById('campo-apellido-firmante').value.trim(),
      position: document.getElementById('campo-cargo').value.trim(),
      doc_type: document.getElementById('campo-tipo-doc').value,
      doc_number: document.getElementById('campo-num-doc').value.trim(),
      email: get_email(),
      phone: document.getElementById('campo-telefono').value.trim(),
    };
  }
  return {
    type: 'natural',
    first_name: document.getElementById('campo-nombre').value.trim(),
    last_name: document.getElementById('campo-apellido').value.trim(),
    doc_type: document.getElementById('campo-tipo-doc').value,
    doc_number: document.getElementById('campo-num-doc').value.trim(),
    email: get_email(),
    phone: document.getElementById('campo-telefono').value.trim(),
  };
}

// --- Step navigation ---

function go_to_step(n) {
  if (n === 2) prepare_form();
  if (n === 3) prepare_step_verification();
  show_step(n);
}

function prepare_step_verification() {
  document.getElementById('sub-enviar-otp').hidden = false;
  document.getElementById('sub-ingresar-otp').hidden = true;
  document.getElementById('seccion-confirmacion').hidden = true;
  document.getElementById('nav-paso-3').hidden = false;
  on_terms_change();
}

function show_step(n) {
  state.current_step = n;
  const sections = ['paso-tipo', 'paso-datos', 'paso-verificacion'];
  for (let i = 0; i < sections.length; i++) {
    document.getElementById(sections[i]).hidden = (i !== n - 1);
  }
  update_step_indicator(n);
  window.scrollTo(0, 0);
}

function update_step_indicator(n) {
  for (let i = 1; i <= 3; i++) {
    const circle = document.getElementById('paso-circulo-' + i);
    circle.className = 'paso';
    circle.removeAttribute('aria-current');
    if (i < n) circle.className = 'paso paso-completo';
    else if (i === n) { circle.className = 'paso paso-activo'; circle.setAttribute('aria-current', 'step'); }

    if (i < 3) {
      const line = document.getElementById('paso-linea-' + i);
      line.className = i < n ? 'paso-linea paso-linea-completa' : 'paso-linea';
    }
  }
}

function on_back_from_step_3() {
  if (state.timer_id) clearInterval(state.timer_id);
  show_step(2);
}

// --- Helpers ---

function get_email() {
  return document.getElementById('campo-email').value.trim();
}
