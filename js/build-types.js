/* ==========================================================================
   Build content types — crafting, horde, PvP, etc. (multi-select)
   ========================================================================== */

(() => {
  const KNOWN_TYPE_IDS = new Set([
    "general", "horde", "pvp", "solo", "crafting", "gathering", "farming",
  ]);
  const FALLBACK_TYPES = [
    { id: "general", label: "General", description: "Flexible all-purpose build" },
    { id: "horde", label: "Zombie hordes", description: "Blood moon and horde night defense" },
    { id: "pvp", label: "PvP", description: "Player vs player combat and raiding" },
    { id: "solo", label: "Solo play", description: "Single-player survival and self-sufficiency" },
    { id: "crafting", label: "Crafting", description: "Workstations, recipes, and item quality" },
    { id: "gathering", label: "Gathering", description: "Mining, looting, and resource hauls" },
    { id: "farming", label: "Farming", description: "Crops, food, and sustainable supplies" },
  ];
  let types = [];
  let defaultId = "general";
  let loaded = false;

  async function loadBuildTypes() {
    if (loaded) return types;
    try {
      const res = await fetch("data/build-types.json");
      const data = await res.json();
      types = data.types || [];
      defaultId = data.default || types[0]?.id || "general";
      loaded = true;
    } catch (_) {
      types = FALLBACK_TYPES;
      defaultId = "general";
      loaded = true;
    }
    return types;
  }

  /** Accept legacy string, array, or build object fields → deduped valid ids */
  function normalizeBuildTypes(input) {
    let raw = input;
    if (input && typeof input === "object" && !Array.isArray(input)) {
      raw = input.buildTypes ?? input.build_types ?? input.buildType ?? input.build_type;
    }
    if (raw == null || raw === "") raw = [defaultId];
    if (!Array.isArray(raw)) raw = [raw];
    const out = [];
    for (const entry of raw) {
      const id = String(entry || "").trim();
      if (id && (types.some((t) => t.id === id) || KNOWN_TYPE_IDS.has(id)) && !out.includes(id)) out.push(id);
    }
    return out.length ? out : [defaultId];
  }

  function getBuildType(id) {
    const match = types.find((t) => t.id === id);
    if (match) return match;
    return types.find((t) => t.id === defaultId) || { id: defaultId, label: "General" };
  }

  function renderTypeCheckboxes(selectedIds = []) {
    const esc = window.SDD?.escapeHTML || ((s) => s);
    const sel = new Set(normalizeBuildTypes(selectedIds));
    return types.map((t) => `
      <label class="build-type-chip">
        <input type="checkbox" name="build-type" value="${esc(t.id)}"${sel.has(t.id) ? " checked" : ""} />
        <span>${esc(t.label)}</span>
      </label>`).join("");
  }

  function setSelectedInUI(selectedIds) {
    const sel = new Set(normalizeBuildTypes(selectedIds));
    document.querySelectorAll('#build-type-tags input[name="build-type"]').forEach((input) => {
      input.checked = sel.has(input.value);
    });
  }

  function getSelectedFromUI() {
    const checked = [...document.querySelectorAll('#build-type-tags input[name="build-type"]:checked')]
      .map((input) => input.value);
    return normalizeBuildTypes(checked);
  }

  function renderTypePills(ids) {
    const esc = window.SDD?.escapeHTML || ((s) => s);
    return normalizeBuildTypes(ids).map((id) => {
      const t = getBuildType(id);
      return `<span class="build-type-pill" data-type="${esc(t.id)}">${esc(t.label)}</span>`;
    }).join("");
  }

  /** @deprecated single pill — use renderTypePills */
  function renderTypePill(id) {
    return renderTypePills(id);
  }

  function typeDescriptions(ids) {
    return normalizeBuildTypes(ids)
      .map((id) => getBuildType(id).description)
      .filter(Boolean)
      .join(" · ");
  }

  function buildHasType(build, typeId) {
    return normalizeBuildTypes(build?.buildTypes ?? build?.buildType).includes(typeId);
  }

  window.SDD = window.SDD || {};
  window.SDD.BuildTypes = {
    loadBuildTypes,
    getBuildType,
    normalizeBuildTypes,
    normalizeBuildType: (id) => normalizeBuildTypes(id)[0],
    renderTypeCheckboxes,
    setSelectedInUI,
    getSelectedFromUI,
    renderTypePills,
    renderTypePill,
    typeDescriptions,
    buildHasType,
    get defaultId() { return defaultId; },
    get all() { return [...types]; },
  };
})();
