function render_app_header(opts) {
  var el = document.getElementById(opts.container_id || 'app-header');
  if (!el) return;

  var session = opts.session;
  var meta = session.user.app_metadata || {};
  var email = session.user.email;
  var id = _header_identity(opts.tenant, opts.profile, email);

  var has_tenant = !!meta.tenant_id;
  var has_platform = !!meta.platform_role;
  var platform_label = meta.platform_role === 'admin' ? 'Admin' : 'Analista';

  var in_admin = window.location.pathname.indexOf('/admin/') !== -1;
  var tenant_link = in_admin ? '../dashboard.html' : 'dashboard.html';
  var admin_link = in_admin ? 'index.html' : 'admin/index.html';

  var page_title = document.title.split('|')[0].trim();
  var html = '<a class="brand" href="' + (has_tenant ? tenant_link : '#') + '">Consen<em>tia</em></a>';
  html += '<span class="header-separator">|</span>';
  html += '<span class="header-page-title">' + escape_html(page_title) + '</span>';
  html += '<div class="header-actions">';
  html += '<div class="header-dropdown-wrap">';
  html += '<div class="header-avatar" id="header-avatar-btn" role="button" tabindex="0" aria-label="Menú de usuario">';
  html += '<span class="avatar-initials">' + escape_html(id.initials) + '</span>';
  if (id.company_initial) html += '<span class="avatar-company">@' + escape_html(id.company_initial) + '</span>';
  html += '</div>';
  html += '<div class="header-dropdown" id="header-dropdown">';

  html += '<div class="header-dropdown-user">';
  html += '<div class="header-dropdown-name">' + escape_html(id.name) + '</div>';
  if (id.company) html += '<div class="header-dropdown-company">@ ' + escape_html(id.company) + '</div>';
  html += '<div class="header-dropdown-badges">';
  if (has_platform) html += '<span class="badge ' + (in_admin ? 'badge-teal' : 'badge-neutral') + '">' + escape_html(platform_label) + '</span>';
  if (has_tenant && opts.tenant) {
    var tipo_label = opts.tenant.type === 'juridica' ? 'Jurídica' : 'Natural';
    html += '<span class="badge ' + (!in_admin ? 'badge-teal' : 'badge-neutral') + '">' + escape_html(tipo_label) + '</span>';
    if (opts.tenant.plan) html += '<span class="badge badge-neutral">' + escape_html(opts.tenant.plan.toUpperCase()) + '</span>';
  } else if (has_tenant) {
    html += '<span class="badge ' + (!in_admin ? 'badge-teal' : 'badge-neutral') + '">Inscrito</span>';
  }
  html += '</div></div>';

  if (in_admin) {
    // El admin siempre ve "Mi cuenta"; inactiva si aún no tiene inscrito asociado.
    if (has_tenant) {
      html += '<a href="' + tenant_link + '" class="header-dropdown-item">Mi cuenta</a>';
    } else {
      html += '<button class="header-dropdown-item" disabled title="Sin inscrito asociado">Mi cuenta</button>';
    }
  }
  if (has_platform && !in_admin) {
    html += '<a href="' + admin_link + '" class="header-dropdown-item">Panel Admin</a>';
  }

  html += '<div class="header-dropdown-divider"></div>';
  // Placeholders deshabilitados — config de cuenta y perfil pendientes (post-MVP).
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

// Deriva identidad para el header, desde el inscrito (tenant) o el perfil de plataforma
// (admin/analyst), o el email como último recurso.
//  - initials: inicial(nombre)+inicial(apellido) → avatar línea 1
//  - company_initial: inicial de company_name (vacío si no hay) → avatar línea 2 "@C"
//  - name: "Nombre Apellido" → dropdown línea 1
//  - company: company_name si hay nombre+empresa → dropdown línea 2 "@ Empresa"
function _header_identity(tenant, profile, email) {
  var src = tenant || profile || null;
  if (!src) {
    var parts = (email || '').split(/[\s@]+/);
    var ini = parts.map(function (w) { return w[0] || ''; }).slice(0, 2).join('').toUpperCase() || '?';
    return { initials: ini, company_initial: '', name: email, company: '' };
  }
  var fn = (src.first_name || '').trim();
  var ln = (src.last_name || '').trim();
  var company = (src.company_name || '').trim();
  var person = (fn + ' ' + ln).trim();
  var initials = ((fn[0] || '') + (ln[0] || '')).toUpperCase() || (company[0] || email[0] || '?').toUpperCase();
  var company_initial = company ? company[0].toUpperCase() : '';
  var name = person || company || email;
  // "@ empresa" solo cuando hay nombre de persona Y empresa (no duplicar si el nombre ya es la empresa).
  return { initials: initials, company_initial: company_initial, name: name, company: (company && person) ? company : '' };
}
