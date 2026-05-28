document.addEventListener('DOMContentLoaded', async function () {
  const ctx = await init_app_page();
  if (!ctx) return;

  await handle_oauth_return();
  await load_status();

  document.getElementById('btn-google').addEventListener('click', () => start_oauth('google_workspace'));
  document.getElementById('btn-microsoft').addEventListener('click', () => start_oauth('microsoft_365'));

  bind_channel_buttons();
  await load_channels();
});

function bind_channel_buttons() {
  document.getElementById('btn-wa-save').addEventListener('click', save_whatsapp);
  document.getElementById('btn-wa-test').addEventListener('click', () => test_channel('whatsapp'));
  document.getElementById('btn-sms-save').addEventListener('click', save_sms);
  document.getElementById('btn-sms-test').addEventListener('click', () => test_channel('sms'));
  document.getElementById('btn-sms-gen').addEventListener('click', gen_sms_secrets);
}

async function load_channels() {
  try {
    const c = await call_edge_function('config-service', { action: 'get_config' });
    if (c.whatsapp) {
      document.getElementById('wa-phone-id').value = c.whatsapp.phone_number_id || '';
      document.getElementById('wa-display').value = c.whatsapp.display_phone || '';
      set_channel_badge('wa-badge', c.whatsapp.enabled);
    }
    if (c.sms) {
      document.getElementById('sms-url').value = c.sms.gateway_url || '';
      set_channel_badge('sms-badge', c.sms.enabled);
    }
  } catch (_e) {}
}

function set_channel_badge(id, enabled) {
  const b = document.getElementById(id);
  if (!b) return;
  b.className = enabled ? 'badge badge-success' : 'badge badge-warning';
  b.textContent = enabled ? 'Configurado' : 'No configurado';
}

async function save_whatsapp() {
  const btn = document.getElementById('btn-wa-save');
  set_button_loading(btn, 'Guardando...');
  try {
    await call_edge_function('config-service', {
      action: 'set_whatsapp',
      phone_number_id: document.getElementById('wa-phone-id').value.trim(),
      waba_id: document.getElementById('wa-waba-id').value.trim(),
      access_token: document.getElementById('wa-token').value.trim(),
      display_phone: document.getElementById('wa-display').value.trim(),
      enabled: true,
    });
    show_success('WhatsApp guardado');
    set_channel_badge('wa-badge', true);
  } catch (e) { show_error(user_message(e.message)); }
  finally { reset_button(btn, 'Guardar WhatsApp'); }
}

function gen_sms_secrets() {
  document.getElementById('sms-apikey').value = crypto.randomUUID().replace(/-/g, '');
  document.getElementById('sms-hmac').value = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const pairing = document.getElementById('sms-pairing');
  pairing.hidden = false;
  pairing.textContent = 'Vincula la app con: ' + JSON.stringify({
    url: document.getElementById('sms-url').value.trim(),
    api_key: document.getElementById('sms-apikey').value,
    hmac_secret: document.getElementById('sms-hmac').value,
  });
}

async function save_sms() {
  const btn = document.getElementById('btn-sms-save');
  set_button_loading(btn, 'Guardando...');
  try {
    await call_edge_function('config-service', {
      action: 'set_sms',
      gateway_url: document.getElementById('sms-url').value.trim(),
      api_key: document.getElementById('sms-apikey').value.trim(),
      hmac_secret: document.getElementById('sms-hmac').value.trim(),
      enabled: true,
    });
    show_success('SMS guardado');
    set_channel_badge('sms-badge', true);
  } catch (e) { show_error(user_message(e.message)); }
  finally { reset_button(btn, 'Guardar SMS'); }
}

async function test_channel(channel) {
  const phone = prompt('Número de prueba (con indicativo, ej. +573000000000):');
  if (!phone) return;
  try {
    await call_edge_function('config-service', { action: 'test', channel: channel, phone: phone.trim() });
    show_success('Mensaje de prueba enviado');
  } catch (e) { show_error(user_message(e.message)); }
}

async function start_oauth(provider) {
  try {
    const data = await call_edge_function('drive-service', { action: 'oauth_start', provider: provider });
    sessionStorage.setItem('oauth_state', data.state);
    window.location.href = data.auth_url;
  } catch (e) {
    show_error(user_message(e.message));
  }
}

async function handle_oauth_return() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const oauth_error = params.get('error');

  if (oauth_error) { show_error('Conexión cancelada o rechazada.'); clean_url(); return; }
  if (!code || !state) return;

  const provider = state.split(':')[0];
  const status_el = document.getElementById('onb-status');
  status_el.innerHTML = '<span class="spinner"></span> Conectando tu cuenta…';

  try {
    await call_edge_function('drive-service', { action: 'oauth_callback', provider: provider, code: code });
    show_success('Cuenta conectada correctamente.');
  } catch (e) {
    show_error(user_message(e.message));
  }
  clean_url();
}

function clean_url() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

async function load_status() {
  try {
    const s = await call_edge_function('drive-service', { action: 'get_status' });
    render_status(s);
  } catch (_e) {
    render_status({ connected: false });
  }
}

function render_status(s) {
  const box = document.getElementById('onb-connected');
  const status_el = document.getElementById('onb-status');

  if (!s || !s.connected) {
    status_el.innerHTML = '<span class="badge badge-warning">Sin nube conectada</span>';
    box.hidden = true;
    return;
  }

  const provider_label = s.provider === 'microsoft_365' ? 'Microsoft 365' : 'Google Workspace';
  status_el.innerHTML = '<span class="badge badge-success">Conectado</span>';
  box.hidden = false;
  box.innerHTML =
    '<p class="text-sm"><strong>Proveedor:</strong> ' + escape_html(provider_label) + '</p>' +
    '<p class="text-sm"><strong>Correo emisor:</strong> ' + escape_html(s.sender_email || '—') + '</p>' +
    '<p class="text-xs text-muted">Las constancias se guardan en tu carpeta «Consentia».</p>' +
    '<button id="btn-disconnect" class="btn btn-danger btn-sm mt-sm">Desconectar</button>';

  document.getElementById('btn-disconnect').addEventListener('click', disconnect);
}

async function disconnect() {
  try {
    await call_edge_function('drive-service', { action: 'disconnect' });
    show_success('Cuenta desconectada.');
    render_status({ connected: false });
  } catch (e) {
    show_error(user_message(e.message));
  }
}

