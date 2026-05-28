const state = {
  email: null,
  timer_id: null,
  seconds_remaining: 0,
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-email').addEventListener('submit', on_submit_email);
  document.getElementById('btn-verificar-otp').addEventListener('click', on_verify_otp);
  document.getElementById('btn-reenviar').addEventListener('click', on_resend_otp);
  document.getElementById('btn-volver-email').addEventListener('click', on_back_to_email);
});

async function on_submit_email(e) {
  e.preventDefault();
  const input = document.getElementById('campo-email');
  const email = input.value.trim();

  if (!validate_email(email)) {
    input.classList.add('campo-error');
    document.getElementById('email-error').hidden = false;
    return;
  }

  input.classList.remove('campo-error');
  document.getElementById('email-error').hidden = true;

  const btn = document.getElementById('btn-enviar-email');
  set_button_loading(btn, 'Enviando...');

  try {
    const client = init_supabase();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);

    call_edge_function('otp-service', { action: 'track', email: email, context: 'auth' }).catch(function() {});
    state.email = email;
    show_otp_phase();
  } catch (err) {
    show_error(user_message(err.message));
  } finally {
    reset_button(btn, 'Enviar código de verificación');
  }
}

function show_otp_phase() {
  document.getElementById('fase-email').hidden = true;
  document.getElementById('fase-otp').hidden = false;
  document.getElementById('otp-email-destino').textContent = state.email;
  init_otp('btn-verificar-otp');
  start_timer(state);
}

async function on_verify_otp() {
  const code = get_otp_code();
  if (code.length !== CONFIG.otp_length) return;

  const btn = document.getElementById('btn-verificar-otp');
  set_button_loading(btn, 'Verificando...');

  try {
    const client = init_supabase();
    const { data, error } = await client.auth.verifyOtp({
      email: state.email,
      token: code,
      type: 'email',
    });

    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('ERROR_SERVIDOR');

    const meta = data.session.user.app_metadata || {};
    if (meta.platform_role) {
      window.location.href = 'admin/index.html';
    } else if (meta.org_id) {
      window.location.href = 'dashboard.html';
    } else {
      throw new Error('CUENTA_SIN_ORG');
    }
  } catch (err) {
    show_error(user_message(err.message));
    clear_otp('btn-verificar-otp');
  } finally {
    reset_button(btn, 'Verificar');
  }
}

async function on_resend_otp() {
  const btn = document.getElementById('btn-reenviar');
  btn.disabled = true;
  try {
    const client = init_supabase();
    const { error } = await client.auth.signInWithOtp({
      email: state.email,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);

    call_edge_function('otp-service', { action: 'track', email: state.email, context: 'auth' }).catch(function() {});
    show_success('Código reenviado a ' + state.email);
    start_timer(state);
  } catch (err) {
    show_error(user_message(err.message));
    btn.disabled = false;
  }
}

function on_back_to_email() {
  if (state.timer_id) clearInterval(state.timer_id);
  document.getElementById('fase-otp').hidden = true;
  document.getElementById('fase-email').hidden = false;
  document.getElementById('campo-email').focus();
}
