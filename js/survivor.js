/* ==========================================================================
   Public survivor profile — shared builds gallery per username
   ========================================================================== */

(() => {
  let skillsData = null;
  let catalog = { items: [], categories: [] };
  let itemStats = {};
  let perkGearConfig = null;

  function buildGearContext() {
    return {
      items: catalog.items,
      categories: catalog.categories,
      itemStats,
      gearConfig: perkGearConfig,
    };
  }

  function buildSummary(b) {
    const meta = skillsData?.meta;
    const level = SDD.SkillPoints.normalizePlayerLevel(meta || { maxPlayerLevel: 300 }, b);
    const attrPts = Object.values(b.attributes || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    const perkPts = Object.values(b.perks || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    return `Level ${level} · ${attrPts} attribute lv · ${perkPts} perk lv`;
  }

  function renderBuilds(builds) {
    const grid = document.getElementById("survivor-builds-grid");
    if (!grid) return;

    if (!builds.length) {
      grid.innerHTML = `<div class="empty-state">No public builds yet.</div>`;
      return;
    }

    grid.innerHTML = builds.map((b) => {
      const typeDesc = SDD.BuildTypes.typeDescriptions(b.buildTypes ?? b.buildType);
      return `
        <article class="profile-build-card builds-card">
          <div class="profile-build-header">
            <details class="profile-build-details">
              <summary class="profile-build-summary">
                <span class="profile-build-chevron" aria-hidden="true"></span>
                <div class="profile-build-summary-text">
                  <div class="profile-build-title-row">
                    <h3 class="profile-build-name">${SDD.escapeHTML(b.name)}</h3>
                    <div class="profile-build-pills">${SDD.BuildTypes.renderTypePills(b.buildTypes ?? b.buildType)}</div>
                  </div>
                  <p class="profile-build-meta">${SDD.escapeHTML(buildSummary(b))}</p>
                  <p class="builds-community-stats muted">▲ ${b.upvoteCount || 0} · ${b.commentCount || 0} comments · ${b.copyCount || 0} copies</p>
                  ${typeDesc ? `<p class="profile-build-focus muted">${SDD.escapeHTML(typeDesc)}</p>` : ""}
                  <time class="profile-build-date" datetime="${b.savedAt}">${new Date(b.savedAt).toLocaleString()}</time>
                </div>
              </summary>
              <div class="profile-build-breakdown">
                ${SDD.renderBuildBreakdown(b, skillsData, buildGearContext())}
              </div>
            </details>
            <div class="profile-build-actions builds-card-actions">
              <a class="btn btn-primary btn-sm" href="skills.html?copy=${encodeURIComponent(b.id)}">Copy to planner</a>
              <a class="btn btn-ghost btn-sm" href="builds.html?build=${encodeURIComponent(b.id)}">Open on builds page</a>
            </div>
          </div>
        </article>`;
    }).join("");

    SDD.Mannequin?.hydrate?.(grid) || SDD.attachItemPhotoHandlers?.(grid);
  }

  async function boot() {
    const username = new URLSearchParams(location.search).get("user");
    const nameEl = document.getElementById("survivor-name");
    const bioEl = document.getElementById("survivor-bio");
    const statsEl = document.getElementById("survivor-stats");
    const avatarEl = document.getElementById("survivor-avatar");
    const grid = document.getElementById("survivor-builds-grid");

    if (!username) {
      if (nameEl) nameEl.textContent = "Survivor not found";
      if (grid) grid.innerHTML = `<div class="empty-state">Missing <code>?user=username</code> in the URL.</div>`;
      return;
    }

    await SDD.Auth.refresh();
    await SDD.BuildTypes.loadBuildTypes();
    await SDD.PerkGear.loadPerkGear();
    perkGearConfig = await SDD.PerkGear.loadPerkGear();
    await SDD.Loadout.loadData();

    const [skillsRes, itemsRes, statsRes, profileRes] = await Promise.all([
      fetch("data/skills.json"),
      fetch("data/items.json"),
      fetch("data/item-stats.json"),
      fetch(`/api/users/${encodeURIComponent(username)}/profile`),
      SDD.loadImageManifest(),
    ]);

    skillsData = await skillsRes.json();
    const itemsJson = await itemsRes.json();
    catalog.items = itemsJson.items || [];
    catalog.categories = itemsJson.categories || [];
    itemStats = await statsRes.json();

    if (!profileRes.ok) {
      if (nameEl) nameEl.textContent = "Survivor not found";
      if (bioEl) bioEl.textContent = "This profile does not exist or is set to private.";
      if (grid) grid.innerHTML = `<div class="empty-state"><a href="builds.html">Browse community builds</a></div>`;
      return;
    }

    const profile = await profileRes.json();
    const user = profile.user;
    const builds = profile.builds || [];

    if (nameEl) nameEl.textContent = `@${user.username}`;
    document.title = `@${user.username} · Survivor's Codex`;
    if (bioEl) bioEl.textContent = user.bio || "No bio yet.";
    if (statsEl) {
      statsEl.textContent = `${builds.length} public build${builds.length === 1 ? "" : "s"} · member since ${new Date(user.createdAt).toLocaleDateString()}`;
    }
    if (avatarEl) avatarEl.textContent = (user.username || "?").charAt(0).toUpperCase();

    renderBuilds(builds);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
