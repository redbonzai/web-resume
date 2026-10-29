"use strict";

const { send, hasCsrfHeader } = require("../_lib/http");
const { SESSION_COOKIE, clearCookie } = require("../_lib/session");

module.exports = function logout(req, res) {
  if (req.method !== "POST") return send(res, 405, "Method not allowed");
  if (!hasCsrfHeader(req)) return send(res, 403, "Forbidden");
  return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie(SESSION_COOKIE) });
};
