/* ==========================================================================
   Community gallery — public field photos from signed-in survivors
   ========================================================================== */

(() => {
  let photos = [];
  let query = "";
  let searchTimer = null;

  const grid = document.getElementById("community-grid");
  const empty = document.getElementById("community-empty");
  const countEl = document.getElementById("community-result-count");
  const searchInput = document.getElementById("community-search");
  const uploadCta = document.getElementById("community-upload-cta");

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (_) {
      return "";
    }
  }

  function renderGrid() {
    if (!photos.length) {
      grid.innerHTML = "";
      grid.hidden = true;
      empty.hidden = false;
      countEl.textContent = query ? "No photos match your search." : "";
      return;
    }

    grid.hidden = false;
    empty.hidden = true;
    countEl.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"} shared`;

    grid.innerHTML = photos.map((photo) => {
      const username = photo.author?.username;
      const authorLabel = username ? `@${username}` : "Unknown survivor";
      const authorHref = username
        ? `survivor.html?user=${encodeURIComponent(username)}`
        : "builds.html";
      const src = SDD.PhotoStore.photoSrc(photo);
      const description = photo.caption?.trim() || "Field photo";
      const tagLine = photo.tag
        ? `<span class="community-card__tag">${SDD.escapeHTML(photo.tag)}</span>`
        : "";

      return `
        <article class="community-card">
          <a class="community-card__media" href="${src}" target="_blank" rel="noopener noreferrer">
            <img src="${src}" alt="${SDD.escapeHTML(description)}" loading="lazy" decoding="async" />
          </a>
          <div class="community-card__body">
            <a class="community-card__author" href="${authorHref}">${SDD.escapeHTML(authorLabel)}</a>
            <p class="community-card__description">${SDD.escapeHTML(description)}</p>
            <div class="community-card__meta">
              ${tagLine}
              <span class="community-card__date">${formatDate(photo.uploadedAt)}</span>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  async function loadPhotos() {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Loading community photos…</div>`;
    grid.hidden = false;
    empty.hidden = true;

    try {
      const data = await SDD.PhotoStore.fetchCommunity({ q: query, limit: 120 });
      photos = data.photos || [];
      renderGrid();
    } catch (err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${SDD.escapeHTML(err.message || "Could not load photos.")}</div>`;
      countEl.textContent = "";
    }
  }

  searchInput?.addEventListener("input", () => {
    query = searchInput.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadPhotos, 250);
  });

  function updateUploadCta(user) {
    if (!uploadCta) return;
    if (user) {
      uploadCta.href = "profile.html";
      uploadCta.textContent = "Upload a photo";
      uploadCta.onclick = null;
    } else {
      uploadCta.href = "#";
      uploadCta.textContent = "Sign in to upload";
      uploadCta.onclick = (e) => {
        e.preventDefault();
        SDD.openAuthModal("signin");
      };
    }
  }

  SDD.Auth.onChange(updateUploadCta);

  document.addEventListener("DOMContentLoaded", async () => {
    await SDD.Auth.refresh();
    updateUploadCta(SDD.Auth.user);
    await loadPhotos();
  });
})();
