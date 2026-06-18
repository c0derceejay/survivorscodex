/* ==========================================================================
   Survivor's Codex — Mods page
   Fetches data/mods.json and renders one card per entry. Edit that JSON file
   (and drop the matching video into /videos) to add or remove mods.
   ========================================================================== */
(function () {
  "use strict";

  const grid = document.getElementById("mods-grid");
  const status = document.getElementById("mods-status");
  if (!grid) return;

  function showStatus(text) {
    if (!status) return;
    status.textContent = text;
    status.hidden = false;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function isSafeLink(url) {
    if (typeof url !== "string" || !url) return false;
    const trimmed = url.trim();
    return /^(https?:\/\/|mailto:|\/|\.\/|\.\.\/)/i.test(trimmed);
  }

  function renderCard(mod) {
    const title = escapeHtml(mod.title || "Untitled mod");
    const description = escapeHtml(mod.description || "");
    const metaParts = [];
    if (mod.author) metaParts.push(`by ${escapeHtml(mod.author)}`);
    if (mod.version) metaParts.push(`v${escapeHtml(mod.version)}`);
    const meta = metaParts.length
      ? `<p class="mod-card__meta muted">${metaParts.join(" · ")}</p>`
      : "";
    const tags = Array.isArray(mod.tags) && mod.tags.length
      ? `<div class="mod-card__tags">${mod.tags
          .map((t) => `<span class="mod-card__tag">${escapeHtml(t)}</span>`)
          .join("")}</div>`
      : "";
    const posterAttr = mod.videoPoster ? ` poster="${escapeHtml(mod.videoPoster)}"` : "";
    const videoSrc = escapeHtml(mod.videoSrc || "");
    const imageSrc = escapeHtml(mod.image || "");
    let media;
    if (videoSrc) {
      media = `<div class="mod-card__media">
           <video class="mod-card__video" controls preload="metadata" playsinline${posterAttr}>
             <source src="${videoSrc}" type="video/mp4" />
             Your browser cannot play this preview.
           </video>
         </div>`;
    } else if (imageSrc) {
      const alt = escapeHtml(`${mod.title || "Mod"} preview`);
      media = `<div class="mod-card__media">
           <img class="mod-card__image" src="${imageSrc}" alt="${alt}" loading="lazy" />
         </div>`;
    } else {
      media = `<div class="mod-card__media mod-card__media--empty" aria-hidden="true">
           <span>No preview</span>
         </div>`;
    }

    const linkLabel = escapeHtml(mod.linkLabel || "Visit mod");
    const link = isSafeLink(mod.link)
      ? `<a class="btn btn-primary mod-card__cta" href="${escapeHtml(mod.link)}" target="_blank" rel="noopener noreferrer">${linkLabel} →</a>`
      : `<span class="muted mod-card__cta mod-card__cta--missing">Link coming soon</span>`;

    return `
      <article class="mod-card" data-mod-id="${escapeHtml(mod.id || "")}">
        ${media}
        <div class="mod-card__body">
          ${tags}
          <h3 class="mod-card__title">${title}</h3>
          ${meta}
          <p class="mod-card__desc muted">${description}</p>
          ${link}
        </div>
      </article>`;
  }

  async function load() {
    try {
      const res = await fetch("data/mods.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mods = Array.isArray(data?.mods) ? data.mods : [];
      if (!mods.length) {
        showStatus("No mods listed yet — check back soon.");
        grid.classList.add("in");
        return;
      }
      grid.innerHTML = mods.map(renderCard).join("");
      grid.classList.add("in");
    } catch (err) {
      console.error("[mods] Could not load mod catalog:", err);
      showStatus("Could not load mods. Refresh the page or try again later.");
    }
  }

  load();
})();
