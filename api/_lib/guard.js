"use strict";

const { getConfig, missing } = require("./config");
const { send } = require("./http");
const { getSession } = require("./session");

/**
 * Returns the config when the request comes from the signed-in owner, otherwise sends the
 * error response itself and returns null.
 */
function requireOwner(req, res) {
  const config = getConfig();
  if (missing(config, ["sessionSecret", "allowedUser", "githubToken"]).length) {
    send(res, 503, { error: "not_configured" });
    return null;
  }
  const session = getSession(req, config.sessionSecret);
  if (!session || session.user.toLowerCase() !== config.allowedUser) {
    send(res, 401, { error: "unauthorized" });
    return null;
  }
  return config;
}

module.exports = { requireOwner };
