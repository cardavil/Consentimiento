function render_app_header(opts) {
  var el = document.getElementById(opts.container_id || 'app-header');
  if (!el) return;

  var session = opts.session;
  var meta = session.user.app_metadata || {};
  var email = session.user.email;
  var display_name = _header_display_name(opts.org, email);
  var initials = _header_initials(display_name);

  var has_org = !!meta.org_id;
  var has_platform = !!meta.platform_role;
  var platform_label = meta.platform_role === 'admin' ? 'Admin' : 'Analista';

  var in_admin = window.location.pathname.indexOf('/admin/') !== -1;
  var org_link = in_admin ? '../dashboard.html' : 'dashboard.html';
  var admin_link = in_admin ? 'index.html' : 'admin/index.html';

  var html = '<a class="brand" href="' + (has_org ? org_link : '#') + '">Consen<em>tia</em></a>';
  html += '<div class="header-actions">';
  html += '<div class="header-dropdown-wrap">';
  html += '<div class="header-avatar" id="header-avatar-btn" role="button" tabindex="0" aria-label="Menú de usuario">' + escape_html(initials) + '</div>';
  html += '<div class="header-dropdown" id="header-dropdown">';

  html += '<div class="header-dropdown-user">';
  html += '<div class="header-dropdown-name">' + escape_html(display_name) + '</div>';
  html += '<div class="header-dropdown-email">' + escape_html(email) + '</div>';
  html += '<div class="header-dropdown-badges">';
  if (has_platform) html += '<span class="badge ' + (in_admin ? 'badge-teal' : 'badge-neutral') + '">' + escape_html(platform_label) + '</span>';
  if (has_org) html += '<span class="badge ' + (!in_admin ? 'badge-teal' : 'badge-neutral') + '">Organización</span>';
  html += '</div></div>';

  if (has_org && in_admin) {
    html += '<a href="' + org_link + '" class="header-dropdown-item">Mi organización</a>';
  }
  if (has_platform && !in_admin) {
    html += '<a href="' + admin_link + '" class="header-dropdown-item">Panel Admin</a>';
  }

  html += '<div class="header-dropdown-divider"></div>';
  html += '<button class="header-dropdown-item" disabled>Configuración</button>';
  html += '<button class="header-dropdown-item" disabled>Perfil</button>';
  html += '<div class="header-dropdown-divider"></div>';
  html += '<button class="header-dropdown-item header-dropdown-danger" id="header-logout">Cerrar sesión</button>';

  html += '</div></div></div>';
  el.innerHTML = html;

  _header_bind(opts.on_logout);
}

function _header_bind(on_logout) {
  var avatar = document.getElementById('header-avatar-btn');
  var dropdown = document.getElementById('header-dropdown');

  avatar.addEventListener('click', function (e) {
    e.stopPropagation();
    dropdown.classList.toggle('header-dropdown-open');
  });

  avatar.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dropdown.classList.toggle('header-dropdown-open');
    }
  });

  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target) && e.target !== avatar) {
      dropdown.classList.remove('header-dropdown-open');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dropdown.classList.remove('header-dropdown-open');
  });

  document.getElementById('header-logout').addEventListener('click', function () {
    if (on_logout) on_logout();
  });
}

function _header_display_name(org, email) {
  if (!org) return email;
  return org.company_name || ((org.first_name || '') + ' ' + (org.last_name || '')).trim() || email;
}

function _header_initials(name) {
  var parts = name.split(/[\s@]+/);
  return parts.map(function (w) { return w[0] || ''; }).slice(0, 2).join('').toUpperCase() || '?';
}
