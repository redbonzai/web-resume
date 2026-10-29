"use strict";

const crypto = require("node:crypto");

const SESSION_COOKIE = "resume_session";
const STATE_COOKIE = "resume_oauth_state";
const SESSION_SECONDS = 8 * 60 * 60;

function hmac(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Returns the payload when the token is authentic and unexpired, otherwise null. */
function verify(token, secret, now = Date.now()) {
  if (!token || !secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  if (!safeEqual(mac, hmac(body, secret))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;
  return payload;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieHeader(name, value, maxAgeSeconds) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

function createSessionCookie(user, secret, now = Date.now()) {
  const token = sign({ u: user, exp: now + SESSION_SECONDS * 1000 }, secret);
  return cookieHeader(SESSION_COOKIE, token, SESSION_SECONDS);
}

function clearCookie(name) {
  return cookieHeader(name, "", 0);
}

/** Returns { user } for a valid session cookie, otherwise null. */
function getSession(req, secret, now = Date.now()) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const payload = verify(token, secret, now);
  return payload && typeof payload.u === "string" ? { user: payload.u } : null;
}

module.exports = {
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_SECONDS,
  sign,
  verify,
  safeEqual,
  parseCookies,
  cookieHeader,
  createSessionCookie,
  clearCookie,
  getSession,
};
