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

  mount.outerHTML = `
    <nav class="site-nav" id="site-nav-inner">
      <a class="nav-brand" href="/art/" aria-label="Asy Dhaif — Home">
        <span class="nav-brand-mark"></span>
      </a>
      <div class="nav-links">${linksHtml}</div>
    </nav>
  `;

  const nav = document.getElementById("site-nav-inner");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll);
  onScroll();
}

document.addEventListener("DOMContentLoaded", renderNav);
