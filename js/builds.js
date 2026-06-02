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
  let activeSort = "new";
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

  function sharedBuildId() {
    return new URLSearchParams(location.search).get("build");
  }

  function buildShareUrl(id) {
    const params = new URLSearchParams(currentQueryParams());
    params.set("build", id);
    return `${location.origin}${location.pathname}?${params.toString()}`;
  }

  function setPageMeta(nameOrProperty, content) {
    let el = document.querySelector(`meta[property="${nameOrProperty}"]`) || document.querySelector(`meta[name="${nameOrProperty}"]`);
    if (!el) {
      el = document.createElement("meta");
      if (nameOrProperty.startsWith("og:")) el.setAttribute("property", nameOrProperty);
      else el.setAttribute("name", nameOrProperty);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function applyBuildShareMeta(build) {
    if (!build) return;
    const author = build.author?.username ? `@${build.author.username}` : "Community build";
    const title = `${build.name} · Survivor's Codex`;
    const desc = `${buildSummary(build)} — ${author}. Copy to your planner on Survivor's Codex.`;
    document.title = title;
    setPageMeta("description", desc);
    setPageMeta("og:title", title);
    setPageMeta("og:description", desc);
    setPageMeta("og:type", "website");
    setPageMeta("og:url", buildShareUrl(build.id));
  }

  function highlightSharedBuild() {
    const buildId = sharedBuildId();
    if (!buildId) return;
    const build = allBuilds.find((b) => b.id === buildId);
    if (build) applyBuildShareMeta(build);
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-build-id="${buildId}"]`);
      if (!card) return;
      const details = card.querySelector("details");
      if (details) {
        details.open = true;
        const section = details.querySelector(".builds-comments");
        if (section) loadCommentsForBuild(buildId, section);
      }
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("builds-card-highlight");
      setTimeout(() => card.classList.remove("builds-card-highlight"), 3200);
    });
  }

  async function ensureSharedBuildLoaded() {
    const buildId = sharedBuildId();
    if (!buildId || allBuilds.some((b) => b.id === buildId)) return;
    try {
      const data = await SDD.api(`/api/builds/public/${encodeURIComponent(buildId)}`);
      if (data.build) {
        allBuilds = [data.build, ...allBuilds.filter((b) => b.id !== buildId)];
      }
    } catch (_) {}
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
    if (activeSort !== "new") params.sort = activeSort;
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
    const buildId = sharedBuildId();
    if (buildId) params.set("build", buildId);
    const qs = params.toString();
    const next = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState(null, "", next);
  }

  function readUrlFilters() {
    const params = new URLSearchParams(location.search);
    activeSort = params.get("sort") === "trending" ? "trending" : "new";
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
    const sortEl = document.getElementById("builds-sort");
    if (sortEl) sortEl.value = activeSort;
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

  function templateLoadoutSummary(preset) {
    const l = preset.loadout;
    if (!l) return "";
    const parts = [];
    if (l.weapons?.length) parts.push(`${l.weapons.length} weapon${l.weapons.length === 1 ? "" : "s"}`);
    if (l.tools?.length) parts.push(`${l.tools.length} tool${l.tools.length === 1 ? "" : "s"}`);
    if (l.armorSet) parts.push(`${l.armorSet.replace(/-/g, " ")} Q${l.armorQuality || 6}`);
    if (l.vehicles?.length) parts.push(`${l.vehicles.length} vehicle${l.vehicles.length === 1 ? "" : "s"}`);
    if (!parts.length) return "";
    return `Suggested loadout: ${parts.join(" · ")}`;
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
        loadout: p.loadout || {},
        buildTypes: p.buildTypes,
      };
      const loadoutLine = templateLoadoutSummary(p);
      const typePills = p.buildTypes?.length ? SDD.BuildTypes.renderTypePills(p.buildTypes) : "";
      return `
        <article class="builds-template-card">
          <span class="guide-preset-icon" aria-hidden="true">${p.icon || "◆"}</span>
          <span class="guide-preset-tag">${SDD.escapeHTML(p.tag || "Template")}</span>
          <h3>${SDD.escapeHTML(p.name)}</h3>
          ${typePills ? `<div class="builds-template-pills">${typePills}</div>` : ""}
          <p class="muted">${SDD.escapeHTML(p.blurb || "")}</p>
          <p class="builds-template-meta muted">${SDD.escapeHTML(buildSummary(build))}</p>
          ${loadoutLine ? `<p class="builds-template-loadout muted">${SDD.escapeHTML(loadoutLine)}</p>` : ""}
          <a class="btn btn-primary btn-sm" href="skills.html?preset=${encodeURIComponent(p.id)}">Use template</a>
        </article>`;
    }).join("");
  }

  function authorLink(b) {
    const username = b.author?.username;
    if (!username) return `<strong>Unknown survivor</strong>`;
    const isOwn = SDD.Auth.user && b.author?.id === SDD.Auth.user.id;
    return `<a class="builds-author-link" href="survivor.html?user=${encodeURIComponent(username)}">@${SDD.escapeHTML(username)}</a>${isOwn ? " · yours" : ""}`;
  }

  function communityStatsHtml(b) {
    return `<p class="builds-community-stats muted">▲ ${b.upvoteCount || 0} · ${b.commentCount || 0} comments · ${b.copyCount || 0} copies</p>`;
  }

  function commentsSectionHtml(b) {
    return `
      <section class="builds-comments" data-comments-for="${SDD.escapeHTML(b.id)}">
        <h4 class="builds-comments-title">Comments <span class="builds-comments-count">${b.commentCount || 0}</span></h4>
        <div class="builds-comments-list muted">Open this build to load comments.</div>
        <form class="builds-comment-form" data-comment-form="${SDD.escapeHTML(b.id)}">
          <textarea class="builds-comment-input" rows="2" maxlength="500" placeholder="Add a comment…" aria-label="Comment on ${SDD.escapeHTML(b.name)}"></textarea>
          <button type="submit" class="btn btn-ghost btn-sm">Post comment</button>
        </form>
      </section>`;
  }

  function updateBuildInList(id, patch) {
    const idx = allBuilds.findIndex((b) => b.id === id);
    if (idx >= 0) allBuilds[idx] = { ...allBuilds[idx], ...patch };
  }

  async function loadCommentsForBuild(buildId, container) {
    const listEl = container.querySelector(".builds-comments-list");
    if (!listEl || listEl.dataset.loaded === "1") return;
    listEl.textContent = "Loading comments…";
    try {
      const comments = await SDD.BuildStore.fetchComments(buildId);
      listEl.dataset.loaded = "1";
      if (!comments.length) {
        listEl.innerHTML = `<p class="muted builds-comments-empty">No comments yet — be the first.</p>`;
        return;
      }
      listEl.innerHTML = comments.map((c) => `
        <article class="builds-comment">
          <header class="builds-comment-head">
            <a class="builds-author-link" href="survivor.html?user=${encodeURIComponent(c.username)}">@${SDD.escapeHTML(c.username)}</a>
            <time datetime="${c.createdAt}">${new Date(c.createdAt).toLocaleString()}</time>
          </header>
          <p>${SDD.escapeHTML(c.text)}</p>
        </article>
      `).join("");
    } catch (err) {
      listEl.innerHTML = `<p class="muted">${SDD.escapeHTML(err.message || "Could not load comments.")}</p>`;
    }
  }

  function bindCommunityActions(grid) {
    grid.querySelectorAll(".builds-upvote-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!SDD.Auth.user) {
          SDD.openAuthModal("signin");
          SDD.toast("Sign in to upvote builds.", "error");
          return;
        }
        btn.disabled = true;
        try {
          const result = await SDD.BuildStore.toggleUpvote(btn.dataset.upvote);
          const upvoted = Boolean(result.upvoted);
          const count = result.upvoteCount || 0;
          btn.classList.toggle("is-upvoted", upvoted);
          btn.setAttribute("aria-pressed", upvoted ? "true" : "false");
          btn.innerHTML = `▲ ${count}`;
          updateBuildInList(btn.dataset.upvote, { upvoteCount: count, userUpvoted: upvoted });
          const card = btn.closest("[data-build-id]");
          card?.querySelectorAll(".builds-community-stats").forEach((el) => {
            el.textContent = `▲ ${count} · ${allBuilds.find((b) => b.id === btn.dataset.upvote)?.commentCount || 0} comments · ${allBuilds.find((b) => b.id === btn.dataset.upvote)?.copyCount || 0} copies`;
          });
        } catch (err) {
          SDD.toast(err.message || "Could not upvote.", "error");
        } finally {
          btn.disabled = false;
        }
      });
    });

    grid.querySelectorAll(".profile-build-details").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const section = details.querySelector(".builds-comments");
        if (section) loadCommentsForBuild(section.dataset.commentsFor, section);
      });
    });

    grid.querySelectorAll(".builds-comment-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const buildId = form.dataset.commentForm;
        const input = form.querySelector(".builds-comment-input");
        const text = input?.value?.trim();
        if (!text) return;
        if (!SDD.Auth.user) {
          SDD.openAuthModal("signin");
          SDD.toast("Sign in to comment.", "error");
          return;
        }
        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        try {
          const data = await SDD.BuildStore.postComment(buildId, text);
          input.value = "";
          const section = form.closest(".builds-comments");
          if (section) {
            section.querySelector(".builds-comments-list").dataset.loaded = "0";
            await loadCommentsForBuild(buildId, section);
          }
          const count = data.commentCount ?? 0;
          updateBuildInList(buildId, { commentCount: count });
          section?.querySelector(".builds-comments-count")?.replaceChildren(document.createTextNode(String(count)));
          const card = form.closest("[data-build-id]");
          card?.querySelectorAll(".builds-community-stats").forEach((el) => {
            const b = allBuilds.find((x) => x.id === buildId);
            el.textContent = `▲ ${b?.upvoteCount || 0} · ${count} comments · ${b?.copyCount || 0} copies`;
          });
          SDD.toast("Comment posted.", "success");
        } catch (err) {
          SDD.toast(err.message || "Could not post comment.", "error");
        } finally {
          submitBtn.disabled = false;
        }
      });
    });
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
      const upvoted = Boolean(b.userUpvoted);
      return `
        <article class="profile-build-card builds-card" data-build-id="${SDD.escapeHTML(b.id)}">
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
                  <p class="builds-author muted">by ${authorLink(b)}</p>
                  ${communityStatsHtml(b)}
                  ${typeDesc ? `<p class="profile-build-focus muted">${SDD.escapeHTML(typeDesc)}</p>` : ""}
                  <time class="profile-build-date" datetime="${b.savedAt}">${new Date(b.savedAt).toLocaleString()}</time>
                </div>
              </summary>
              <div class="profile-build-breakdown">
                ${SDD.renderBuildBreakdown(b, skillsData, buildGearContext())}
                ${commentsSectionHtml(b)}
              </div>
            </details>
            <div class="profile-build-actions builds-card-actions">
              <button type="button" class="btn btn-ghost btn-sm builds-upvote-btn${upvoted ? " is-upvoted" : ""}" data-upvote="${SDD.escapeHTML(b.id)}" aria-pressed="${upvoted ? "true" : "false"}">▲ ${b.upvoteCount || 0}</button>
              <a class="btn btn-primary btn-sm" href="skills.html?copy=${encodeURIComponent(b.id)}">Copy to planner</a>
              <button type="button" class="btn btn-ghost btn-sm builds-share-link" data-share-build="${SDD.escapeHTML(b.id)}">Share link</button>
              <button type="button" class="btn btn-ghost btn-sm builds-save-copy" data-copy-build="${b.id}">Save copy</button>
            </div>
          </div>
        </article>`;
    }).join("");

    SDD.Mannequin?.hydrate?.(grid) || SDD.attachItemPhotoHandlers?.(grid);
    bindCommunityActions(grid);
    grid.querySelectorAll(".builds-share-link").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const url = buildShareUrl(btn.dataset.shareBuild);
        try {
          await navigator.clipboard.writeText(url);
          SDD.toast("Share link copied.", "success");
        } catch (_) {
          SDD.toast(url, "success");
        }
      });
    });
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
          const copyCount = (build.copyCount || 0) + 1;
          updateBuildInList(build.id, { copyCount });
          btn.closest("[data-build-id]")?.querySelectorAll(".builds-community-stats").forEach((el) => {
            el.textContent = `▲ ${build.upvoteCount || 0} · ${build.commentCount || 0} comments · ${copyCount} copies`;
          });
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
      allBuilds = await SDD.BuildStore.fetchPublicBuilds({ sort: activeSort });
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
    await ensureSharedBuildLoaded();
    applyFilters();
    highlightSharedBuild();
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

    document.getElementById("builds-sort")?.addEventListener("change", async (e) => {
      activeSort = e.target.value === "trending" ? "trending" : "new";
      await loadBuilds();
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
