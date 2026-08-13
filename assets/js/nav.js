const NAV_LINKS = [
  { label: "About", href: "/about/" },
  { label: "Visuals", href: "/visuals/" },
  { label: "Contact", href: "/contact/" },
];

function renderNav() {
  const mount = document.getElementById("site-nav");
  if (!mount) return;

  const currentPath = window.location.pathname.replace(/\/index\.html$/, "/");

  const linksHtml = NAV_LINKS.map(({ label, href }) => {
    const isActive = currentPath === href;
    return `<a class="nav-link${isActive ? " is-active" : ""}" href="${href}">${label}</a>`;
  }).join("");

  mount.innerHTML = `
    <nav class="site-nav">
      <a class="nav-brand" href="/art/">Asy Dhaif</a>
      <div class="nav-links">${linksHtml}</div>
    </nav>
  `;
}

document.addEventListener("DOMContentLoaded", renderNav);
