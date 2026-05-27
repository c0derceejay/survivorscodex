/* ==========================================================================
   Skills / perk build planner
   ========================================================================== */

(() => {
  let skillsData = null;
  let catalogItems = [];
  let catalogCategories = [];
  let itemStats = null;
  let perkGearConfig = null;
  let state = {
    playerLevel: 300,
    attributes: {},
    perks: {},
    selectedPerkId: null,
    selectedAttrId: "perception",
    loadedBuildId: null,
    loadout: { weapons: [], armorSet: null, armorQuality: 6, mods: {}, food: [], water: [], medical: [], tools: [], vehicles: [], itemQualities: {} },
  };

  function calcSpent(st, meta) {
    return SDD.SkillPoints.calcSpent(st.attributes, st.perks, meta);
  }

  function pointsAvailable(st, meta) {
    return SDD.SkillPoints.budget(meta, st.playerLevel);
  }

  function pointsRemaining(st, meta) {
    return pointsAvailable(st, meta) - calcSpent(st, meta).total;
  }

  function allPerks(data) {
    return data.attributes.flatMap((a) =>
      a.perks.map((p) => ({ ...p, attrId: a.id, attrName: a.name, attrColor: a.color }))
    );
  }

  function findPerk(data, perkId) {
    return allPerks(data).find((p) => p.id === perkId);
  }

  function getAttrLevel(st, attrId) {
    return st.attributes[attrId] || 0;
  }

  function getPerkLevel(st, perkId) {
    return st.perks[perkId] || 0;
  }

  function meetsRequirements(perk, st, data, targetLevel) {
    const req = perk.requires || {};
    const attrNeed = req.attribute || 1;
    const attrLvl = getAttrLevel(st, perk.attrId);
    if (attrLvl < attrNeed) {
      return { ok: false, reason: `Requires ${perk.attrName} ${attrNeed} (you have ${attrLvl})` };
    }
    if (targetLevel > attrLvl) {
      return { ok: false, reason: `Perk level ${targetLevel} needs ${perk.attrName} ${targetLevel}+` };
    }
    for (const p of req.perks || []) {
      const have = getPerkLevel(st, p.id);
      if (have < p.level) {
        const parent = findPerk(data, p.id);
        return { ok: false, reason: `Requires ${parent ? parent.name : p.id} level ${p.level}` };
      }
    }
    return { ok: true };
  }

  function canIncreasePerk(perk, st, data) {
    const cur = getPerkLevel(st, perk.id);
    if (cur >= perk.maxLevel) return { ok: false, reason: "Max level reached" };
    const req = meetsRequirements(perk, st, data, cur + 1);
    if (!req.ok) return req;
    if (pointsRemaining(st, data.meta) < 1) {
      return { ok: false, reason: "Not enough skill points" };
    }
    return { ok: true };
  }

  function canIncreaseAttr(attrId, st, data) {
    const cur = getAttrLevel(st, attrId);
    if (cur >= data.meta.maxAttributeLevel) return { ok: false, reason: "Attribute maxed" };
    const cost = data.meta.attributeCosts[cur] || 0;
    if (pointsRemaining(st, data.meta) < cost) {
      return { ok: false, reason: `Need ${cost} skill point${cost > 1 ? "s" : ""}` };
    }
    return { ok: true, cost };
  }

  function initState(data) {
    const attrs = {};
    const perks = {};
    data.attributes.forEach((a) => { attrs[a.id] = 0; });
    allPerks(data).forEach((p) => { perks[p.id] = 0; });
    return {
      playerLevel: data.meta.defaultPlayerLevel ?? data.meta.maxPlayerLevel ?? 300,
      attributes: attrs,
      perks,
      selectedPerkId: data.attributes[0].perks[0].id,
      selectedAttrId: data.attributes[0].id,
      loadedBuildId: null,
      loadout: { weapons: [], armorSet: null, armorQuality: 6, mods: {}, food: [], water: [], medical: [], tools: [], vehicles: [], itemQualities: {} },
    };
  }

  function applyLoadout(loadout) {
    state.loadout = SDD.Loadout.normalizeLoadout(loadout || {}, catalogItems);
  }

  function clearLoadedBuild() {
    state.loadedBuildId = null;
    SDD.BuildTypes.setSelectedInUI([SDD.BuildTypes.defaultId]);
    updateSaveHint();
  }

  function updateSaveHint() {
    const message = state.loadedBuildId
      ? "Updating loaded build — Save applies changes to the existing entry."
      : "";
    document.querySelectorAll("#build-save-hint, #build-save-hint-bottom").forEach((el) => {
      if (!el) return;
      el.hidden = !message;
      el.textContent = message;
    });
  }

  function resetBuild(data) {
    Object.assign(state, initState(data));
    clearLoadedBuild();
    applyLoadout(null);
    document.getElementById("build-name").value = "";
    setPublicCheckbox(false);
    render();
    SDD.toast("Build reset.", "success");
  }

  function maxBuildCost(data) {
    const attrs = {};
    const perks = {};
    data.attributes.forEach((a) => { attrs[a.id] = data.meta.maxAttributeLevel; });
    allPerks(data).forEach((p) => { perks[p.id] = p.maxLevel; });
    return SDD.SkillPoints.calcSpent(attrs, perks, data.meta).total;
  }

  function maxBuild(data) {
    const meta = data.meta;
    const budget = pointsAvailable(state, meta);
    const cost = maxBuildCost(data);
    if (cost > budget) {
      SDD.toast(
        `Max build needs ${cost} skill points but only ${budget} are available at level ${state.playerLevel}.`,
        "error"
      );
      return;
    }
    data.attributes.forEach((a) => {
      state.attributes[a.id] = data.meta.maxAttributeLevel;
    });
    allPerks(data).forEach((p) => {
      state.perks[p.id] = p.maxLevel;
    });
    render();
    SDD.toast("Maximum build applied.", "success");
  }

  function changePerk(perkId, delta) {
    const perk = findPerk(skillsData, perkId);
    if (!perk) return;
    const cur = getPerkLevel(state, perkId);
    if (delta > 0) {
      const check = canIncreasePerk(perk, state, skillsData);
      if (!check.ok) {
        SDD.toast(check.reason, "error");
        return;
      }
      state.perks[perkId] = cur + 1;
    } else if (cur > 0) {
      state.perks[perkId] = cur - 1;
    }
    state.selectedPerkId = perkId;
    state.selectedAttrId = perk.attrId;
    render();
  }

  function changeAttr(attrId, delta) {
    const cur = getAttrLevel(state, attrId);
    if (delta > 0) {
      const check = canIncreaseAttr(attrId, state, skillsData);
      if (!check.ok) {
        SDD.toast(check.reason, "error");
        return;
      }
      state.attributes[attrId] = cur + 1;
    } else if (cur > 0) {
      state.attributes[attrId] = cur - 1;
    }
    state.selectedAttrId = attrId;
    render();
  }

  function getBuilds() {
    return SDD.BuildStore.getAll();
  }

  function setPublicCheckbox(checked) {
    const el = document.getElementById("build-is-public");
    if (el) el.checked = Boolean(checked);
  }

  function getPublicFromUI() {
    const el = document.getElementById("build-is-public");
    return el ? el.checked : false;
  }

  async function saveBuild(name) {
    await SDD.BuildTypes.loadBuildTypes();
    const buildTypes = SDD.BuildTypes.getSelectedFromUI();
    const isPublic = getPublicFromUI();
    if (isPublic && !SDD.Auth.user) {
      SDD.toast("Sign in to share builds in the public gallery.", "error");
      setPublicCheckbox(false);
    }
    try {
      const build = await SDD.BuildStore.save({
        id: state.loadedBuildId || undefined,
        name,
        buildTypes,
        loadout: state.loadout,
        playerLevel: state.playerLevel,
        unlimited: false,
        attributes: { ...state.attributes },
        perks: { ...state.perks },
        isPublic: isPublic && Boolean(SDD.Auth.user),
      });
      const wasUpdate = build._created === false;
      state.loadedBuildId = build.id;
      applyLoadout(build.loadout);
      document.getElementById("build-name").value = build.name;
      SDD.BuildTypes.setSelectedInUI(build.buildTypes ?? build.buildType);
      setPublicCheckbox(build.isPublic);
      updateSaveHint();
      renderBuildList();
      if (isPublic && SDD.Auth.user && !build.isPublic) {
        SDD.toast(
          "Build saved, but public sharing did not stick. Restart the dev server (npm start) and save again.",
          "error"
        );
        return;
      }
      if (SDD.Auth.user) {
        SDD.toast(
          wasUpdate ? `Updated "${build.name}".` : `Saved "${build.name}" to your account.`,
          "success"
        );
      } else {
        SDD.toast(
          wasUpdate ? `Updated "${build.name}".` : `Saved "${build.name}" locally. Sign in to sync.`,
          "success"
        );
      }
    } catch (err) {
      SDD.toast(err.message || "Could not save build.", "error");
    }
  }

  function loadBuild(id) {
    const b = getBuilds().find((x) => x.id === id);
    if (!b) {
      state.loadedBuildId = null;
      updateSaveHint();
      SDD.toast("That build is no longer on your account — save to create a new one.", "error");
      return;
    }
    state.loadedBuildId = b.id;
    state.playerLevel = SDD.SkillPoints.normalizePlayerLevel(skillsData.meta, b);
    state.attributes = { ...b.attributes };
    state.perks = { ...b.perks };
    applyLoadout(b.loadout);
    document.getElementById("build-name").value = b.name;
    SDD.BuildTypes.setSelectedInUI(b.buildTypes ?? b.buildType);
    setPublicCheckbox(b.isPublic);
    updateSaveHint();
    render();
    SDD.toast(`Loaded "${b.name}" — change tags and Save to update.`, "success");
  }

  function applySnapshot(snapshot) {
    const base = initState(skillsData);
    state.playerLevel = snapshot.playerLevel ?? base.playerLevel;
    state.attributes = { ...base.attributes, ...snapshot.attributes };
    state.perks = { ...base.perks, ...snapshot.perks };
    if (snapshot.focusPerk && findPerk(skillsData, snapshot.focusPerk)) {
      state.selectedPerkId = snapshot.focusPerk;
      const perk = findPerk(skillsData, snapshot.focusPerk);
      state.selectedAttrId = perk.attrId;
    }
    render();
  }

  function applyPreset(preset) {
    if (!preset) return;
    clearLoadedBuild();
    document.getElementById("build-name").value = "";
    setPublicCheckbox(false);
    applySnapshot({
      playerLevel: preset.playerLevel,
      attributes: preset.attributes,
      perks: preset.perks,
      focusPerk: preset.focusPerk,
    });
    SDD.toast(`Loaded preset: ${preset.name}.`, "success");
  }

  async function applyCopyFromPublic(id) {
    try {
      const b = await SDD.BuildStore.fetchPublicBuild(id);
      clearLoadedBuild();
      state.playerLevel = SDD.SkillPoints.normalizePlayerLevel(skillsData.meta, b);
      state.attributes = { ...b.attributes };
      state.perks = { ...b.perks };
      applyLoadout(b.loadout);
      document.getElementById("build-name").value = `${b.name} (copy)`;
      SDD.BuildTypes.setSelectedInUI(b.buildTypes ?? b.buildType);
      setPublicCheckbox(false);
      render();
      const author = b.author?.username ? ` by ${b.author.username}` : "";
      SDD.toast(`Copied "${b.name}"${author} — edit and save as your own.`, "success");
    } catch (err) {
      SDD.toast(err.message || "Could not load build.", "error");
    }
  }

  async function deleteBuild(id) {
    try {
      await SDD.BuildStore.delete(id);
      renderBuildList();
    } catch (err) {
      SDD.toast(err.message || "Could not delete build.", "error");
    }
  }

  function updateBuildSyncStatus() {
    const el = document.getElementById("build-sync-status");
    if (!el) return;
    const user = SDD.Auth.user;
    if (user) {
      el.innerHTML = `Signed in as <strong>${SDD.escapeHTML(user.username)}</strong> — builds sync to your account.`;
      return;
    }
    el.innerHTML = `Builds stay in this browser until you sign in. <button type="button" class="build-sync-link" data-auth="signin">Sign in</button> or <button type="button" class="build-sync-link" data-auth="signup">create an account</button> to save them to your profile.`;
    el.querySelectorAll(".build-sync-link").forEach((btn) => {
      btn.addEventListener("click", () => SDD.openAuthModal(btn.dataset.auth));
    });
  }

  function renderHeader() {
    const meta = skillsData.meta;
    const spent = calcSpent(state, meta);
    const avail = pointsAvailable(state, meta);
    const remain = Math.max(0, avail - spent.total);

    document.getElementById("skill-level").value = state.playerLevel;
    document.getElementById("skill-level-val").textContent = state.playerLevel;
    document.getElementById("points-avail").textContent = avail;
    document.getElementById("points-spent").textContent = spent.total;
    document.getElementById("points-remain").textContent = remain;
    document.getElementById("points-attr").textContent = spent.attrSpent;
    document.getElementById("points-perk").textContent = spent.perkSpent;
  }

  function renderColumns() {
    const grid = document.getElementById("skill-columns");
    grid.innerHTML = skillsData.attributes.map((attr) => {
      const lvl = getAttrLevel(state, attr.id);
      const active = state.selectedAttrId === attr.id;
      const attrCheck = canIncreaseAttr(attr.id, state, skillsData);

      const perksHtml = attr.perks.map((perk) => {
        const plvl = getPerkLevel(state, perk.id);
        const selected = state.selectedPerkId === perk.id;
        const canUp = canIncreasePerk(
          { ...perk, attrId: attr.id, attrName: attr.name },
          state,
          skillsData
        );
        const pips = Array.from({ length: perk.maxLevel }, (_, i) => {
          const filled = i < plvl;
          return `<span class="perk-pip ${filled ? "filled" : ""}" style="${filled ? `background:${attr.color}` : ""}"></span>`;
        }).join("");

        return `
          <div class="perk-row ${selected ? "selected" : ""} ${!canUp.ok && plvl < perk.maxLevel ? "locked" : ""}"
               data-perk="${perk.id}" role="button" tabindex="0">
            <div class="perk-row-top">
              <span class="perk-icon">${perk.icon || "•"}</span>
              <span class="perk-name">${SDD.escapeHTML(perk.name)}</span>
              <span class="perk-lvl">${plvl}/${perk.maxLevel}</span>
            </div>
            <div class="perk-pips">${pips}</div>
            <div class="perk-controls">
              <button type="button" class="perk-btn" data-delta="-1" data-perk="${perk.id}" ${plvl === 0 ? "disabled" : ""}>−</button>
              <button type="button" class="perk-btn" data-delta="1" data-perk="${perk.id}" ${!canUp.ok ? "disabled" : ""}>+</button>
            </div>
          </div>`;
      }).join("");

      return `
        <section class="skill-col ${active ? "active-col" : ""}" data-attr="${attr.id}" style="--attr-color:${attr.color}">
          <header class="skill-col-head">
            <button type="button" class="attr-select" data-attr-select="${attr.id}">
              <span class="attr-abbr">${attr.abbr}</span>
              <span class="attr-title">${SDD.escapeHTML(attr.name)}</span>
            </button>
            <div class="attr-level">
              <button type="button" class="perk-btn" data-attr-delta="-1" data-attr="${attr.id}" ${lvl === 0 ? "disabled" : ""}>−</button>
              <span class="attr-lvl-num">${lvl}</span>
              <button type="button" class="perk-btn" data-attr-delta="1" data-attr="${attr.id}" ${!attrCheck.ok ? "disabled" : ""}>+</button>
            </div>
          </header>
          <p class="attr-tagline muted">${SDD.escapeHTML(attr.tagline)}</p>
          <div class="perk-list">${perksHtml}</div>
        </section>`;
    }).join("");

    bindColumnEvents();
  }

  function renderDetail() {
    const panel = document.getElementById("skill-detail");
    const perk = state.selectedPerkId ? findPerk(skillsData, state.selectedPerkId) : null;
    if (!perk) {
      panel.innerHTML = `<p class="muted skill-detail-empty">Select a perk above to see level effects and craft unlocks.</p>`;
      return;
    }

    const lvl = getPerkLevel(state, perk.id);
    const attr = skillsData.attributes.find((a) => a.id === perk.attrId);
    const nextCheck = lvl < perk.maxLevel ? canIncreasePerk(perk, state, skillsData) : null;

    const levelsHtml = perk.levels.map((row, i) => {
      const n = i + 1;
      const active = n <= lvl;
      const isNext = n === lvl + 1;
      return `
        <tr class="${active ? "active" : ""} ${isNext ? "next" : ""}">
          <td><span class="lvl-badge" style="${active ? `border-color:${attr.color};color:${attr.color}` : ""}">${n}</span></td>
          <td>${SDD.escapeHTML(row.effect)}</td>
          <td>${row.craftTier ? `<span class="tag">${SDD.escapeHTML(row.craftTier)}</span>` : "—"}</td>
        </tr>`;
    }).join("");

    panel.innerHTML = `
      <div class="skill-detail-grid">
        <div class="skill-detail-intro">
          <span class="eyebrow" style="color:${attr.color}">${attr.abbr} · ${SDD.escapeHTML(attr.name)}</span>
          <h3 class="detail-title">${SDD.escapeHTML(perk.name)}</h3>
          <p class="muted">${SDD.escapeHTML(perk.summary || "")}</p>
          <div class="detail-level">
            <strong>Current level</strong>
            <span class="detail-lvl-num" style="color:${attr.color}">${lvl} / ${perk.maxLevel}</span>
          </div>
          ${nextCheck && !nextCheck.ok ? `<p class="detail-warn">${SDD.escapeHTML(nextCheck.reason)}</p>` : ""}
        </div>
        <div class="skill-detail-levels">
          <h4>Levels &amp; unlocks</h4>
          <div class="skill-table-wrap">
            <table class="skill-table">
              <thead><tr><th>Lvl</th><th>Effect</th><th>Craft unlock</th></tr></thead>
              <tbody>${levelsHtml}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function renderBuildList() {
    const list = document.getElementById("build-list");
    const builds = getBuilds();
    if (!builds.length) {
      list.innerHTML = `<li class="muted" style="font-size:.85rem;padding:8px 0">No saved builds yet.</li>`;
      return;
    }
    list.innerHTML = builds.map((b) => `
      <li class="build-item">
        <button type="button" class="build-load" data-build="${b.id}">${SDD.escapeHTML(b.name)}</button>
        <span class="build-type-pills">${SDD.BuildTypes.renderTypePills(b.buildTypes ?? b.buildType)}</span>
        <span class="build-meta">${new Date(b.savedAt).toLocaleDateString()}</span>
        <button type="button" class="build-del" data-del-build="${b.id}" aria-label="Delete">×</button>
      </li>`).join("");
    list.querySelectorAll(".build-load").forEach((btn) => {
      btn.addEventListener("click", () => loadBuild(btn.dataset.build));
    });
    list.querySelectorAll(".build-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Delete this saved build?")) deleteBuild(btn.dataset.delBuild);
      });
    });
  }

  function bindColumnEvents() {
    const grid = document.getElementById("skill-columns");

    grid.querySelectorAll(".perk-row[data-perk]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".perk-btn")) return;
        state.selectedPerkId = row.dataset.perk;
        const perk = findPerk(skillsData, state.selectedPerkId);
        if (perk) state.selectedAttrId = perk.attrId;
        render();
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          row.click();
        }
      });
    });

    grid.querySelectorAll("[data-delta]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        changePerk(btn.dataset.perk, parseInt(btn.dataset.delta, 10));
      });
    });

    grid.querySelectorAll("[data-attr-delta]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        changeAttr(btn.dataset.attr, parseInt(btn.dataset.attrDelta, 10));
      });
    });

    grid.querySelectorAll("[data-attr-select]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedAttrId = btn.dataset.attrSelect;
        const attr = skillsData.attributes.find((a) => a.id === state.selectedAttrId);
        if (attr && attr.perks.length) state.selectedPerkId = attr.perks[0].id;
        render();
      });
    });
  }

  function renderLoadout() {
    const weaponsEl = document.getElementById("loadout-weapons");
    const toolsEl = document.getElementById("loadout-tools");
    const outfitEl = document.getElementById("loadout-outfits");
    const modsEl = document.getElementById("loadout-mods");
    const foodEl = document.getElementById("loadout-food");
    const waterEl = document.getElementById("loadout-water");
    const medicalEl = document.getElementById("loadout-medical");
    const vehiclesEl = document.getElementById("loadout-vehicles");
    if (!outfitEl || !modsEl || !SDD.Loadout) return;

    const ctx = {
      catalogItems,
      categories: catalogCategories,
      skillsData,
      gearConfig: perkGearConfig,
      itemStats,
    };

    const {
      weaponsHtml,
      toolsHtml,
      outfitsHtml,
      modsHtml,
      foodHtml,
      waterHtml,
      medicalHtml,
      vehiclesHtml,
    } = SDD.Loadout.renderLoadoutPanel(state.loadout, ctx);

    if (weaponsEl) weaponsEl.innerHTML = weaponsHtml;
    if (toolsEl) toolsEl.innerHTML = toolsHtml;
    outfitEl.innerHTML = outfitsHtml;
    modsEl.innerHTML = modsHtml;
    if (foodEl) foodEl.innerHTML = foodHtml;
    if (waterEl) waterEl.innerHTML = waterHtml;
    if (medicalEl) medicalEl.innerHTML = medicalHtml;
    if (vehiclesEl) vehiclesEl.innerHTML = vehiclesHtml;

    const onLoadoutChange = (next) => {
      applyLoadout(next);
      renderLoadout();
    };

    if (weaponsEl) SDD.Loadout.bindGearGrid(weaponsEl, state.loadout, onLoadoutChange, catalogItems);
    if (toolsEl) SDD.Loadout.bindGearGrid(toolsEl, state.loadout, onLoadoutChange, catalogItems);
    SDD.Loadout.bindOutfitGrid(outfitEl, state.loadout, onLoadoutChange, catalogItems);
    SDD.Loadout.bindModPickers(modsEl, state.loadout, onLoadoutChange, catalogItems);
    if (foodEl) SDD.Loadout.bindGearGrid(foodEl, state.loadout, onLoadoutChange, catalogItems);
    if (waterEl) SDD.Loadout.bindGearGrid(waterEl, state.loadout, onLoadoutChange, catalogItems);
    if (medicalEl) SDD.Loadout.bindGearGrid(medicalEl, state.loadout, onLoadoutChange, catalogItems);
    if (vehiclesEl) SDD.Loadout.bindGearGrid(vehiclesEl, state.loadout, onLoadoutChange, catalogItems);
    if (weaponsEl) SDD.attachItemPhotoHandlers(weaponsEl);
    if (toolsEl) SDD.attachItemPhotoHandlers(toolsEl);
    SDD.attachItemPhotoHandlers(outfitEl);
    SDD.attachItemPhotoHandlers(modsEl);
    if (foodEl) SDD.attachItemPhotoHandlers(foodEl);
    if (waterEl) SDD.attachItemPhotoHandlers(waterEl);
    if (medicalEl) SDD.attachItemPhotoHandlers(medicalEl);
    if (vehiclesEl) SDD.attachItemPhotoHandlers(vehiclesEl);

    const mannequinEl = document.getElementById("loadout-mannequin");
    if (mannequinEl && SDD.Mannequin) {
      SDD.Mannequin.mount(mannequinEl, state.loadout, ctx);
    }
  }

  function render() {
    if (!skillsData) return;
    renderHeader();
    renderColumns();
    renderDetail();
    renderLoadout();
  }

  function bindControls() {
    const levelInput = document.getElementById("skill-level");
    levelInput.addEventListener("input", () => {
      state.playerLevel = parseInt(levelInput.value, 10);
      document.getElementById("skill-level-val").textContent = state.playerLevel;
      render();
    });

    document.getElementById("btn-reset").addEventListener("click", () => resetBuild(skillsData));
    document.getElementById("btn-max").addEventListener("click", () => maxBuild(skillsData));
    const triggerSave = () => saveBuild(document.getElementById("build-name").value);
    document.getElementById("btn-save").addEventListener("click", triggerSave);
    document.getElementById("btn-save-bottom").addEventListener("click", triggerSave);
  }

  async function boot() {
    await SDD.Auth.refresh();
    await SDD.BuildTypes.loadBuildTypes();
    await SDD.PerkGear.loadPerkGear();
    perkGearConfig = await SDD.PerkGear.loadPerkGear();
    await SDD.Loadout.loadData();
    await SDD.BuildStore.load();

    updateSaveHint();

    SDD.Auth.onChange(async () => {
      await SDD.BuildStore.load();
      renderBuildList();
      updateBuildSyncStatus();
    });
    const [skillsRes, itemsRes, statsRes] = await Promise.all([
      fetch("data/skills.json"),
      fetch("data/items.json"),
      fetch("data/item-stats.json"),
      SDD.loadImageManifest(),
      window.ItemTooltips?.loadItemStats?.() || Promise.resolve(),
    ]);
    skillsData = await skillsRes.json();
    const itemsJson = await itemsRes.json();
    catalogItems = itemsJson.items || [];
    catalogCategories = itemsJson.categories || [];
    itemStats = await statsRes.json();
    state = initState(skillsData);

    const params = new URLSearchParams(location.search);
    const buildId = params.get("build");
    const copyId = params.get("copy");
    const presetId = params.get("preset");
    const tagsEl = document.getElementById("build-type-tags");
    let initialTagIds = [SDD.BuildTypes.defaultId];
    if (buildId) {
      const preload = getBuilds().find((x) => x.id === buildId);
      if (preload) initialTagIds = preload.buildTypes ?? preload.buildType;
    }
    if (tagsEl) {
      tagsEl.innerHTML = SDD.BuildTypes.renderTypeCheckboxes(initialTagIds);
    }
    if (buildId) {
      const b = getBuilds().find((x) => x.id === buildId);
      if (b) loadBuild(buildId);
    } else if (copyId) {
      await applyCopyFromPublic(copyId);
    } else if (presetId === "max") {
      maxBuild(skillsData);
    } else if (presetId && skillsData.presets) {
      const preset = skillsData.presets.find((p) => p.id === presetId);
      if (preset) applyPreset(preset);
    }

    bindControls();
    renderBuildList();
    updateBuildSyncStatus();
    render();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
