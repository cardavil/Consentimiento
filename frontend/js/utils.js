let _doc_types_cache = null;

async function load_doc_types() {
  if (_doc_types_cache) return _doc_types_cache;

  const url = CONFIG.supabase_url + '/rest/v1/catalog_doc_types?active=eq.true&order=sort_order';
  const res = await fetch(url, {
    headers: { 'apikey': CONFIG.supabase_key },
  });
  const rows = await res.json();

  const by_context = {};
  const labels = {};

  for (const row of rows) {
    labels[row.code] = row.label;
    for (const ctx of row.contexts) {
      if (!by_context[ctx]) by_context[ctx] = [];
      by_context[ctx].push({ code: row.code, label: row.label, regex: row.regex });
    }
  }

  _doc_types_cache = { by_context, labels, rows };
  return _doc_types_cache;
}

function get_doc_types_for(context) {
  if (!_doc_types_cache) return [];
  return _doc_types_cache.by_context[context] || [];
}

function get_doc_label(code) {
  if (!_doc_types_cache) return code;
  return _doc_types_cache.labels[code] || code;
}

const ERROR_MESSAGES = {
  ERROR_SERVIDOR: 'Error del servidor. Intenta de nuevo.',
  ERROR_EDGE_FUNCTION: 'Error procesando la solicitud.',
  OTP_EXPIRED: 'El código ha expirado. Solicita uno nuevo.',
  OTP_INVALID: 'Código incorrecto. Verifica e intenta de nuevo.',
  OTP_MAX_ATTEMPTS: 'Demasiados intentos. Solicita un nuevo código.',
  RATE_LIMITED: 'Demasiadas solicitudes. Espera un momento.',
  SESSION_EXPIRED: 'Tu sesión ha expirado. Inicia sesión de nuevo.',
  NETWORK_ERROR: 'Error de conexión. Verifica tu internet.',
  EMAIL_DUPLICADO: 'Este email ya está registrado.',
  DOCUMENTO_DUPLICADO: 'Este documento ya está registrado.',
};

// --- Toast notifications ---

function show_error(message) {
  _show_toast(message, 'error');
}

function show_success(message) {
  _show_toast(message, 'success');
}

function _show_toast(message, type) {
  _remove_existing_toasts();
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function _remove_existing_toasts() {
  const existing = document.querySelectorAll('.toast');
  for (let i = 0; i < existing.length; i++) existing[i].remove();
}

// --- User-friendly error messages ---

function user_message(error_code) {
  return ERROR_MESSAGES[error_code] || error_code || 'Error inesperado.';
}

// --- HTML escape (XSS prevention) ---

function escape_html(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// --- Validation ---

function validate_email(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validate_phone(value) {
  return value.replace(/[\s+\-()]/g, '').length >= 7;
}

function validate_document(type, number) {
  const n = number.trim();
  if (!n) return false;
  if (_doc_types_cache) {
    const row = _doc_types_cache.rows.find((r) => r.code === type);
    if (row && row.regex) return new RegExp(row.regex).test(n);
  }
  return n.length > 0;
}

// --- Button loading state ---

function set_button_loading(btn, text) {
  btn.disabled = true;
  btn.dataset.originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> ' + escape_html(text);
  btn.classList.add('btn-cargando');
}

function reset_button(btn, text) {
  btn.disabled = false;
  btn.textContent = text || btn.dataset.originalText || 'Enviar';
  btn.classList.remove('btn-cargando');
}

// --- Date formatting (Colombia TZ) ---

function format_date(timestamp) {
  const d = timestamp ? new Date(timestamp) : new Date();
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function format_doc_type(type) {
  return get_doc_label(type);
}

// --- IP fetch (for evidence chain) ---

async function get_ip() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch (_e) {
    return null;
  }
}

// --- Debounce ---

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms || CONFIG.debounce_ms);
  };
}
