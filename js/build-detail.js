/* ==========================================================================
   Saved build breakdown — attribute & perk names + current-level effects
   ========================================================================== */

(() => {
  function allPerks(data) {
    return data.attributes.flatMap((a) =>
      a.perks.map((p) => ({
        ...p,
        attrId: a.id,
        attrName: a.name,
        attrAbbr: a.abbr,
        attrColor: a.color,
      }))
    );
  }

  function renderBuildBreakdown(build, skillsData, ctx = {}) {
    const esc = window.SDD.escapeHTML;
    if (!skillsData) {
      return `<p class="muted profile-build-empty">Could not load perk data.</p>`;
    }

    const attrsHtml = skillsData.attributes
      .filter((a) => !a.noAttributeLevels && (build.attributes?.[a.id] || 0) > 0)
      .map((a) => {
        const lvl = build.attributes[a.id];
        return `
          <li class="build-attr-row" style="--attr-color:${a.color}">
            <div class="build-attr-head">
              <span class="build-attr-abbr">${esc(a.abbr)}</span>
              <strong class="build-attr-name">${esc(a.name)}</strong>
              <span class="build-attr-lvl">Lv ${lvl}</span>
            </div>
            <p class="build-attr-tagline muted">${esc(a.tagline)}</p>
          </li>`;
      })
      .join("");

    const perksByAttr = {};
    allPerks(skillsData).forEach((p) => {
      const lvl = build.perks?.[p.id] || 0;
      if (lvl <= 0) return;
      if (!perksByAttr[p.attrId]) perksByAttr[p.attrId] = [];
      const row = p.levels[lvl - 1];
      perksByAttr[p.attrId].push({
        ...p,
        level: lvl,
        effect: row?.effect || p.summary || "",
        craftTier: row?.craftTier || null,
      });
    });

    const perksHtml = skillsData.attributes
      .filter((a) => perksByAttr[a.id]?.length)
      .map((a) => {
        const items = perksByAttr[a.id]
          .map((p) => `
            <li class="build-perk-row">
              <div class="build-perk-head">
                <span class="build-perk-icon" aria-hidden="true">${p.icon || "◆"}</span>
                <strong class="build-perk-name">${esc(p.name)}</strong>
                <span class="build-perk-lvl">${p.level} / ${p.maxLevel}</span>
              </div>
              <p class="build-perk-effect">${esc(p.effect)}</p>
              ${p.craftTier ? `<p class="build-perk-craft muted">Craft unlock: ${esc(p.craftTier)}</p>` : ""}
            </li>`)
          .join("");
        return `
          <section class="build-perk-group" style="--attr-color:${a.color}">
            <h4 class="build-perk-group-title">${esc(a.name)} perks</h4>
            <ul class="build-perk-list">${items}</ul>
          </section>`;
      })
      .join("");

    const hasAttrs = Boolean(attrsHtml);
    const hasPerks = Boolean(perksHtml);
    const loadoutHtml = window.SDD.Loadout?.renderLoadoutSummary(
      build.loadout,
      ctx.items,
      ctx.categories,
      ctx.itemStats
    ) || "";
    const mannequinHtml = window.SDD.Mannequin?.hasMannequinGear(build.loadout, ctx.items)
      ? `<div class="build-mannequin-wrap">${window.SDD.Mannequin.renderMannequinHtml(build.loadout, ctx, { compact: true })}</div>`
      : "";

    if (!hasAttrs && !hasPerks && !loadoutHtml && !mannequinHtml) {
      return `<p class="muted profile-build-empty">No points allocated in this build.</p>`;
    }

    return `
      ${hasAttrs ? `
        <section class="build-section">
          <h4 class="build-section-title">Attributes</h4>
          <ul class="build-attr-list">${attrsHtml}</ul>
        </section>` : ""}
      ${hasPerks ? perksHtml : (hasAttrs && !loadoutHtml && !mannequinHtml ? `<p class="muted profile-build-hint">No perk points spent yet — attributes only.</p>` : "")}
      ${mannequinHtml}
      ${loadoutHtml}`;
  }

  window.SDD.renderBuildBreakdown = renderBuildBreakdown;
})();
