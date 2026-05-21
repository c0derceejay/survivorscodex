/* ==========================================================================
   Public builds gallery — browse, filter, copy community builds
   ========================================================================== */

(() => {
  let skillsData = null;
  let catalog = { items: [], categories: [] };
  let itemStats = {};
  let perkGearConfig = null;
  let allBuilds = [];
  let activeTypeFilter = "all";
  let filters = {
    q: "",
    attribute: "",
    perk: "",
    weapon: "",
    tool: "",
  };

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
    const budget = meta ? SDD.SkillPoints.budget(meta, level) : null;
    const spent = meta ? SDD.SkillPoints.calcSpent(b.attributes, b.perks, meta).total : null;
    const attrPts = Object.values(b.attributes || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    const perkPts = Object.values(b.perks || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    const levelLabel = budget != null && spent != null
      ? `Level ${level} · ${spent}/${budget} pts spent`
      : `Survivor level ${level}`;
    return `${levelLabel} · ${attrPts} attribute lv · ${perkPts} perk lv`;
  }

  function applyFilters() {
    let builds = [...allBuilds];

    if (activeTypeFilter !== "all") {
      builds = builds.filter((b) => SDD.BuildTypes.buildHasType(b, activeTypeFilter));
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      builds = builds.filter((b) => {
        const nameMatch = String(b.name || "").toLowerCase().includes(q);
        const authorMatch = String(b.author?.username || "").toLowerCase().includes(q);
        return nameMatch || authorMatch;
      });
    }
    if (filters.attribute) {
      builds = builds.filter((b) => (Number(b.attributes?.[filters.attribute]) || 0) > 0);
    }
    if (filters.perk) {
      builds = builds.filter((b) => (Number(b.perks?.[filters.perk]) || 0) > 0);
    }
    if (filters.weapon) {
      builds = builds.filter((b) => Array.isArray(b.loadout?.weapons) && b.loadout.weapons.includes(filters.weapon));
    }
    if (filters.tool) {
      builds = builds.filter((b) => Array.isArray(b.loadout?.tools) && b.loadout.tools.includes(filters.tool));
    }

    renderTypeFilters();
    renderBuilds(builds);
    updateUrl();
  }

  function currentQueryParams() {
    const params = {};
    if (activeTypeFilter !== "all") params.type = activeTypeFilter;
    if (filters.q) params.q = filters.q;
    if (filters.attribute) params.attribute = filters.attribute;
    if (filters.perk) params.perk = filters.perk;
    if (filters.weapon) params.weapon = filters.weapon;
    if (filters.tool) params.tool = filters.tool;
    return params;
  }

  function updateUrl() {
    const params = new URLSearchParams();
    Object.entries(currentQueryParams()).forEach(([key, value]) => params.set(key, value));
    const qs = params.toString();
    const next = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState(null, "", next);
  }

  function readUrlFilters() {
    const params = new URLSearchParams(location.search);
    activeTypeFilter = params.get("type") || "all";
    filters.q = params.get("q") || "";
    filters.attribute = params.get("attribute") || "";
    filters.perk = params.get("perk") || "";
    filters.weapon = params.get("weapon") || "";
    filters.tool = params.get("tool") || "";
    const searchEl = document.getElementById("builds-search");
    if (searchEl) searchEl.value = filters.q;
    ["attribute", "perk", "weapon", "tool"].forEach((key) => {
      const el = document.getElementById(`filter-${key}`);
      if (el) el.value = filters[key] || "";
    });
  }

  function populateFilterOptions() {
    const attrSelect = document.getElementById("filter-attribute");
    const perkSelect = document.getElementById("filter-perk");
    const weaponSelect = document.getElementById("filter-weapon");
    const toolSelect = document.getElementById("filter-tool");
    if (!attrSelect || !skillsData) return;

    attrSelect.innerHTML = `<option value="">Any attribute</option>${skillsData.attributes.map((a) =>
      `<option value="${SDD.escapeHTML(a.id)}">${SDD.escapeHTML(a.name)}</option>`
    ).join("")}`;

    perkSelect.innerHTML = `<option value="">Any perk</option>${skillsData.attributes.map((a) => {
      const opts = a.perks.map((p) =>
        `<option value="${SDD.escapeHTML(p.id)}">${SDD.escapeHTML(p.name)} (${SDD.escapeHTML(a.abbr)})</option>`
      ).join("");
      return `<optgroup label="${SDD.escapeHTML(a.name)}">${opts}</optgroup>`;
    }).join("")}`;

    const weapons = catalog.items.filter((i) =>
      (i.category === "weapons-melee" || i.category === "weapons-ranged")
      && !String(i.id).includes("-parts")
    ).sort((a, b) => a.name.localeCompare(b.name));

    weaponSelect.innerHTML = `<option value="">Any weapon</option>${weapons.map((i) =>
      `<option value="${SDD.escapeHTML(i.id)}">${SDD.escapeHTML(i.name)}</option>`
    ).join("")}`;

    const tools = catalog.items.filter((i) =>
      String(i.id).startsWith("melee-tool-")
      && !String(i.id).includes("-parts")
      && !["melee-tool-flashlight", "melee-tool-torch"].includes(i.id)
    ).sort((a, b) => a.name.localeCompare(b.name));

    toolSelect.innerHTML = `<option value="">Any tool</option>${tools.map((i) =>
      `<option value="${SDD.escapeHTML(i.id)}">${SDD.escapeHTML(i.name)}</option>`
    ).join("")}`;

    attrSelect.value = filters.attribute;
    perkSelect.value = filters.perk;
    weaponSelect.value = filters.weapon;
    toolSelect.value = filters.tool;
  }

  function renderTypeFilters() {
    const wrap = document.getElementById("build-type-filters");
    if (!wrap) return;
    if (!allBuilds.length) {
      wrap.innerHTML = "";
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const counts = { all: allBuilds.length };
    allBuilds.forEach((b) => {
      SDD.BuildTypes.normalizeBuildTypes(b.buildTypes ?? b.buildType).forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    wrap.innerHTML = [
      `<button type="button" class="build-type-filter${activeTypeFilter === "all" ? " active" : ""}" data-type="all">All (${counts.all})</button>`,
      ...SDD.BuildTypes.all
        .filter((t) => counts[t.id])
        .map((t) => `
          <button type="button" class="build-type-filter${activeTypeFilter === t.id ? " active" : ""}" data-type="${SDD.escapeHTML(t.id)}">
            ${SDD.escapeHTML(t.label)} (${counts[t.id]})
          </button>`),
    ].join("");
    wrap.querySelectorAll(".build-type-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTypeFilter = btn.dataset.type;
        applyFilters();
      });
    });
  }

  function renderStarterTemplates() {
    const wrap = document.getElementById("starter-templates-grid");
    if (!wrap || !skillsData?.presets?.length) return;

    wrap.innerHTML = skillsData.presets.map((p) => {
      const build = {
        name: p.name,
        playerLevel: p.playerLevel,
        unlimited: p.unlimited ?? false,
        attributes: p.attributes || {},
        perks: p.perks || {},
        loadout: {},
      };
      return `
        <article class="builds-template-card">
          <span class="guide-preset-icon" aria-hidden="true">${p.icon || "◆"}</span>
          <span class="guide-preset-tag">${SDD.escapeHTML(p.tag || "Template")}</span>
          <h3>${SDD.escapeHTML(p.name)}</h3>
          <p class="muted">${SDD.escapeHTML(p.blurb || "")}</p>
          <p class="builds-template-meta muted">${SDD.escapeHTML(buildSummary(build))}</p>
          <a class="btn btn-primary btn-sm" href="skills.html?preset=${encodeURIComponent(p.id)}">Use template</a>
        </article>`;
    }).join("");
  }

  function renderBuilds(builds) {
    const grid = document.getElementById("builds-grid");
    const countEl = document.getElementById("builds-result-count");
    if (!grid) return;

    countEl.textContent = builds.length
      ? `${builds.length} community build${builds.length === 1 ? "" : "s"}`
      : allBuilds.length
        ? "No community builds match your filters."
        : "No community builds shared yet — be the first to publish one from the planner.";

    if (!allBuilds.length) {
      grid.innerHTML = `<div class="empty-state">
        No community builds yet. Open the <a href="skills.html" style="color:var(--color-red-bright)">planner</a>,
        create a build, check <strong>Share in the public builds gallery</strong>, and save while signed in.
        Starter templates can be shown from the section at the top of this page.
      </div>`;
      return;
    }
    if (!builds.length) {
      grid.innerHTML = `<div class="empty-state">No builds match your filters. Try clearing a filter or search term.</div>`;
      return;
    }

    grid.innerHTML = builds.map((b) => {
      const typeDesc = SDD.BuildTypes.typeDescriptions(b.buildTypes ?? b.buildType);
      const author = b.author?.username ? `@${b.author.username}` : "Unknown survivor";
      const isOwn = SDD.Auth.user && b.author?.id === SDD.Auth.user.id;
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
                  <p class="builds-author muted">by <strong>${SDD.escapeHTML(author)}</strong>${isOwn ? " · yours" : ""}</p>
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
              <button type="button" class="btn btn-ghost btn-sm builds-save-copy" data-copy-build="${b.id}">Save copy</button>
            </div>
          </div>
        </article>`;
    }).join("");

    grid.querySelectorAll(".builds-save-copy").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const build = allBuilds.find((x) => x.id === btn.dataset.copyBuild);
        if (!build) return;
        if (!SDD.Auth.user) {
          SDD.openAuthModal("signin");
          SDD.toast("Sign in to save a copy to your account.", "error");
          return;
        }
        btn.disabled = true;
        try {
          const saved = await SDD.BuildStore.copyPublicBuild(build);
          SDD.toast(`Saved "${saved.name}" to your builds.`, "success");
        } catch (err) {
          SDD.toast(err.message || "Could not save copy.", "error");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  async function loadBuilds() {
    try {
      allBuilds = await SDD.BuildStore.fetchPublicBuilds();
    } catch (err) {
      allBuilds = [];
      const grid = document.getElementById("builds-grid");
      const countEl = document.getElementById("builds-result-count");
      if (countEl) countEl.textContent = "";
      if (grid) {
        grid.innerHTML = `<div class="empty-state">${SDD.escapeHTML(
          err.message || "Could not load public builds."
        )}. If you recently updated the site, restart the dev server with <strong>npm start</strong>.</div>`;
      }
      return;
    }
    applyFilters();
  }

  const STARTER_TEMPLATES_COLLAPSED_KEY = "builds-templates-collapsed";

  function setStarterTemplatesCollapsed(collapsed, { persist = true } = {}) {
    const panel = document.getElementById("starter-templates");
    if (!panel) return;

    panel.open = !collapsed;

    if (persist) {
      try {
        localStorage.setItem(STARTER_TEMPLATES_COLLAPSED_KEY, collapsed ? "1" : "0");
      } catch (_) {}
    }
  }

  function bindStarterTemplatesToggle() {
    const panel = document.getElementById("starter-templates");
    if (!panel) return;

    let collapsed = false;
    try {
      collapsed = localStorage.getItem(STARTER_TEMPLATES_COLLAPSED_KEY) === "1";
    } catch (_) {}

    if (location.hash === "#starter-templates") {
      collapsed = false;
      try {
        localStorage.setItem(STARTER_TEMPLATES_COLLAPSED_KEY, "0");
      } catch (_) {}
    }

    setStarterTemplatesCollapsed(collapsed, { persist: false });

    panel.addEventListener("toggle", () => {
      try {
        localStorage.setItem(STARTER_TEMPLATES_COLLAPSED_KEY, panel.open ? "0" : "1");
      } catch (_) {}
    });

    if (location.hash === "#starter-templates") {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindControls() {
    const searchEl = document.getElementById("builds-search");
    let searchTimer = null;
    searchEl?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        filters.q = searchEl.value.trim();
        applyFilters();
      }, 200);
    });

    ["attribute", "perk", "weapon", "tool"].forEach((key) => {
      const el = document.getElementById(`filter-${key}`);
      el?.addEventListener("change", () => {
        filters[key] = el.value;
        applyFilters();
      });
    });

    document.getElementById("builds-clear-filters")?.addEventListener("click", () => {
      activeTypeFilter = "all";
      filters = { q: "", attribute: "", perk: "", weapon: "", tool: "" };
      if (searchEl) searchEl.value = "";
      populateFilterOptions();
      applyFilters();
    });
  }

  async function boot() {
    await SDD.Auth.refresh();
    await SDD.BuildTypes.loadBuildTypes();
    await SDD.PerkGear.loadPerkGear();
    perkGearConfig = await SDD.PerkGear.loadPerkGear();
    await SDD.Loadout.loadData();
    await window.ItemTooltips?.loadItemStats?.();

    const [skillsRes, itemsRes, statsRes] = await Promise.all([
      fetch("data/skills.json"),
      fetch("data/items.json"),
      fetch("data/item-stats.json"),
      SDD.loadImageManifest(),
    ]);
    skillsData = await skillsRes.json();
    const itemsJson = await itemsRes.json();
    catalog.items = itemsJson.items || [];
    catalog.categories = itemsJson.categories || [];
    itemStats = await statsRes.json();

    readUrlFilters();
    populateFilterOptions();
    renderStarterTemplates();
    bindStarterTemplatesToggle();
    bindControls();
    await loadBuilds();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
