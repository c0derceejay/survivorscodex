/* ==========================================================================
   Survivor's Codex — auth + static server
   - Express serves the static front-end from this directory.
   - Real accounts: bcrypt-hashed passwords stored in a JSON file at
     data/auth.json (no native deps, works on any Node 18+).
   - Sessions: opaque token in an httpOnly cookie, server-side row.
   - Skill builds: persisted per account in data/auth.json when signed in.
   - Favorites & uploaded photos remain client-side (localStorage) by design.
   ========================================================================== */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

const PORT = process.env.PORT || 3000;
const COOKIE_NAME = "sdd_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour
const MAX_BUILDS_PER_USER = 24;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "data", "auth.json");

const BUILD_TYPES_CONFIG = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "build-types.json"), "utf8")
);
const DEFAULT_BUILD_TYPE = BUILD_TYPES_CONFIG.default || "general";
const BUILD_TYPE_IDS = new Set((BUILD_TYPES_CONFIG.types || []).map((t) => t.id));

// ---------------------------------------------------------------------------
// JSON file store
// ---------------------------------------------------------------------------
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (_) {
    return { users: [], sessions: [], builds: [], password_resets: [] };
  }
}
function saveDb(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // Atomic write
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}
function migrateBuildRecords(db) {
  let changed = false;
  for (const b of db.builds || []) {
    if (!Array.isArray(b.build_types) || !b.build_types.length) {
      b.build_types = b.build_type ? [b.build_type] : [DEFAULT_BUILD_TYPE];
      delete b.build_type;
      changed = true;
    } else if (b.build_type) {
      delete b.build_type;
      changed = true;
    }
    if (b.is_public === undefined) {
      b.is_public = false;
      changed = true;
    }
  }
  return changed;
}

let db = loadDb();
if (migrateBuildRecords(db)) saveDb(db);

const Store = {
  findUserByEmail(email) {
    const target = email.toLowerCase();
    return db.users.find((u) => u.email.toLowerCase() === target);
  },
  findUserByUsername(username) {
    const target = username.toLowerCase();
    return db.users.find((u) => u.username.toLowerCase() === target);
  },
  findUserById(id) {
    return db.users.find((u) => u.id === id);
  },
  insertUser(user) {
    db.users.push(user);
    saveDb(db);
  },
  insertSession(session) {
    db.sessions.push(session);
    saveDb(db);
  },
  findSessionByToken(token) {
    return db.sessions.find((s) => s.token === token);
  },
  deleteSession(token) {
    db.sessions = db.sessions.filter((s) => s.token !== token);
    saveDb(db);
  },
  cleanupExpired() {
    const beforeSessions = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.expires_at >= Date.now());
    if (!db.password_resets) db.password_resets = [];
    const beforeResets = db.password_resets.length;
    db.password_resets = db.password_resets.filter((r) => r.expires_at >= Date.now());
    if (db.sessions.length !== beforeSessions || db.password_resets.length !== beforeResets) saveDb(db);
  },
  updateUserPassword(userId, pwHash) {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return false;
    user.pw_hash = pwHash;
    saveDb(db);
    return true;
  },
  insertPasswordReset(userId, plainToken) {
    if (!db.password_resets) db.password_resets = [];
    const tokenHash = hashResetToken(plainToken);
    db.password_resets = db.password_resets.filter((r) => r.user_id !== userId);
    db.password_resets.push({
      token_hash: tokenHash,
      user_id: userId,
      expires_at: Date.now() + RESET_TTL_MS,
      created_at: Date.now(),
    });
    saveDb(db);
  },
  findPasswordReset(plainToken) {
    if (!db.password_resets) return null;
    const tokenHash = hashResetToken(plainToken);
    const row = db.password_resets.find((r) => r.token_hash === tokenHash);
    if (!row || row.expires_at < Date.now()) return null;
    return row;
  },
  consumePasswordReset(plainToken) {
    if (!db.password_resets) return null;
    const tokenHash = hashResetToken(plainToken);
    const row = db.password_resets.find((r) => r.token_hash === tokenHash);
    if (!row) return null;
    db.password_resets = db.password_resets.filter((r) => r.token_hash !== tokenHash);
    saveDb(db);
    return row;
  },
  deleteSessionsForUser(userId) {
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.user_id !== userId);
    if (db.sessions.length !== before) saveDb(db);
  },
  listBuilds(userId) {
    if (!db.builds) db.builds = [];
    return db.builds
      .filter((b) => b.user_id === userId)
      .sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
  },
  findBuild(id) {
    if (!db.builds) db.builds = [];
    return db.builds.find((b) => b.id === id);
  },
  insertBuild(build) {
    if (!db.builds) db.builds = [];
    db.builds.push(build);
    saveDb(db);
  },
  updateBuild(id, patch) {
    if (!db.builds) db.builds = [];
    const i = db.builds.findIndex((b) => b.id === id);
    if (i < 0) return null;
    db.builds[i] = { ...db.builds[i], ...patch };
    if (Array.isArray(patch.build_types)) delete db.builds[i].build_type;
    saveDb(db);
    return db.builds[i];
  },
  deleteBuild(id) {
    if (!db.builds) db.builds = [];
    const before = db.builds.length;
    db.builds = db.builds.filter((b) => b.id !== id);
    if (db.builds.length !== before) saveDb(db);
    return before !== db.builds.length;
  },
  listPublicBuilds(filters = {}) {
    if (!db.builds) db.builds = [];
    let result = db.builds.filter((b) => b.is_public === true);

    if (filters.type && filters.type !== "all") {
      result = result.filter((b) => {
        const types = Array.isArray(b.build_types) && b.build_types.length
          ? b.build_types
          : [DEFAULT_BUILD_TYPE];
        return types.includes(filters.type);
      });
    }
    if (filters.weapon) {
      result = result.filter((b) =>
        Array.isArray(b.loadout?.weapons) && b.loadout.weapons.includes(filters.weapon)
      );
    }
    if (filters.tool) {
      result = result.filter((b) =>
        Array.isArray(b.loadout?.tools) && b.loadout.tools.includes(filters.tool)
      );
    }
    if (filters.perk) {
      result = result.filter((b) => (Number(b.perks?.[filters.perk]) || 0) > 0);
    }
    if (filters.attribute) {
      result = result.filter((b) => (Number(b.attributes?.[filters.attribute]) || 0) > 0);
    }
    if (filters.author) {
      const user = Store.findUserByUsername(filters.author);
      result = user ? result.filter((b) => b.user_id === user.id) : [];
    }
    if (filters.q) {
      const q = String(filters.q).trim().toLowerCase();
      if (q) {
        result = result.filter((b) => {
          const user = Store.findUserById(b.user_id);
          const nameMatch = String(b.name || "").toLowerCase().includes(q);
          const authorMatch = user && user.username.toLowerCase().includes(q);
          return nameMatch || authorMatch;
        });
      }
    }

    return result.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
  },
};

// Periodically purge expired sessions
setInterval(() => Store.cleanupExpired(), 1000 * 60 * 60).unref?.();

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email, createdAt: u.created_at };
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function appBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function authMiddleware(req, _res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return next();
  const sess = Store.findSessionByToken(token);
  if (!sess) return next();
  if (sess.expires_at < Date.now()) {
    Store.deleteSession(token);
    return next();
  }
  const user = Store.findUserById(sess.user_id);
  if (user) req.user = user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in to continue." });
  next();
}

function clientLoadout(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.armorSet != null || raw.armorQuality != null || raw.mods || raw.weapons || raw.food || raw.water || raw.medical || raw.tools || raw.vehicles || raw.itemQualities) return raw;
  return {
    armorSet: raw.armor_set || null,
    armorQuality: raw.armor_quality,
    mods: raw.mods,
    weapons: raw.weapons || [],
    food: raw.food || [],
    water: raw.water || [],
    medical: raw.medical || [],
    tools: raw.tools || [],
    vehicles: raw.vehicles || [],
    itemQualities: raw.item_qualities || raw.itemQualities || {},
  };
}

function normalizeGearIds(raw, max = 24) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const id of raw) {
    const s = String(id || "").trim().slice(0, 80);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeItemQualities(raw, max = 48) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [itemId, q] of Object.entries(raw)) {
    const id = String(itemId || "").trim().slice(0, 80);
    if (!id) continue;
    out[id] = Math.min(6, Math.max(1, Number(q) || 6));
    if (Object.keys(out).length >= max) break;
  }
  return out;
}

function normalizeLoadoutInput(body) {
  const raw = body.loadout;
  if (!raw || typeof raw !== "object") {
    return {
      armor_set: null, armor_quality: 6, mods: {}, weapons: [], food: [], water: [], medical: [], tools: [], vehicles: [], item_qualities: {},
    };
  }
  const armor_set = raw.armorSet ? String(raw.armorSet).trim().slice(0, 40) : null;
  const armor_quality = Math.min(6, Math.max(1, Number(raw.armorQuality) || 6));
  const mods = {};
  if (raw.mods && typeof raw.mods === "object") {
    for (const [itemId, slots] of Object.entries(raw.mods)) {
      if (!slots || typeof slots !== "object") continue;
      const clean = {};
      for (const [slot, modId] of Object.entries(slots)) {
        if (modId) clean[String(slot).slice(0, 24)] = String(modId).slice(0, 80);
      }
      if (Object.keys(clean).length) mods[String(itemId).slice(0, 80)] = clean;
    }
  }
  return {
    armor_set,
    armor_quality,
    mods,
    weapons: normalizeGearIds(raw.weapons),
    food: normalizeGearIds(raw.food),
    water: normalizeGearIds(raw.water),
    medical: normalizeGearIds(raw.medical),
    tools: normalizeGearIds(raw.tools),
    vehicles: normalizeGearIds(raw.vehicles),
    item_qualities: normalizeItemQualities(raw.itemQualities),
  };
}

function publicLoadout(b) {
  if (!b.loadout) {
    return {
      armorSet: null, armorQuality: 6, mods: {}, weapons: [], food: [], water: [], medical: [], tools: [], vehicles: [], itemQualities: {},
    };
  }
  return {
    armorSet: b.loadout.armor_set || null,
    armorQuality: Math.min(6, Math.max(1, Number(b.loadout.armor_quality) || 6)),
    mods: b.loadout.mods && typeof b.loadout.mods === "object" ? b.loadout.mods : {},
    weapons: Array.isArray(b.loadout.weapons) ? b.loadout.weapons : [],
    food: Array.isArray(b.loadout.food) ? b.loadout.food : [],
    water: Array.isArray(b.loadout.water) ? b.loadout.water : [],
    medical: Array.isArray(b.loadout.medical) ? b.loadout.medical : [],
    tools: Array.isArray(b.loadout.tools) ? b.loadout.tools : [],
    vehicles: Array.isArray(b.loadout.vehicles) ? b.loadout.vehicles : [],
    itemQualities: b.loadout.item_qualities && typeof b.loadout.item_qualities === "object"
      ? b.loadout.item_qualities
      : {},
  };
}

function publicAuthor(u) {
  return u ? { id: u.id, username: u.username } : null;
}

function publicBuild(b) {
  let buildTypes = b.build_types;
  if (!Array.isArray(buildTypes) || !buildTypes.length) {
    buildTypes = b.build_type ? [b.build_type] : [DEFAULT_BUILD_TYPE];
  }
  return {
    id: b.id,
    name: b.name,
    buildTypes,
    buildType: buildTypes[0],
    loadout: publicLoadout(b),
    savedAt: b.saved_at,
    playerLevel: b.player_level,
    unlimited: b.unlimited,
    attributes: b.attributes,
    perks: b.perks,
    isPublic: Boolean(b.is_public),
  };
}

function publicBuildWithAuthor(b) {
  return {
    ...publicBuild(b),
    author: publicAuthor(Store.findUserById(b.user_id)),
  };
}

function normalizeBuildTypesInput(body) {
  let raw = body.buildTypes ?? body.build_types;
  if (raw == null && (body.buildType || body.build_type)) {
    raw = [body.buildType || body.build_type];
  }
  if (!Array.isArray(raw)) raw = raw != null ? [raw] : [];
  const out = [];
  for (const entry of raw) {
    const id = String(entry || "").trim();
    if (id && BUILD_TYPE_IDS.has(id) && !out.includes(id)) out.push(id);
  }
  return out.length ? out : [DEFAULT_BUILD_TYPE];
}

function normalizeBuildBody(body, existing = null) {
  const name = String(body.name || "Untitled build").trim().slice(0, 80) || "Untitled build";
  const playerLevel = Math.min(300, Math.max(1, Number(body.playerLevel) || 1));
  const unlimited = Boolean(body.unlimited);
  const attributes = body.attributes && typeof body.attributes === "object" ? body.attributes : {};
  const perks = body.perks && typeof body.perks === "object" ? body.perks : {};
  const build_types = normalizeBuildTypesInput(body);
  const loadout = normalizeLoadoutInput(body);
  const is_public = body.isPublic !== undefined
    ? Boolean(body.isPublic)
    : Boolean(existing?.is_public);
  return { name, build_types, loadout, player_level: playerLevel, unlimited, attributes, perks, is_public };
}
app.use(authMiddleware);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { username = "", email = "", password = "" } = req.body || {};
    const u = String(username).trim();
    const e = String(email).trim().toLowerCase();
    if (u.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: "Enter a valid email address." });
    if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    if (Store.findUserByEmail(e)) return res.status(409).json({ error: "An account with that email already exists." });
    if (Store.findUserByUsername(u)) return res.status(409).json({ error: "That username is taken." });

    const hash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    const user = { id, username: u, email: e, pw_hash: hash, created_at: Date.now() };
    Store.insertUser(user);

    const token = newToken();
    Store.insertSession({ token, user_id: id, expires_at: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, token);

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error("[signup]", err);
    res.status(500).json({ error: "Server error during signup." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};
    const e = String(email).trim().toLowerCase();
    const user = Store.findUserByEmail(e);
    if (!user) return res.status(401).json({ error: "Invalid email or password." });
    const ok = await bcrypt.compare(password, user.pw_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    const token = newToken();
    Store.insertSession({ token, user_id: user.id, expires_at: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Server error during login." });
  }
});

app.post("/api/logout", (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token) Store.deleteSession(token);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.post("/api/forgot-password", (req, res) => {
  try {
    const e = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const user = Store.findUserByEmail(e);
    const response = {
      ok: true,
      message: "If an account exists for that email, use the reset link below within the next hour.",
    };

    if (!user) return res.json(response);

    const token = newToken();
    Store.insertPasswordReset(user.id, token);
    const resetUrl = `${appBaseUrl(req)}/reset-password.html?token=${encodeURIComponent(token)}`;
    console.log(`[password-reset] Link for ${user.email}: ${resetUrl}`);

    res.json({
      ...response,
      resetUrl,
      expiresInMinutes: RESET_TTL_MS / (1000 * 60),
    });
  } catch (err) {
    console.error("[forgot-password]", err);
    res.status(500).json({ error: "Could not start password reset." });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (!token) return res.status(400).json({ error: "Reset link is invalid or missing." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    const row = Store.findPasswordReset(token);
    if (!row) return res.status(400).json({ error: "This reset link is invalid or has expired." });

    const hash = await bcrypt.hash(password, 10);
    if (!Store.updateUserPassword(row.user_id, hash)) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    Store.consumePasswordReset(token);
    Store.deleteSessionsForUser(row.user_id);

    res.json({ ok: true, message: "Password updated. You can sign in with your new password." });
  } catch (err) {
    console.error("[reset-password]", err);
    res.status(500).json({ error: "Could not reset password." });
  }
});

app.get("/api/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: publicUser(req.user) });
});

app.get("/api/builds/public", (req, res) => {
  const builds = Store.listPublicBuilds({
    type: req.query.type,
    weapon: req.query.weapon,
    tool: req.query.tool,
    perk: req.query.perk,
    attribute: req.query.attribute,
    author: req.query.author,
    q: req.query.q,
  }).map(publicBuildWithAuthor);
  res.json({ builds });
});

app.get("/api/builds/public/:id", (req, res) => {
  const build = Store.findBuild(req.params.id);
  if (!build || !build.is_public) {
    return res.status(404).json({ error: "Build not found." });
  }
  res.json({ build: publicBuildWithAuthor(build) });
});

app.get("/api/builds", requireAuth, (req, res) => {
  const builds = Store.listBuilds(req.user.id).map(publicBuild);
  res.json({ builds });
});

app.post("/api/builds", requireAuth, (req, res) => {
  try {
    const existing = Store.listBuilds(req.user.id);
    if (existing.length >= MAX_BUILDS_PER_USER) {
      return res.status(400).json({ error: `You can save up to ${MAX_BUILDS_PER_USER} builds.` });
    }
    const fields = normalizeBuildBody(req.body || {});
    const build = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      saved_at: new Date().toISOString(),
      ...fields,
    };
    Store.insertBuild(build);
    res.status(201).json({ build: publicBuild(build) });
  } catch (err) {
    console.error("[builds create]", err);
    res.status(500).json({ error: "Could not save build." });
  }
});

app.put("/api/builds/:id", requireAuth, (req, res) => {
  const build = Store.findBuild(req.params.id);
  if (!build || build.user_id !== req.user.id) {
    return res.status(404).json({ error: "Build not found." });
  }
  const body = req.body || {};
  const storedLoadout = clientLoadout(build.loadout);
  const fields = normalizeBuildBody({
    name: body.name ?? build.name,
    playerLevel: body.playerLevel ?? build.player_level,
    unlimited: body.unlimited ?? build.unlimited,
    attributes: body.attributes ?? build.attributes,
    perks: body.perks ?? build.perks,
    loadout: body.loadout ?? storedLoadout,
    buildTypes: body.buildTypes ?? body.build_types ?? build.build_types ?? build.build_type,
    isPublic: body.isPublic ?? build.is_public,
  }, build);
  const updated = Store.updateBuild(build.id, {
    ...fields,
    saved_at: new Date().toISOString(),
  });
  res.json({ build: publicBuild(updated) });
});

app.delete("/api/builds/:id", requireAuth, (req, res) => {
  const build = Store.findBuild(req.params.id);
  if (!build || build.user_id !== req.user.id) {
    return res.status(404).json({ error: "Build not found." });
  }
  Store.deleteBuild(build.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Static front-end
// ---------------------------------------------------------------------------
app.get("/", (_req, res) => res.redirect("/splash.html"));

app.use(express.static(ROOT, {
  extensions: ["html"],
  index: false,
}));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n  Survivor's Codex listening on  http://localhost:${PORT}\n`);
});
