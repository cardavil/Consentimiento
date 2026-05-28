function render_admin_nav() {
  var el = document.getElementById('admin-tabs');
  if (!el) return;

  var current = window.location.pathname.split('/').pop();

  var items = [
    { href: 'index.html', label: 'Indicadores', perm: null },
    { href: 'orgs.html', label: 'Organizaciones', perm: 'read:orgs' },
    { href: 'audit.html', label: 'Auditoría', perm: 'read:audit_log' },
    { href: 'catalogs.html', label: 'Catálogos', perm: 'read:catalogs' },
    { href: 'analysts.html', label: 'Analistas', perm: null, admin_only: true },
  ];

  var html = '';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.admin_only && !is_admin()) continue;
    if (item.perm && !has_permission(item.perm)) continue;

    var active = current === item.href ? ' admin-tab-active' : '';
    html += '<a href="' + item.href + '" class="admin-tab' + active + '">' +
      escape_html(item.label) + '</a>';
  }

  el.innerHTML = html;
}
