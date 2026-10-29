"use strict";

const { getConfig, missing } = require("../_lib/config");
const { send, redirect } = require("../_lib/http");
const {
  STATE_COOKIE,
  parseCookies,
  safeEqual,
  clearCookie,
  createSessionCookie,
} = require("../_lib/session");

async function exchangeCode(config, code) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${config.siteUrl}/api/auth/callback`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return typeof json.access_token === "string" ? json.access_token : null;
}

async function fetchLogin(accessToken) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "web-resume-editor",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return typeof json.login === "string" ? json.login : null;
}

/**
 * Finishes the GitHub sign-in. The GitHub access token is used once to read the account
 * name and is then discarded. A session cookie is issued only for the allowed account.
 */
module.exports = async function callback(req, res) {
  if (req.method !== "GET") return send(res, 405, "Method not allowed");
  const config = getConfig();
  if (missing(config, ["clientId", "clientSecret", "sessionSecret", "allowedUser", "siteUrl"]).length) {
    return send(res, 503, "Sign-in is not configured.");
  }
  const clearState = { "Set-Cookie": clearCookie(STATE_COOKIE) };
  const url = new URL(req.url, config.siteUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = parseCookies(req.headers.cookie)[STATE_COOKIE];
  if (!code || !state || !expected || !safeEqual(state, expected)) {
    const why = !code || !state ? "missing-code-or-state" : !expected ? "state-cookie-missing" : "state-mismatch";
    console.error("auth callback rejected:", why);
    return redirect(res, `/?auth=failed&reason=${why}`, clearState);
  }
  try {
    const accessToken = await exchangeCode(config, code);
    const login = accessToken ? await fetchLogin(accessToken) : null;
    if (!login || login.toLowerCase() !== config.allowedUser) {
      console.error("auth denied: token exchange or user lookup failed, or wrong account", { gotToken: !!accessToken, login });
      return redirect(res, `/?auth=denied&reason=${accessToken ? "wrong-account" : "token-exchange-failed"}`, clearState);
    }
    return redirect(res, "/#edit", {
      "Set-Cookie": [clearCookie(STATE_COOKIE), createSessionCookie(login, config.sessionSecret)],
    });
  } catch (err) {
    console.error("auth callback error:", err && err.message);
    return redirect(res, "/?auth=failed&reason=server-error", clearState);
  }
};
