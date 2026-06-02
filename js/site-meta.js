/* ==========================================================================
   Site meta — game version badge, changelog, Discord OG helpers
   ========================================================================== */

(() => {
  let meta = null;

  async function loadSiteMeta() {
    if (meta) return meta;
    try {
      const res = await fetch("data/site-meta.json", { cache: "no-store" });
      meta = res.ok ? await res.json() : {};
    } catch (_) {
      meta = {};
    }
    return meta;
  }

  function injectVersionBadge() {
    if (document.querySelector(".footer-game-version")) return;
    const data = meta;
    if (!data?.gameVersion) return;

    const line = document.createElement("p");
    line.className = "footer-game-version";
    line.title = data.gameVersionLabel || "Catalog game version";
    line.textContent = `Game catalog ${data.gameVersion}`;

    const footer = document.querySelector("footer.footer .footer-inner");
    if (footer) {
      footer.appendChild(line);
      footer.classList.add("footer-inner--stacked");
    }
  }

  function applyDiscordOg() {
    const invite = meta?.discordInvite;
    if (!invite) return;
    const desc = meta.ogDescription || document.querySelector('meta[name="description"]')?.content;
    if (desc) {
      let og = document.querySelector('meta[property="og:description"]');
      if (!og) {
        og = document.createElement("meta");
        og.setAttribute("property", "og:description");
        document.head.appendChild(og);
      }
      if (!og.getAttribute("content")?.includes("Discord")) {
        og.setAttribute("content", `${desc} Join us on Discord.`);
      }
    }
  }

  function renderChangelog(container) {
    if (!container || !meta?.changelog?.length) return;
    const esc = window.SDD?.escapeHTML || ((s) => String(s));
    container.innerHTML = meta.changelog.map((entry) => `
      <article class="changelog-entry">
        <time class="changelog-date" datetime="${esc(entry.date)}">${esc(entry.date)}</time>
        <h3 class="changelog-title">${esc(entry.title)}</h3>
        <ul class="changelog-items">${(entry.items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </article>
    `).join("");
  }

  function escAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function renderDiscordLink(container) {
    if (!container) return;
    const invite = meta?.discordInvite;
    if (!invite) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const label = meta.discordLabel || "Join our Discord";
    container.innerHTML = `<a class="btn btn-ghost discord-cta" href="${escAttr(invite)}" target="_blank" rel="noopener noreferrer">${window.SDD?.escapeHTML?.(label) || label}</a>`;
  }

  async function bootSiteMeta() {
    await loadSiteMeta();
    injectVersionBadge();
    applyDiscordOg();
    renderChangelog(document.getElementById("site-changelog"));
    renderDiscordLink(document.getElementById("discord-cta"));
  }

  window.SDD = window.SDD || {};
  window.SDD.SiteMeta = {
    loadSiteMeta,
    renderChangelog,
    bootSiteMeta,
    get meta() { return meta; },
  };

  document.addEventListener("DOMContentLoaded", () => {
    bootSiteMeta();
  });
})();
