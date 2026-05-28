let _supabase = null;

function init_supabase() {
  if (_supabase) return _supabase;
  _supabase = supabase.createClient(CONFIG.supabase_url, CONFIG.supabase_key);
  return _supabase;
}

async function get_session() {
  const client = init_supabase();
  const { data, error } = await client.auth.getSession();
  if (data && data.session) return data.session;
  return null;
}

async function check_session() {
  const session = await get_session();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function supabase_fetch(path, jwt, options) {
  const url = CONFIG.supabase_url + '/rest/v1' + path;
  const method = (options && options.method) || 'GET';
  const body = (options && options.body) || null;

  const headers = {
    'apikey': CONFIG.supabase_key,
    'Authorization': 'Bearer ' + jwt,
    'Content-Type': 'application/json',
  };

  if (options && options.prefer) {
    headers['Prefer'] = options.prefer;
  }

  const fetch_config = { method, headers };

  if (body && method !== 'GET') {
    fetch_config.body = JSON.stringify(body);
  }

  let response = await fetch(url, fetch_config);

  if (response.status === 401) {
    const refreshed = await _try_refresh();
    if (refreshed) {
      headers['Authorization'] = 'Bearer ' + refreshed.access_token;
      fetch_config.headers = headers;
      response = await fetch(url, fetch_config);
    } else {
      window.location.href = 'login.html';
      return null;
    }
  }

  if (!response.ok) {
    throw new Error('ERROR_SERVIDOR');
  }

  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function call_edge_function(fn_name, body, access_token) {
  const url = CONFIG.edge_fn_base + '/' + fn_name;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': CONFIG.supabase_key,
  };

  if (access_token) {
    headers['x-access-token'] = access_token;
  } else {
    const session = await get_session();
    if (session) {
      headers['Authorization'] = 'Bearer ' + session.access_token;
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'ERROR_EDGE_FUNCTION');
  return data.data;
}

async function sign_out() {
  const client = init_supabase();
  await client.auth.signOut();
  window.location.href = 'login.html';
}

// Shared bootstrap for authenticated org pages: validates session + org, loads the
// org row, renders the header. Returns { session, org_id, jwt, org } or null (redirected).
async function init_app_page(opts) {
  opts = opts || {};
  const session = await get_session();
  if (!session) { window.location.href = 'login.html'; return null; }
  const meta = session.user.app_metadata || {};
  if (!meta.org_id) { window.location.href = 'login.html'; return null; }

  const select = opts.select || 'type,first_name,last_name,company_name,plan,email,phone';
  let org = null;
  try {
    const rows = await supabase_fetch('/organizations?id=eq.' + meta.org_id + '&select=' + select, session.access_token);
    if (rows && rows.length > 0) org = rows[0];
  } catch (_e) { /* header still renders without org */ }

  if (opts.header !== false) {
    render_app_header({ container_id: 'app-header', session: session, org: org, on_logout: sign_out });
  }
  return { session: session, org_id: meta.org_id, jwt: session.access_token, org: org };
}

async function _try_refresh() {
  try {
    const client = init_supabase();
    const { data } = await client.auth.refreshSession();
    if (data && data.session) return data.session;
    return null;
  } catch (_e) {
    return null;
  }
}
