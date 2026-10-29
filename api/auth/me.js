"use strict";

const { getConfig } = require("../_lib/config");
const { send } = require("../_lib/http");
const { getSession } = require("../_lib/session");

/** Tells the page whether the visitor is the signed-in owner. */
module.exports = function me(req, res) {
  if (req.method !== "GET") return send(res, 405, "Method not allowed");
  const config = getConfig();
  const session = config.sessionSecret ? getSession(req, config.sessionSecret) : null;
  const ok = session && session.user.toLowerCase() === config.allowedUser;
  return send(res, 200, ok ? { authenticated: true, user: session.user } : { authenticated: false });
};
