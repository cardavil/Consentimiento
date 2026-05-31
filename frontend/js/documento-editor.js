// Visual field editor: renders the source PDF with pdf.js and lets the client
// drag field widgets (firma/fecha/iniciales/checkbox/texto) onto the pages.
var _fields = [];          // {key,type,label,required,page,x,y,w,h} normalized 0–1
var _selected = null;      // currently selected field
var _doc = { id: null, name: null, page_count: 0 };
var _overlays = [];        // overlay element per page

var DEFAULT_SIZE = {
  firma: { w: 0.25, h: 0.08 }, fecha: { w: 0.18, h: 0.04 },
  iniciales: { w: 0.10, h: 0.05 }, checkbox: { w: 0.04, h: 0.03 }, texto: { w: 0.30, h: 0.04 },
};

document.addEventListener('DOMContentLoaded', async function () {
  const ctx = await init_app_page();
  if (!ctx) return;

  const params = new URLSearchParams(window.location.search);
  _doc.id = params.get('doc_id');
  _doc.name = params.get('doc_name') || 'documento.pdf';
  const template_id = params.get('template_id');
  document.getElementById('editor-doc-name').textContent = _doc.name;

  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => add_field(b.dataset.add)));
  document.getElementById('cfg-label').addEventListener('input', on_cfg_change);
  document.getElementById('cfg-required').addEventListener('change', on_cfg_change);
  document.getElementById('cfg-delete').addEventListener('click', delete_selected);
  document.getElementById('btn-guardar-tpl').addEventListener('click', save_template);
  document.getElementById('btn-usar').addEventListener('click', use_inline);

  if (template_id) await load_template(template_id);
  await render_pdf();
});

async function render_pdf() {
  if (!_doc.id) { document.getElementById('pdf-pages').innerHTML = '<p class="text-danger">Falta el documento.</p>'; return; }
  let bytes;
  try {
    const data = await call_edge_function('drive-service', { action: 'download_b64', file_id: _doc.id });
    bytes = b64_to_bytes(data.bytes_b64);
  } catch (e) {
    document.getElementById('pdf-pages').innerHTML = '<p class="text-danger">' + escape_html(user_message(e.message)) + '</p>';
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  _doc.page_count = pdf.numPages;

  const container = document.getElementById('pdf-pages');
  container.innerHTML = '';
  _overlays = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: CONFIG.pdf_scale });
    const wrap = document.createElement('div');
    wrap.className = 'pdf-page-wrap';
    wrap.style.width = viewport.width + 'px';
    wrap.style.height = viewport.height + 'px';
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    wrap.appendChild(canvas);
    const overlay = document.createElement('div');
    overlay.className = 'pdf-overlay';
    overlay.dataset.page = String(i - 1);
    wrap.appendChild(overlay);
    container.appendChild(wrap);
    _overlays[i - 1] = overlay;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
  }

  for (const f of _fields) render_box(f);
}

function add_field(type) {
  const size = DEFAULT_SIZE[type] || DEFAULT_SIZE.texto;
  const field = { key: 'f_' + Date.now() + '_' + Math.floor(performance.now()), type: type,
    label: type, required: type === 'firma', page: 0, x: 0.1, y: 0.1, w: size.w, h: size.h };
  _fields.push(field);
  render_box(field);
  select_field(field);
}

function render_box(field) {
  const overlay = _overlays[field.page];
  if (!overlay) return;
  const box = document.createElement('div');
  box.className = 'field-box';
  box.dataset.key = field.key;
  box.style.left = (field.x * 100) + '%';
  box.style.top = (field.y * 100) + '%';
  box.style.width = (field.w * 100) + '%';
  box.style.height = (field.h * 100) + '%';
  box.textContent = field.label;
  box.addEventListener('mousedown', (e) => start_drag(e, field, box, overlay));
  overlay.appendChild(box);
}

function start_drag(e, field, box, overlay) {
  e.preventDefault();
  select_field(field);
  const rect = overlay.getBoundingClientRect();
  const offset_x = e.clientX - box.getBoundingClientRect().left;
  const offset_y = e.clientY - box.getBoundingClientRect().top;

  function move(ev) {
    let x = (ev.clientX - rect.left - offset_x) / rect.width;
    let y = (ev.clientY - rect.top - offset_y) / rect.height;
    x = Math.max(0, Math.min(1 - field.w, x));
    y = Math.max(0, Math.min(1 - field.h, y));
    field.x = x; field.y = y;
    box.style.left = (x * 100) + '%';
    box.style.top = (y * 100) + '%';
  }
  function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function select_field(field) {
  _selected = field;
  document.getElementById('field-config').hidden = false;
  document.getElementById('cfg-label').value = field.label;
  document.getElementById('cfg-required').checked = field.required;
  document.querySelectorAll('.field-box').forEach((b) => b.classList.toggle('field-box-sel', b.dataset.key === field.key));
}

function on_cfg_change() {
  if (!_selected) return;
  _selected.label = document.getElementById('cfg-label').value;
  _selected.required = document.getElementById('cfg-required').checked;
  const box = document.querySelector('.field-box[data-key="' + _selected.key + '"]');
  if (box) box.textContent = _selected.label;
}

function delete_selected() {
  if (!_selected) return;
  _fields = _fields.filter((f) => f.key !== _selected.key);
  const box = document.querySelector('.field-box[data-key="' + _selected.key + '"]');
  if (box) box.remove();
  _selected = null;
  document.getElementById('field-config').hidden = true;
}

async function load_template(id) {
  try {
    const rows = await supabase_fetch('/signing_templates?id=eq.' + id + '&select=fields', (await get_session()).access_token);
    if (rows && rows[0] && rows[0].fields) _fields = rows[0].fields;
  } catch (_e) {}
}

async function save_template() {
  const name = document.getElementById('tpl-name').value.trim();
  if (!name) { show_error('Ponle un nombre a la plantilla.'); return; }
  if (_fields.length === 0) { show_error('Agrega al menos un campo.'); return; }
  const btn = document.getElementById('btn-guardar-tpl');
  set_button_loading(btn, 'Guardando...');
  try {
    await call_edge_function('signing-service', {
      action: 'create_template', name: name, fields: _fields,
      source_file_name: _doc.name, page_count: _doc.page_count,
    });
    show_success('Plantilla guardada');
    window.location.href = 'plantillas.html';
  } catch (e) {
    show_error(user_message(e.message));
  } finally {
    reset_button(btn, 'Guardar plantilla');
  }
}

function use_inline() {
  if (_fields.length === 0) { show_error('Agrega al menos un campo.'); return; }
  sessionStorage.setItem('firma_inline', JSON.stringify({
    doc_id: _doc.id, doc_name: _doc.name, page_count: _doc.page_count, fields: _fields,
  }));
  window.location.href = 'documento-solicitar.html';
}

function b64_to_bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

