document.addEventListener('DOMContentLoaded', async function () {
  const session = await get_session();
  if (!session) { window.location.href = 'login.html'; return; }

  const meta = session.user.app_metadata || {};
  if (!meta.org_id) { window.location.href = 'login.html'; return; }

  try {
    const org = await supabase_fetch(
      '/organizations?id=eq.' + meta.org_id + '&select=type,first_name,last_name,company_name,plan,email,phone',
      session.access_token
    );
    render_app_header({ container_id: 'app-header', session: session, org: org && org[0], on_logout: onb_sign_out });
  } catch (_e) {
    render_app_header({ container_id: 'app-header', session: session, on_logout: onb_sign_out });
  }

  await handle_oauth_return();
  await load_status();

  document.getElementById('btn-google').addEventListener('click', () => start_oauth('google_workspace'));
  document.getElementById('btn-microsoft').addEventListener('click', () => start_oauth('microsoft_365'));
});

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

async function onb_sign_out() {
  const client = init_supabase();
  await client.auth.signOut();
  window.location.href = 'login.html';
}
