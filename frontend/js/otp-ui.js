let _otp_bound = false;

function init_otp(btn_verify_id) {
  const inputs = document.querySelectorAll('.otp-digito');
  for (let i = 0; i < inputs.length; i++) inputs[i].value = '';

  if (!_otp_bound) {
    for (let j = 0; j < inputs.length; j++) {
      inputs[j].addEventListener('input', (e) => _on_otp_input(e, btn_verify_id));
      inputs[j].addEventListener('keydown', _on_otp_keydown);
      inputs[j].addEventListener('paste', (e) => _on_otp_paste(e, btn_verify_id));
    }
    _otp_bound = true;
  }

  inputs[0].focus();
}

function _on_otp_input(e, btn_verify_id) {
  const val = e.target.value.replace(/[^0-9]/g, '');
  e.target.value = val;
  if (val && e.target.nextElementSibling && e.target.nextElementSibling.classList.contains('otp-digito')) {
    e.target.nextElementSibling.focus();
  }
  _check_otp_complete(btn_verify_id);
}

function _on_otp_keydown(e) {
  if (e.key === 'Backspace' && !e.target.value) {
    const prev = e.target.previousElementSibling;
    if (prev && prev.classList.contains('otp-digito')) {
      prev.focus();
      prev.value = '';
    }
  }
}

function _on_otp_paste(e, btn_verify_id) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
  const digits = text.split('');
  const inputs = document.querySelectorAll('.otp-digito');
  for (let i = 0; i < Math.min(digits.length, inputs.length); i++) {
    inputs[i].value = digits[i];
  }
  const last = Math.min(digits.length, inputs.length) - 1;
  if (last >= 0) inputs[last].focus();
  _check_otp_complete(btn_verify_id);
}

function _check_otp_complete(btn_verify_id) {
  const btn = document.getElementById(btn_verify_id);
  if (btn) btn.disabled = get_otp_code().length !== 6;
}

function get_otp_code() {
  const inputs = document.querySelectorAll('.otp-digito');
  let code = '';
  for (let i = 0; i < inputs.length; i++) code += inputs[i].value;
  return code;
}

function clear_otp(btn_verify_id) {
  const inputs = document.querySelectorAll('.otp-digito');
  for (let i = 0; i < inputs.length; i++) inputs[i].value = '';
  const btn = document.getElementById(btn_verify_id);
  if (btn) btn.disabled = true;
  if (inputs.length) inputs[0].focus();
}

function start_timer(state_obj) {
  state_obj.seconds_remaining = 60;
  const btn_resend = document.getElementById('btn-reenviar');
  const span_timer = document.getElementById('otp-timer');

  btn_resend.hidden = true;
  span_timer.hidden = false;
  span_timer.textContent = '60s';

  if (state_obj.timer_id) clearInterval(state_obj.timer_id);

  state_obj.timer_id = setInterval(() => {
    state_obj.seconds_remaining--;
    span_timer.textContent = state_obj.seconds_remaining + 's';
    if (state_obj.seconds_remaining <= 0) {
      clearInterval(state_obj.timer_id);
      span_timer.hidden = true;
      btn_resend.hidden = false;
      btn_resend.disabled = false;
    }
  }, 1000);
}
