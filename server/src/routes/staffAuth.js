const crypto = require("node:crypto");
const { promisify } = require("node:util");
const express = require("express");
const pool = require("../config/db");

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const sessions = new Map();
const loginFailures = new Map();
const sessionLifetime = 8 * 60 * 60 * 1000;
const loginWindow = 15 * 60 * 1000;
const maxLoginFailures = 10;

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function bodyObject(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    const error = new Error("Request body must be a JSON object.");
    error.status = 400;
    throw error;
  }
  return req.body;
}

function bearerToken(req) {
  const authorization = req.get("authorization") || "";
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  return match?.[1] || null;
}

function sessionFor(token) {
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = sessions.get(tokenHash);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(tokenHash);
    return null;
  }
  return { tokenHash, session };
}

function requireStaff(req, res, next) {
  const found = sessionFor(bearerToken(req));
  if (!found) return res.status(401).json({ error: "Staff login required." });
  req.staffSession = found;
  next();
}

router.post("/login", asyncHandler(async (req, res) => {
  const body = bodyObject(req);
  if (typeof body.username !== "string" || typeof body.password !== "string" ||
      body.username.length > 254 || body.password.length > 256) {
    return res.status(400).json({ error: "Enter a valid username and password." });
  }

  const ip = req.ip;
  const previousFailures = loginFailures.get(ip);
  if (previousFailures && Date.now() - previousFailures.startedAt < loginWindow &&
      previousFailures.count >= maxLoginFailures) {
    return res.status(429).json({ error: "Too many sign-in attempts. Try again in 15 minutes." });
  }
  if (previousFailures && Date.now() - previousFailures.startedAt >= loginWindow) {
    loginFailures.delete(ip);
  }

  const username = body.username.trim().toLowerCase();
  const [users] = await pool.execute(
    "SELECT id, username, password_hash FROM staff_users WHERE username = ?",
    [username],
  );
  const [algorithm, salt, expectedHex] = (users[0]?.password_hash || "").split("$");
  let valid = false;
  if (algorithm === "scrypt" && salt && /^[0-9a-f]{128}$/.test(expectedHex || "")) {
    const actual = await scrypt(body.password, salt, 64);
    valid = crypto.timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
  } else {
    await scrypt(body.password, "refound-invalid-login-salt", 64);
  }
  if (!valid) {
    const current = loginFailures.get(ip);
    loginFailures.set(ip, {
      startedAt: current && Date.now() - current.startedAt < loginWindow ? current.startedAt : Date.now(),
      count: current && Date.now() - current.startedAt < loginWindow ? current.count + 1 : 1,
    });
    return res.status(401).json({ error: "Username or password is incorrect." });
  }

  loginFailures.delete(ip);
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  sessions.set(tokenHash, { userId: users[0].id, username, expiresAt: Date.now() + sessionLifetime });
  res.json({ token, username, expiresAt: Date.now() + sessionLifetime });
}));

router.get("/session", requireStaff, (req, res) => {
  res.json({ username: req.staffSession.session.username });
});

router.post("/logout", requireStaff, (req, res) => {
  sessions.delete(req.staffSession.tokenHash);
  res.status(204).end();
});

module.exports = { router, requireStaff };
