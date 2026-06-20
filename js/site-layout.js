/* ==========================================================================
   Site layout — single source of truth for nav active state
   ========================================================================== */

(() => {
  /** Map each page filename to the nav link that should receive .active */
  const PAGE_NAV = {
    "index.html": { match: 'a[href="index.html"]' },
    "guide.html": { match: 'a[href="guide.html"]' },
    "catalog.html": { match: '.nav-dropdown__toggle[href="catalog.html"]' },
    "enemies.html": { match: '.nav-dropdown__menu a[href="enemies.html"]' },
    "enemy.html": { match: '.nav-dropdown__menu a[href="enemies.html"]' },
    "traders.html": { match: '.nav-dropdown__menu a[href="traders.html"]' },
    "skills.html": { match: 'a[href="skills.html"]' },
    "builds.html": { match: 'a[href="builds.html"]' },
    "survivor.html": { match: 'a[href="builds.html"]' },
    "mods.html": { match: 'a[href="mods.html"]' },
    "community.html": { match: 'a[href="community.html"]' },
    "about.html": { match: 'a[href="about.html"]' },
  };

  function currentPage() {
    const leaf = location.pathname.split("/").pop();
    if (!leaf || leaf === "") return "index.html";
    return leaf.includes(".") ? leaf : `${leaf}.html`;
  }

  function applyActiveNav() {
    const nav = document.querySelector(".nav-links");
    if (!nav) return;

    nav.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));

    const config = PAGE_NAV[currentPage()];
    if (!config) return;

    nav.querySelector(config.match)?.classList.add("active");
  }

  window.SDD = window.SDD || {};
  window.SDD.Layout = { applyActiveNav, currentPage };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyActiveNav);
  } else {
    applyActiveNav();
  }
})();
