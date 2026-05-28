let _modal_on_close = null;

function open_modal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('modal-visible');
  const first_input = overlay.querySelector('select, input:not([type="checkbox"]):not([readonly])');
  if (first_input) first_input.focus();
}

function close_all_modals() {
  const overlays = document.querySelectorAll('.modal-overlay');
  for (let i = 0; i < overlays.length; i++) {
    overlays[i].classList.remove('modal-visible');
  }
  if (_modal_on_close) _modal_on_close();
}

function bind_modals(on_close) {
  _modal_on_close = on_close || null;

  const close_btns = document.querySelectorAll('[data-cerrar-modal]');
  for (let j = 0; j < close_btns.length; j++) {
    close_btns[j].addEventListener('click', close_all_modals);
  }

  const overlays = document.querySelectorAll('.modal-overlay');
  for (let k = 0; k < overlays.length; k++) {
    overlays[k].addEventListener('click', function (e) {
      if (e.target === this) close_all_modals();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close_all_modals();
  });
}
