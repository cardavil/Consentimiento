// Signer-side field rendering for firma mode: renders the PDF with pdf.js and
// overlays fillable widgets (firma pad / fecha / iniciales / checkbox / texto).
// Exposes window.firma_fields with render/get_values/all_required_filled.
(function () {
  var _fields = [];
  var _values = {};
  var _on_change = null;

  function b64_to_bytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function render(container_id, bytes, fields, on_change) {
    _fields = fields || [];
    _values = {};
    _on_change = on_change || function () {};

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    var pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    var container = document.getElementById(container_id);
    container.innerHTML = '';
    var overlays = [];

    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var viewport = page.getViewport({ scale: 1.3 });
      var wrap = document.createElement('div');
      wrap.className = 'pdf-page-wrap';
      wrap.style.width = viewport.width + 'px';
      wrap.style.height = viewport.height + 'px';
      var canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      wrap.appendChild(canvas);
      var overlay = document.createElement('div');
      overlay.className = 'pdf-overlay';
      wrap.appendChild(overlay);
      container.appendChild(wrap);
      overlays[i - 1] = overlay;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
    }

    for (var f = 0; f < _fields.length; f++) render_field(_fields[f], overlays[_fields[f].page]);
    _on_change();
  }

  function render_field(field, overlay) {
    if (!overlay) return;
    var box = document.createElement('div');
    box.className = 'field-fill';
    box.style.left = (field.x * 100) + '%';
    box.style.top = (field.y * 100) + '%';
    box.style.width = (field.w * 100) + '%';
    box.style.height = (field.h * 100) + '%';
    box.title = field.label || field.type;

    if (field.type === 'firma') {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost btn-sm';
      btn.style.width = '100%'; btn.style.height = '100%';
      btn.textContent = 'Firmar';
      btn.addEventListener('click', function () {
        open_sig_pad(function (dataurl) {
          _values[field.key] = dataurl;
          btn.textContent = '✓ Firmado';
          mark(box, true);
          _on_change();
        });
      });
      box.appendChild(btn);
    } else if (field.type === 'checkbox') {
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', function () { _values[field.key] = cb.checked ? 'true' : ''; mark(box, cb.checked); _on_change(); });
      box.appendChild(cb);
    } else {
      var input = document.createElement('input');
      input.type = 'text';
      if (field.type === 'fecha') {
        input.value = new Date().toLocaleDateString('es-CO');
        input.readOnly = true;
        _values[field.key] = input.value;
      }
      input.addEventListener('input', function () { _values[field.key] = input.value; mark(box, !!input.value); _on_change(); });
      box.appendChild(input);
    }

    if (field.required) box.classList.add('field-fill-pending');
    overlay.appendChild(box);
  }

  function mark(box, filled) {
    if (filled) box.classList.remove('field-fill-pending');
    else box.classList.add('field-fill-pending');
  }

  function all_required_filled() {
    for (var i = 0; i < _fields.length; i++) {
      var f = _fields[i];
      if (f.required && (!_values[f.key] || _values[f.key] === '')) return false;
    }
    return true;
  }

  function get_values() {
    return _fields.map(function (f) { return { key: f.key, value: _values[f.key] || '' }; });
  }

  // --- Signature pad (modal) ---
  function open_sig_pad(on_done) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-visible';
    overlay.innerHTML =
      '<div class="modal-content text-center">' +
      '<div class="modal-header"><h3>Dibuja tu firma</h3></div>' +
      '<canvas class="sig-pad"></canvas>' +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn-outline" data-act="clear">Limpiar</button>' +
      '<button type="button" class="btn btn-ghost" data-act="cancel">Cancelar</button>' +
      '<button type="button" class="btn btn-primary" data-act="save">Guardar</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    var canvas = overlay.querySelector('.sig-pad');
    canvas.width = 360; canvas.height = 140;
    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1E2A3A';
    var drawing = false, has_ink = false;

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) * (canvas.width / r.width), y: (p.clientY - r.top) * (canvas.height / r.height) };
    }
    function down(e) { drawing = true; has_ink = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); }
    function move(e) { if (!drawing) return; var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); }
    function up() { drawing = false; }
    canvas.addEventListener('mousedown', down); canvas.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down); canvas.addEventListener('touchmove', move); canvas.addEventListener('touchend', up);

    overlay.addEventListener('click', function (e) {
      var act = e.target.getAttribute('data-act');
      if (act === 'clear') { ctx.clearRect(0, 0, canvas.width, canvas.height); has_ink = false; }
      else if (act === 'cancel') { overlay.remove(); }
      else if (act === 'save') {
        if (!has_ink) { show_error('Dibuja tu firma primero.'); return; }
        var dataurl = canvas.toDataURL('image/png');
        overlay.remove();
        on_done(dataurl);
      }
    });
  }

  window.firma_fields = { render: render, get_values: get_values, all_required_filled: all_required_filled, b64_to_bytes: b64_to_bytes };
})();
