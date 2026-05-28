function render_admin_nav() {
  var sidebar = document.getElementById('admin-sidebar');
  var current = window.location.pathname.split('/').pop();

  var items = [
    { href: 'index.html', label: 'Dashboard', perm: null },
    { href: 'orgs.html', label: 'Organizaciones', perm: 'read:orgs' },
    { href: 'audit.html', label: 'Auditoría', perm: 'read:audit_log' },
    { href: 'catalogs.html', label: 'Catálogos', perm: 'read:catalogs' },
    { href: 'analysts.html', label: 'Analistas', perm: null, admin_only: true },
  ];

  var html = '<div class="admin-sidebar-brand">Consen<em>tia</em></div>';
  html += '<div class="admin-sidebar-email">' + escape_html(_admin_session.email) + '</div>';
  html += '<div class="admin-sidebar-role"><span class="badge badge-teal">' +
    (_admin_session.role === 'admin' ? 'Admin' : 'Analista') + '</span></div>';
  html += '<nav class="admin-nav">';

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.admin_only && !is_admin()) continue;
    if (item.perm && !has_permission(item.perm)) continue;

    var active = current === item.href ? ' admin-nav-active' : '';
    html += '<a href="' + item.href + '" class="admin-nav-item' + active + '">' +
      escape_html(item.label) + '</a>';
  }

  html += '</nav>';
  html += '<div class="admin-sidebar-footer">';
  html += '<button onclick="admin_sign_out()" class="btn btn-ghost btn-sm btn-block" style="color:var(--gris-claro)">Cerrar sesión</button>';
  html += '</div>';

  sidebar.innerHTML = html;
}
