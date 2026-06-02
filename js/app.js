/* ==========================================================================
   Shared client-side logic.
   - Auth via the Express backend (cookie session).
   - Favorites + uploaded photos persisted in localStorage, keyed per user.
   - Tiny utility helpers (toast, modal, escapeHTML).
   ========================================================================== */

(() => {
  const API = ""; // same-origin

  // -------------------------------------------------------------------------
  // Auth API
  // -------------------------------------------------------------------------
  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok) {
      let message = (json && json.error) || `Request failed (${res.status})`;
      if ((res.status === 405 || res.status === 501) && path.startsWith("/api/")) {
        message = "Auth server unavailable. Use npm start locally (http://localhost:3000) or your deployed Railway URL — not Live Server or opening HTML files directly.";
      } else if (res.status === 404 && path.startsWith("/api/")) {
        message = "Auth API not found. Start the Express server with npm start, or deploy the latest server.js to Railway.";
      }
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  const Auth = {
    user: null,
    listeners: new Set(),
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    notify() { this.listeners.forEach((fn) => fn(this.user)); },

    async refresh() {
      try {
        const data = await api("/api/me");
        this.user = data.user;
      } catch (_) {
        this.user = null;
      }
      this.notify();
      return this.user;
    },
    async signup({ username, email, password }) {
      const data = await api("/api/signup", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      this.user = data.user;
      await BuildStore.migrateGuestBuilds();
      await Store.syncFavoritesOnLogin();
      this.notify();
      return data.user;
    },
    async login({ email, password }) {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      this.user = data.user;
      await BuildStore.migrateGuestBuilds();
      await Store.syncFavoritesOnLogin();
      this.notify();
      return data.user;
    },
    async logout() {
      try { await api("/api/logout", { method: "POST" }); } catch (_) {}
      this.user = null;
      this.notify();
    },
    async requestPasswordReset(email) {
      return api("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    async resetPassword({ token, password }) {
      return api("/api/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
    },
  };

  // -------------------------------------------------------------------------
  // Per-user local store (favorites, photos)
  // -------------------------------------------------------------------------
  const Store = {
    key(suffix) {
      const id = Auth.user ? Auth.user.id : "guest";
      return `7dtd:${suffix}:${id}`;
    },
    _favSyncTimer: null,
    getFavorites() {
      try { return JSON.parse(localStorage.getItem(this.key("favs")) || "[]"); }
      catch (_) { return []; }
    },
    setFavorites(arr) {
      localStorage.setItem(this.key("favs"), JSON.stringify(arr));
    },
    async pushFavoritesToServer(favs) {
      if (!Auth.user) return;
      await api("/api/favorites", {
        method: "PUT",
        body: JSON.stringify({ favorites: favs }),
      });
    },
    scheduleFavoritesSync(favs) {
      if (!Auth.user) return;
      clearTimeout(this._favSyncTimer);
      this._favSyncTimer = setTimeout(() => {
        this.pushFavoritesToServer(favs).catch(() => {});
      }, 400);
    },
    async syncFavoritesOnLogin() {
      let guestFavs = [];
      try { guestFavs = JSON.parse(localStorage.getItem("7dtd:favs:guest") || "[]"); }
      catch (_) {}
      try {
        const data = await api("/api/favorites");
        const serverFavs = data.favorites || [];
        const merged = [...new Set([...serverFavs, ...guestFavs])].slice(0, 200);
        this.setFavorites(merged);
        if (merged.length !== serverFavs.length || guestFavs.length) {
          await this.pushFavoritesToServer(merged);
        }
      } catch (_) {}
    },
    async toggleFavorite(itemId) {
      const favs = this.getFavorites();
      const i = favs.indexOf(itemId);
      if (i >= 0) favs.splice(i, 1);
      else favs.push(itemId);
      this.setFavorites(favs);
      this.scheduleFavoritesSync(favs);
      return i < 0; // true when newly added
    },
    isFavorite(itemId) { return this.getFavorites().includes(itemId); },

    getPhotos() {
      try { return JSON.parse(localStorage.getItem(this.key("photos")) || "[]"); }
      catch (_) { return []; }
    },
    addPhoto(photo) {
      const all = this.getPhotos();
      all.unshift(photo);
      localStorage.setItem(this.key("photos"), JSON.stringify(all));
    },
    removePhoto(id) {
      const all = this.getPhotos().filter((p) => p.id !== id);
      localStorage.setItem(this.key("photos"), JSON.stringify(all));
    },
  };

  // -------------------------------------------------------------------------
  // Skill builds — server when signed in, localStorage for guests
  // -------------------------------------------------------------------------
  const LEGACY_BUILDS_KEY = "7dtd:builds";
  const MAX_BUILDS = 24;

  function readBuildsLocal(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (_) { return []; }
  }

  function writeBuildsLocal(key, builds) {
    localStorage.setItem(key, JSON.stringify(builds.slice(0, MAX_BUILDS)));
  }

  const BuildStore = {
    _builds: [],

    storageKey() {
      const id = Auth.user ? Auth.user.id : "guest";
      return `7dtd:builds:${id}`;
    },

    getAll() { return [...this._builds]; },

    async load() {
      if (Auth.user) {
        try {
          const data = await api("/api/builds");
          this._builds = data.builds || [];
          writeBuildsLocal(this.storageKey(), this._builds);
        } catch (_) {
          this._builds = readBuildsLocal(this.storageKey());
        }
      } else {
        const key = this.storageKey();
        this._builds = readBuildsLocal(key);
        const legacy = readBuildsLocal(LEGACY_BUILDS_KEY);
        if (legacy.length && !this._builds.length) {
          this._builds = legacy;
          writeBuildsLocal(key, this._builds);
        }
      }
      return this._builds;
    },

    async save({ id, name, buildTypes, buildType, loadout, playerLevel, unlimited, attributes, perks, isPublic }) {
      if (window.SDD?.BuildTypes?.loadBuildTypes) {
        await SDD.BuildTypes.loadBuildTypes();
      }
      const types = Array.isArray(buildTypes) && buildTypes.length
        ? SDD.BuildTypes.normalizeBuildTypes(buildTypes)
        : (SDD.BuildTypes?.normalizeBuildTypes(buildType) || ["general"]);
      const payload = {
        name: String(name || "").trim() || "Untitled build",
        buildTypes: types,
        loadout: loadout || {
          weapons: [], armorSet: null, armorQuality: 6, mods: {}, food: [], water: [], medical: [], tools: [], vehicles: [], itemQualities: {},
        },
        playerLevel,
        unlimited,
        attributes,
        perks,
        isPublic: Boolean(isPublic),
      };

      if (Auth.user) {
        let targetId = id || null;
        if (targetId) {
          await this.load();
          if (!this._builds.some((b) => b.id === targetId)) targetId = null;
        }

        if (targetId) {
          try {
            const data = await api(`/api/builds/${encodeURIComponent(targetId)}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
            const idx = this._builds.findIndex((b) => b.id === targetId);
            if (idx >= 0) this._builds[idx] = data.build;
            else this._builds.unshift(data.build);
            writeBuildsLocal(this.storageKey(), this._builds);
            return { ...data.build, _created: false };
          } catch (err) {
            if (err.status !== 404) throw err;
            targetId = null;
          }
        }

        const data = await api("/api/builds", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        this._builds.unshift(data.build);
        writeBuildsLocal(this.storageKey(), this._builds);
        return { ...data.build, _created: true };
      }

      if (id) {
        const idx = this._builds.findIndex((b) => b.id === id);
        if (idx >= 0) {
          this._builds[idx] = {
            ...this._builds[idx],
            ...payload,
            buildType: types[0],
            isPublic: Boolean(isPublic),
            savedAt: new Date().toISOString(),
          };
          writeBuildsLocal(this.storageKey(), this._builds);
          return { ...this._builds[idx], _created: false };
        }
      }

      const build = {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        buildType: types[0],
        isPublic: Boolean(isPublic),
        ...payload,
      };
      this._builds.unshift(build);
      writeBuildsLocal(this.storageKey(), this._builds);
      return { ...build, _created: true };
    },

    async delete(id) {
      if (Auth.user) {
        await api(`/api/builds/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      this._builds = this._builds.filter((b) => b.id !== id);
      writeBuildsLocal(this.storageKey(), this._builds);
    },

    async fetchPublicBuilds(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value != null && String(value).trim() !== "") qs.set(key, String(value).trim());
      });
      const suffix = qs.toString() ? `?${qs}` : "";
      const res = await fetch(`/api/builds/public${suffix}`);
      if (!res.ok) throw new Error("Could not load public builds.");
      const data = await res.json();
      return data.builds || [];
    },

    async fetchPublicBuild(id) {
      const res = await fetch(`/api/builds/public/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Build not found or not shared publicly.");
      const data = await res.json();
      return data.build;
    },

    async copyPublicBuild(build, name) {
      if (!build) throw new Error("No build to copy.");
      const saved = await this.save({
        name: String(name || `${build.name} (copy)`).trim() || "Untitled build",
        buildTypes: build.buildTypes ?? build.buildType,
        loadout: build.loadout,
        playerLevel: build.playerLevel,
        unlimited: build.unlimited,
        attributes: build.attributes,
        perks: build.perks,
        isPublic: false,
      });
      if (build.id) {
        try { await this.recordPublicCopy(build.id); } catch (_) {}
      }
      return saved;
    },

    async recordPublicCopy(id) {
      const res = await fetch(`/api/builds/public/${encodeURIComponent(id)}/copy`, { method: "POST" });
      if (!res.ok) return null;
      return res.json();
    },

    async toggleUpvote(id) {
      return api(`/api/builds/public/${encodeURIComponent(id)}/upvote`, { method: "POST" });
    },

    async fetchComments(id) {
      const res = await fetch(`/api/builds/public/${encodeURIComponent(id)}/comments`);
      if (!res.ok) throw new Error("Could not load comments.");
      const data = await res.json();
      return data.comments || [];
    },

    async postComment(id, text) {
      return api(`/api/builds/public/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    },

    async fetchPublicProfile(username) {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`);
      if (!res.ok) throw new Error("Profile not found.");
      return res.json();
    },

    async updateProfile({ bio, profilePublic }) {
      const data = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ bio, profilePublic }),
      });
      if (data.user && Auth.user) {
        Auth.user = { ...Auth.user, ...data.user };
        Auth.notify();
      }
      return data.user;
    },

    async setPublic(id, isPublic) {
      if (!Auth.user) throw new Error("Sign in to manage build visibility.");
      await this.load();
      const existing = this._builds.find((b) => b.id === id);
      if (!existing) throw new Error("Build not found.");
      const data = await api(`/api/builds/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          name: existing.name,
          buildTypes: existing.buildTypes ?? existing.buildType,
          loadout: existing.loadout,
          playerLevel: existing.playerLevel,
          unlimited: existing.unlimited,
          attributes: existing.attributes,
          perks: existing.perks,
          isPublic: Boolean(isPublic),
        }),
      });
      if (Boolean(data.build?.isPublic) !== Boolean(isPublic)) {
        throw new Error(
          "Server did not update build visibility. Restart the dev server (npm start) and try again."
        );
      }
      const idx = this._builds.findIndex((b) => b.id === id);
      if (idx >= 0) this._builds[idx] = data.build;
      else this._builds.unshift(data.build);
      writeBuildsLocal(this.storageKey(), this._builds);
      return data.build;
    },

    async migrateGuestBuilds() {
      if (!Auth.user) return;
      const guestBuilds = [
        ...readBuildsLocal("7dtd:builds:guest"),
        ...readBuildsLocal(LEGACY_BUILDS_KEY),
      ];
      if (!guestBuilds.length) return;

      await this.load();
      const seen = new Set(this._builds.map((b) => `${b.name}|${b.savedAt}`));

      for (const b of guestBuilds) {
        const sig = `${b.name}|${b.savedAt}`;
        if (seen.has(sig)) continue;
        if (this._builds.length >= MAX_BUILDS) break;
        try {
          await api("/api/builds", {
            method: "POST",
            body: JSON.stringify({
              name: b.name,
              buildTypes: b.buildTypes ?? b.buildType,
              loadout: b.loadout,
              playerLevel: b.playerLevel,
              unlimited: b.unlimited,
              attributes: b.attributes,
              perks: b.perks,
            }),
          });
          seen.add(sig);
        } catch (_) {
          break;
        }
      }

      localStorage.removeItem(LEGACY_BUILDS_KEY);
      writeBuildsLocal("7dtd:builds:guest", []);
      await this.load();
    },
  };

  // -------------------------------------------------------------------------
  // Toast
  // -------------------------------------------------------------------------
  function toast(message, type = "") {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `toast ${type} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // -------------------------------------------------------------------------
  // Auth modal helper
  // -------------------------------------------------------------------------
  function openAuthModal(initialMode = "signin") {
    let backdrop = document.getElementById("auth-modal");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "auth-modal";
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button class="modal-close" aria-label="Close">×</button>
          <span class="eyebrow">Survivor Access</span>
          <h2 id="auth-title">Welcome back</h2>

          <div class="tab-row" id="auth-tabs">
            <button data-tab="signin" class="active" type="button">Sign in</button>
            <button data-tab="signup" type="button">Create account</button>
          </div>

          <form class="form" id="auth-form" novalidate>
            <div class="err" id="auth-err"></div>
            <div class="form-group username-only" hidden>
              <label for="auth-username">Username</label>
              <input id="auth-username" type="text" autocomplete="username" minlength="3" />
            </div>
            <div class="form-group">
              <label for="auth-email">Email</label>
              <input id="auth-email" type="email" autocomplete="email" required />
            </div>
            <div class="form-group password-only">
              <label for="auth-password">Password</label>
              <input id="auth-password" type="password" autocomplete="current-password" minlength="6" required />
              <span class="hint">Minimum 6 characters.</span>
            </div>
            <p class="auth-forgot-wrap signin-only">
              <button type="button" class="auth-link-btn" id="auth-forgot-trigger">Forgot password?</button>
            </p>
            <button class="btn btn-primary btn-block btn-lg" type="submit" id="auth-submit">Sign in</button>
          </form>

          <form class="form" id="auth-forgot-form" hidden novalidate>
            <div class="err" id="auth-forgot-err"></div>
            <p class="muted auth-forgot-copy">
              Enter the email on your account. We will generate a one-time reset link valid for one hour.
            </p>
            <div class="form-group">
              <label for="auth-forgot-email">Email</label>
              <input id="auth-forgot-email" type="email" autocomplete="email" required />
            </div>
            <button class="btn btn-primary btn-block btn-lg" type="submit" id="auth-forgot-submit">Send reset link</button>
            <button type="button" class="btn btn-ghost btn-block" id="auth-forgot-back">Back to sign in</button>
          </form>

          <div id="auth-forgot-success" class="auth-forgot-success" hidden>
            <p class="muted" id="auth-forgot-success-msg"></p>
            <div id="auth-reset-link-wrap" class="auth-reset-link-wrap" hidden>
              <a id="auth-reset-link" class="btn btn-primary btn-block" href="#">Open reset page</a>
              <p class="hint">Save this link somewhere safe. It expires in one hour and can only be used once.</p>
            </div>
            <button type="button" class="btn btn-ghost btn-block" id="auth-forgot-done">Back to sign in</button>
          </div>
        </div>`;
      document.body.appendChild(backdrop);

      const close = () => backdrop.classList.remove("open");
      backdrop.querySelector(".modal-close").addEventListener("click", close);
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });

      const tabs = backdrop.querySelectorAll("#auth-tabs button");
      const authForm = backdrop.querySelector("#auth-form");
      const forgotForm = backdrop.querySelector("#auth-forgot-form");
      const forgotSuccess = backdrop.querySelector("#auth-forgot-success");
      const resetLinkWrap = backdrop.querySelector("#auth-reset-link-wrap");
      const resetLink = backdrop.querySelector("#auth-reset-link");

      const showForgotSuccess = (data) => {
        authForm.hidden = true;
        forgotForm.hidden = true;
        forgotSuccess.hidden = false;
        backdrop.querySelector("#auth-forgot-success-msg").textContent = data.message || "Check your email for a reset link.";
        if (data.resetUrl) {
          resetLink.href = data.resetUrl;
          resetLinkWrap.hidden = false;
        } else {
          resetLinkWrap.hidden = true;
        }
      };

      const setMode = (mode) => {
        backdrop.dataset.mode = mode;
        forgotSuccess.hidden = true;
        resetLinkWrap.hidden = true;
        backdrop.querySelector("#auth-err").classList.remove("show");
        backdrop.querySelector("#auth-forgot-err").classList.remove("show");

        const isSignup = mode === "signup";
        const isForgot = mode === "forgot";

        backdrop.querySelector("#auth-tabs").hidden = isForgot;
        authForm.hidden = isForgot;
        forgotForm.hidden = !isForgot;

        if (!isForgot) {
          tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === mode));
          backdrop.querySelector(".username-only").hidden = !isSignup;
          backdrop.querySelector(".password-only").hidden = false;
          backdrop.querySelector(".signin-only").hidden = isSignup;
          backdrop.querySelector("#auth-title").textContent = isSignup ? "Create your survivor profile" : "Welcome back";
          backdrop.querySelector("#auth-submit").textContent = isSignup ? "Create account" : "Sign in";
          backdrop.querySelector("#auth-password").autocomplete = isSignup ? "new-password" : "current-password";
          backdrop.querySelector("#auth-password").required = true;
        } else {
          backdrop.querySelector("#auth-title").textContent = "Reset your password";
          const signinEmail = backdrop.querySelector("#auth-email").value.trim();
          backdrop.querySelector("#auth-forgot-email").value = signinEmail;
        }
      };
      tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.tab)));
      backdrop.querySelector("#auth-forgot-trigger").addEventListener("click", () => setMode("forgot"));
      backdrop.querySelector("#auth-forgot-back").addEventListener("click", () => setMode("signin"));
      backdrop.querySelector("#auth-forgot-done").addEventListener("click", () => setMode("signin"));
      backdrop._setMode = setMode;

      const form = authForm;
      const errEl = backdrop.querySelector("#auth-err");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errEl.classList.remove("show");
        const mode = backdrop.dataset.mode === "signup" ? "signup" : "signin";
        const email = backdrop.querySelector("#auth-email").value.trim();
        const password = backdrop.querySelector("#auth-password").value;
        const username = backdrop.querySelector("#auth-username").value.trim();
        const submit = backdrop.querySelector("#auth-submit");
        submit.disabled = true;
        submit.innerHTML = '<span class="spinner"></span>';
        try {
          if (mode === "signup") {
            if (!username || username.length < 3) throw new Error("Username must be at least 3 characters.");
            await Auth.signup({ username, email, password });
            toast("Welcome to the wasteland.", "success");
          } else {
            await Auth.login({ email, password });
            toast("Welcome back.", "success");
          }
          close();
        } catch (err) {
          errEl.textContent = err.message;
          errEl.classList.add("show");
        } finally {
          submit.disabled = false;
          submit.textContent = mode === "signup" ? "Create account" : "Sign in";
        }
      });

      const forgotErrEl = backdrop.querySelector("#auth-forgot-err");
      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        forgotErrEl.classList.remove("show");
        const email = backdrop.querySelector("#auth-forgot-email").value.trim();
        const submit = backdrop.querySelector("#auth-forgot-submit");
        submit.disabled = true;
        submit.innerHTML = '<span class="spinner"></span>';
        try {
          const data = await Auth.requestPasswordReset(email);
          showForgotSuccess(data);
        } catch (err) {
          forgotErrEl.textContent = err.message;
          forgotErrEl.classList.add("show");
        } finally {
          submit.disabled = false;
          submit.textContent = "Send reset link";
        }
      });
    }
    backdrop._setMode(initialMode === "forgot" ? "forgot" : initialMode);
    backdrop.classList.add("open");
    setTimeout(() => {
      const focusEl = initialMode === "forgot"
        ? backdrop.querySelector("#auth-forgot-email")
        : backdrop.querySelector("#auth-email");
      focusEl?.focus();
    }, 100);
  }

  // -------------------------------------------------------------------------
  // Mobile navigation
  // -------------------------------------------------------------------------
  function setupMobileNav() {
    const nav = document.querySelector(".nav");
    if (!nav || nav.querySelector(".nav-toggle")) return;
    const links = nav.querySelector(".nav-links");
    if (!links) return;

    const auth = document.createElement("div");
    auth.className = "nav-menu-auth";
    auth.setAttribute("aria-label", "Account");

    const divider = document.createElement("hr");
    divider.className = "nav-menu-divider";

    const panel = document.createElement("div");
    panel.className = "nav-mobile-panel";
    panel.id = "site-nav-panel";
    panel.appendChild(auth);
    panel.appendChild(divider);

    // Keep .nav-links in place so desktop layout stays: brand | links | cta
    nav.insertBefore(panel, links);

    const toggle = document.createElement("button");
    toggle.className = "nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Open menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", panel.id);
    toggle.innerHTML = "<span></span><span></span><span></span>";
    nav.appendChild(toggle);

    const closeMenu = () => {
      nav.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      document.body.classList.remove("nav-menu-open");
    };

    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("nav-open");
      nav.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("nav-menu-open", open);
    });

    panel.addEventListener("click", (e) => {
      if (e.target.closest("a[href], button")) closeMenu();
    });
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  function bindAuthButtons(root, nav) {
    if (!root) return;
    root.querySelectorAll("[data-auth]").forEach((b) => {
      b.addEventListener("click", () => {
        nav?.classList.remove("nav-open");
        document.body.classList.remove("nav-menu-open");
        openAuthModal(b.dataset.auth);
      });
    });
  }

  function bindLogout(btn, nav) {
    if (!btn) return;
    btn.addEventListener("click", async () => {
      nav?.classList.remove("nav-open");
      document.body.classList.remove("nav-menu-open");
      await Auth.logout();
      toast("Signed out.");
      if (location.pathname.endsWith("profile.html")) location.href = "index.html";
    });
  }

  // -------------------------------------------------------------------------
  // Nav rendering
  // -------------------------------------------------------------------------
  function renderNav() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const cta = nav.querySelector(".nav-cta");
    if (!cta) return;
    const menuAuth = nav.querySelector(".nav-menu-auth");

    if (Auth.user) {
      cta.innerHTML = `
        <a href="profile.html" class="btn btn-ghost nav-profile-btn">
          <span class="avatar" style="width:24px;height:24px;font-size:.75rem">${Auth.user.username.charAt(0).toUpperCase()}</span>
          <span class="nav-profile-name">${escapeHTML(Auth.user.username)}</span>
        </a>
        <button class="btn btn-sm" id="nav-logout" type="button">Sign out</button>`;
      bindLogout(cta.querySelector("#nav-logout"), nav);

      if (menuAuth) {
        menuAuth.innerHTML = `
          <a href="profile.html" class="nav-menu-link">${escapeHTML(Auth.user.username)}</a>
          <button type="button" class="nav-menu-link nav-menu-btn" id="nav-menu-logout">Sign out</button>`;
        bindLogout(menuAuth.querySelector("#nav-menu-logout"), nav);
      }
    } else {
      cta.innerHTML = `
        <button class="btn btn-ghost" data-auth="signin" type="button">Sign in</button>
        <button class="btn btn-primary" data-auth="signup" type="button">Create account</button>`;
      bindAuthButtons(cta, nav);

      if (menuAuth) {
        menuAuth.innerHTML = `
          <button type="button" class="nav-menu-link nav-menu-btn nav-menu-link--primary" data-auth="signup">Create Account</button>
          <button type="button" class="nav-menu-link nav-menu-btn" data-auth="signin">Sign-in</button>`;
        bindAuthButtons(menuAuth, nav);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Reveal on scroll
  // -------------------------------------------------------------------------
  function setupBackendBanner() {
    const bannerId = "sdd-backend-banner";
    if (document.getElementById(bannerId)) return;

    fetch("/health", { method: "GET", cache: "no-store" })
      .then((res) => {
        if (res.ok) return;
        throw new Error("unhealthy");
      })
      .catch(() => {
        const banner = document.createElement("div");
        banner.id = bannerId;
        banner.className = "backend-banner";
        banner.setAttribute("role", "status");
        banner.innerHTML =
          'Account features may be unavailable — the server isn\u2019t responding. Catalog pages still work. ' +
          '<button type="button" class="backend-banner-dismiss" aria-label="Dismiss">\u00d7</button>';
        document.body.prepend(banner);
        document.body.classList.add("has-backend-banner");
        banner.querySelector(".backend-banner-dismiss")?.addEventListener("click", () => {
          banner.remove();
          document.body.classList.remove("has-backend-banner");
        });
      });
  }

  function setupReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;

    const show = (el) => el.classList.add("in");

    const revealVisibleNow = () => {
      els.forEach((el) => {
        if (el.classList.contains("in")) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) show(el);
      });
    };

    if (!("IntersectionObserver" in window)) {
      els.forEach(show);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          show(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -40px 0px" });

    els.forEach((e) => io.observe(e));
    revealVisibleNow();
    window.addEventListener("load", revealVisibleNow, { once: true });
    window.addEventListener("resize", revealVisibleNow);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function escapeHTML(s = "") {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // -------------------------------------------------------------------------
  // Procedural item thumbnail (SVG)
  //   Returns a self-contained <svg> string with:
  //   - dark surface gradient + tier-tinted glow
  //   - category glyph (low-opacity, behind initials)
  //   - 2-letter initials, large, display font
  //   - tier dots and category label
  //   Each card gets a visually distinct, on-brand thumbnail.
  // -------------------------------------------------------------------------
  const TIER_COLOR = { 1: "#9aa0a6", 2: "#5fa8ff", 3: "#ff7a3a" };

  // 24x24 viewbox path data for each category, drawn with stroke="currentColor"
  const GLYPHS = {
    "weapons-melee":  '<path d="M2 22 L9 15 M9 15 L4 10 L8 6 L18 16 L14 20 L9 15 M14 6 L18 2 L22 6 L18 10" />',
    "weapons-ranged": '<circle cx="12" cy="12" r="6" /><path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />',
    "ammo":           '<path d="M9 22 V8 Q9 2 12 2 Q15 2 15 8 V22 Z" /><path d="M9 14 H15 M9 18 H15" />',
    "tools":          '<path d="M3 21 L11 13 M11 13 L9 11 L13 7 L17 11 L21 7 L19 5 L23 1" /><path d="M9 11 L17 19 L21 15 L13 7" />',
    "food":           '<path d="M5 9 H19 L17 21 H7 Z" /><path d="M8 9 V5 Q8 3 12 3 Q16 3 16 5 V9" />',
    "medical":        '<path d="M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z" />',
    "resources":      '<path d="M12 2 L21 8 L18 21 H6 L3 8 Z" /><path d="M12 2 V21 M3 8 L21 8" />',
    "blocks":         '<path d="M4 7 L12 3 L20 7 L12 11 Z" /><path d="M4 7 V17 L12 21 V11 M20 7 V17 L12 21" />',
    "traps":          '<path d="M2 20 L5 10 L8 20 L11 10 L14 20 L17 10 L20 20 L23 10" />',
    "vehicles":       '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3 V9 M12 15 V21 M3 12 H9 M15 12 H21" />',
    "clothing":       '<path d="M12 2 L20 5 V12 Q20 18 12 22 Q4 18 4 12 V5 Z" />',
    "mods":           '<path d="M8 4 H16 V8 H20 V16 H16 V20 H8 V16 H4 V8 H8 Z" /><path d="M10 10 H14 V14 H10 Z" />',
    "mods-weapon":    '<path d="M8 4 H16 V8 H20 V16 H16 V20 H8 V16 H4 V8 H8 Z" /><path d="M10 10 H14 V14 H10 Z" />',
    "mods-armor":     '<path d="M12 2 L20 5 V12 Q20 18 12 22 Q4 18 4 12 V5 Z" /><circle cx="20" cy="4" r="2" />',
    "mods-melee":     '<path d="M2 22 L9 15 M9 15 L4 10 L8 6 L18 16" />',
    "mods-vehicle":   '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />',
    "mods-drone":     '<rect x="6" y="8" width="12" height="8" rx="2" /><path d="M12 4 V8 M8 16 L4 20 M16 16 L20 20" />',
    "robotics":       '<rect x="7" y="7" width="10" height="10" rx="2" /><path d="M12 3 V7 M12 17 V21 M3 12 H7 M17 12 H21" />',
    "vehicle-parts":  '<circle cx="8" cy="18" r="3" /><circle cx="16" cy="18" r="3" /><path d="M5 14 H19 L17 8 H7 Z" />',
    "enemies":        '<circle cx="9" cy="10" r="2" /><circle cx="15" cy="10" r="2" /><path d="M8 16 Q12 20 16 16" /><path d="M12 3 V6" />',
    "wildlife":       '<path d="M6 18 Q8 12 12 10 Q16 12 18 18" /><circle cx="10" cy="9" r="1" /><circle cx="14" cy="9" r="1" />',
  };

  function initialsFor(name) {
    const clean = String(name).replace(/[^A-Za-z0-9. ]/g, " ").trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (!words.length) return "??";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // Which catalog items have a synced PNG in images/items/ (see npm run icons:github)
  let imageManifest = {};
  let imageManifestVersion = "";

  function normalizeManifest(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    imageManifestVersion = String(raw._version || raw._generated || "");
    for (const [key, val] of Object.entries(raw)) {
      if (key.startsWith("_")) continue;
      if (val) out[key] = true;
    }
    return out;
  }

  function itemImageUrl(itemId) {
    const base = `images/items/${encodeURIComponent(itemId)}.png`;
    return imageManifestVersion ? `${base}?v=${encodeURIComponent(imageManifestVersion)}` : base;
  }

  function hasItemImage(itemId) {
    return Boolean(imageManifest[itemId]);
  }

  function itemImageSvg(item, categories = []) {
    const cat = categories.find((c) => c.id === item.category) || { name: item.category, id: item.category };
    const tierColor = TIER_COLOR[item.tier] || TIER_COLOR[1];
    const initials = initialsFor(item.name);
    const glyph = GLYPHS[item.category] || GLYPHS["resources"];
    // Per-card unique id for gradient defs
    const u = "g" + Math.random().toString(36).slice(2, 9);
    const catLabel = cat.name.toUpperCase();

    // Tier dots (●●●)
    const dots = [1, 2, 3].map((n) => {
      const filled = n <= item.tier;
      return `<circle cx="${-14 + (n - 1) * 8}" cy="0" r="3" fill="${filled ? tierColor : "rgba(255,255,255,0.18)"}" />`;
    }).join("");

    return `
<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${escapeHTML(item.name)}">
  <defs>
    <linearGradient id="${u}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#0d0d10"/>
      <stop offset="100%" stop-color="#16151a"/>
    </linearGradient>
    <radialGradient id="${u}-glow" cx="85%" cy="20%" r="65%">
      <stop offset="0%"  stop-color="${tierColor}" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="${tierColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${tierColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${u}-red" cx="20%" cy="100%" r="80%">
      <stop offset="0%"  stop-color="#d62828" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#d62828" stop-opacity="0"/>
    </radialGradient>
    <pattern id="${u}-grid" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M0 0 L16 0 M0 0 L0 16" stroke="white" stroke-opacity="0.04" stroke-width="0.5"/>
    </pattern>
  </defs>

  <rect width="320" height="180" fill="url(#${u}-bg)"/>
  <rect width="320" height="180" fill="url(#${u}-grid)"/>
  <rect width="320" height="180" fill="url(#${u}-glow)"/>
  <rect width="320" height="180" fill="url(#${u}-red)"/>

  <!-- Big stylized category glyph behind everything -->
  <g transform="translate(228, 40) scale(5.2)" stroke="${tierColor}" stroke-width="0.75" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.18">
    ${glyph}
  </g>

  <!-- Initials -->
  <text x="22" y="142" font-family="Space Grotesk, Inter, sans-serif" font-size="120" font-weight="700"
        fill="#ffffff" letter-spacing="-2">
    ${initials}
  </text>

  <!-- Category label, top-left -->
  <text x="22" y="32" font-family="JetBrains Mono, ui-monospace, monospace" font-size="10"
        fill="rgba(255,255,255,0.55)" letter-spacing="2.4">
    ${escapeHTML(catLabel)}
  </text>

  <!-- Tier dots, top-right -->
  <g transform="translate(298, 28)">
    ${dots}
  </g>

  <!-- Bottom accent bar -->
  <rect x="0" y="174" width="320" height="6" fill="${tierColor}" opacity="0.85"/>
</svg>`;
  }

  /** Game icon when synced; otherwise procedural SVG thumbnail. */
  function itemImage(item, categories = []) {
    if (hasItemImage(item.id)) {
      const svg = itemImageSvg(item, categories);
      const portraitClass = item.entityId ? " item-photo--portrait" : "";
      return `
        <img class="item-photo${portraitClass}" src="${itemImageUrl(item.id)}"
             alt="${escapeHTML(item.name)}" loading="lazy" decoding="async"
             onerror="SDD.handleItemPhotoError(this)" />
        <div class="item-img-fallback" hidden>${svg}</div>`;
    }
    return itemImageSvg(item, categories);
  }

  /** Compact PNG icon for loadout grids — always uses images/items/{id}.png when synced. */
  function itemIcon(item, categories = []) {
    if (!item?.id) return itemImageSvg(item || { name: "?", category: "resources", tier: 1 }, categories);
    if (hasItemImage(item.id)) {
      const svg = itemImageSvg(item, categories);
      return `
        <span class="item-icon item-icon--compact">
          <img class="item-photo item-photo--compact" src="${itemImageUrl(item.id)}"
               alt="${escapeHTML(item.name)}" loading="lazy" decoding="async"
               onerror="SDD.handleItemPhotoError(this)" />
          <div class="item-img-fallback" hidden>${svg}</div>
        </span>`;
    }
    return itemImageSvg(item, categories);
  }

  function attachItemPhotoHandlers(root = document) {
    root.querySelectorAll(".item-photo").forEach((img) => {
      img.onerror = () => handleItemPhotoError(img);
    });
  }

  function handleItemPhotoError(img) {
    img.classList.add("failed");
    img.removeAttribute("src");
    const fallback = img.nextElementSibling;
    if (fallback && fallback.classList.contains("item-img-fallback")) {
      fallback.hidden = false;
    }
  }

  async function loadImageManifest() {
    try {
      const q = imageManifestVersion ? `?v=${encodeURIComponent(imageManifestVersion)}` : "";
      const res = await fetch(`images/manifest.json${q}`, { cache: "no-store" });
      if (res.ok) imageManifest = normalizeManifest(await res.json());
    } catch (_) {
      imageManifest = {};
    }
    attachItemPhotoHandlers();
    return imageManifest;
  }

  function injectFooterSources() {
    const html = [
      "Item icons from ",
      '<a href="https://github.com/tassoneroberto/7dtd-assets" rel="noopener noreferrer" target="_blank">7dtd-assets</a>',
      ". Zombie portraits from the ",
      '<a href="https://7daystodie.wiki.gg/wiki/7_Days_to_Die_Wiki" rel="noopener noreferrer" target="_blank">7 Days to Die Wiki</a>',
      " and ",
      '<a href="https://7daystodie.fandom.com/wiki/7_Days_to_Die_Wiki" rel="noopener noreferrer" target="_blank">Fandom community wiki</a>',
      ".",
    ].join("");

    document.querySelectorAll("footer.footer .footer-inner").forEach((inner) => {
      if (inner.querySelector(".footer-sources")) return;
      const note = document.createElement("p");
      note.className = "footer-sources";
      note.innerHTML = html;
      inner.appendChild(note);
      inner.classList.add("footer-inner--stacked");
    });
  }

  // -------------------------------------------------------------------------
  // Skill point budget (vanilla level cap)
  // -------------------------------------------------------------------------
  const SkillPoints = {
    attributeCostForLevel(targetLevel, costs) {
      let total = 0;
      for (let i = 0; i < targetLevel && i < costs.length; i++) total += costs[i];
      return total;
    },
    calcSpent(attributes, perks, meta) {
      let attrSpent = 0;
      Object.values(attributes || {}).forEach((lvl) => {
        attrSpent += SkillPoints.attributeCostForLevel(lvl, meta.attributeCosts);
      });
      let perkSpent = 0;
      Object.values(perks || {}).forEach((lvl) => { perkSpent += Number(lvl) || 0; });
      return { attrSpent, perkSpent, total: attrSpent + perkSpent };
    },
    budget(meta, playerLevel) {
      const maxLevel = meta.maxPlayerLevel ?? 300;
      const level = Math.min(maxLevel, Math.max(1, Number(playerLevel) || 1));
      if (level >= maxLevel && meta.maxSkillPointBudget != null) {
        return meta.maxSkillPointBudget;
      }
      const starting = meta.startingSkillPoints ?? 0;
      const perLevel = meta.skillPointsPerLevel ?? 1;
      const challenge = level >= maxLevel ? (meta.challengeSkillPoints ?? 0) : 0;
      return starting + (level - 1) * perLevel + challenge;
    },
    normalizePlayerLevel(meta, build) {
      if (build && build.unlimited) return meta.maxPlayerLevel ?? 300;
      const maxLevel = meta.maxPlayerLevel ?? 300;
      return Math.min(maxLevel, Math.max(1, Number(build?.playerLevel) || 1));
    },
  };

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  window.SDD = {
    Auth, Store, BuildStore, SkillPoints, api, openAuthModal, toast, escapeHTML,
    itemImage, itemIcon, itemImageUrl, itemImageSvg, hasItemImage, handleItemPhotoError,
    attachItemPhotoHandlers, loadImageManifest, imageManifest,
  };

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------
  Auth.onChange(renderNav);
  document.addEventListener("DOMContentLoaded", async () => {
    setupMobileNav();
    setupReveal();
    setupBackendBanner();
    renderNav();
    injectFooterSources();
    await loadImageManifest();
    await Auth.refresh();

    // Profile page guard
    if (location.pathname.endsWith("profile.html") && !Auth.user) {
      openAuthModal("signin");
      const main = document.querySelector("main");
      if (main) main.style.opacity = "0.4";
      const unsub = Auth.onChange((u) => {
        if (u) {
          if (main) main.style.opacity = "";
          unsub();
        }
      });
    }
  });
})();
