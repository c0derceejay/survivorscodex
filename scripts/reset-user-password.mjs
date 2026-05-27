#!/usr/bin/env node
/* Reset a user's password in var/auth.json (admin / recovery when email is not configured). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "var", "auth.json");

const email = String(process.argv[2] || "").trim().toLowerCase();
const password = String(process.argv[3] || "");

if (!email || !password) {
  console.error("Usage: node scripts/reset-user-password.mjs <email> <new-password>");
  console.error("Example: node scripts/reset-user-password.mjs survivor@example.com newpass123");
  process.exit(1);
}

if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`Auth database not found at ${DB_PATH}`);
  console.error("Create an account first, or check your Railway volume mount at /app/var.");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
const user = (db.users || []).find((u) => String(u.email).toLowerCase() === email);

if (!user) {
  console.error(`No user found for email: ${email}`);
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
user.pw_hash = hash;

if (Array.isArray(db.sessions)) {
  db.sessions = db.sessions.filter((s) => s.user_id !== user.id);
}
if (Array.isArray(db.password_resets)) {
  db.password_resets = db.password_resets.filter((r) => r.user_id !== user.id);
}

const tmp = `${DB_PATH}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
fs.renameSync(tmp, DB_PATH);

console.log(`Password updated for ${user.username} (${user.email}).`);
console.log("Existing sessions and reset tokens for this user were cleared.");
