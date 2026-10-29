"use strict";

const crypto = require("node:crypto");
const { getConfig, missing } = require("../_lib/config");
const { send, redirect } = require("../_lib/http");
const { STATE_COOKIE, cookieHeader } = require("../_lib/session");

/** Starts the GitHub sign-in. Only the allowed GitHub user gets a session later. */
module.exports = function login(req, res) {
  if (req.method !== "GET") return send(res, 405, "Method not allowed");
  const config = getConfig();
  if (missing(config, ["clientId", "clientSecret", "sessionSecret", "allowedUser", "siteUrl"]).length) {
    return send(res, 503, "Sign-in is not configured.");
  }
  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${config.siteUrl}/api/auth/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");
  return redirect(res, url.toString(), { "Set-Cookie": cookieHeader(STATE_COOKIE, state, 600) });
};
