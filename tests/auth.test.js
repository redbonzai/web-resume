"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { setEnv, makeReq, makeRes, sessionHeader } = require("./helpers");
const login = require("../api/auth/login");
const callback = require("../api/auth/callback");
const me = require("../api/auth/me");
const logout = require("../api/auth/logout");

setEnv();
const realFetch = global.fetch;
test.afterEach(() => {
  global.fetch = realFetch;
  setEnv();
});

function stateFrom(res) {
  const cookie = [].concat(res.headers["set-cookie"]).find((c) => c.startsWith("resume_oauth_state="));
  return cookie.split(";")[0].split("=")[1];
}

test("login redirects to GitHub with a state cookie and the site's callback", () => {
  const res = makeRes();
  login(makeReq(), res);
  assert.equal(res.statusCode, 302);
  const loc = new URL(res.headers.location);
  assert.equal(loc.origin + loc.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(loc.searchParams.get("client_id"), "client-id");
  assert.equal(loc.searchParams.get("redirect_uri"), "https://example.test/api/auth/callback");
  assert.equal(loc.searchParams.get("state"), stateFrom(res));
  assert.match(res.headers["set-cookie"], /HttpOnly/);
});

test("login reports when sign-in is not configured", () => {
  delete process.env.GITHUB_CLIENT_SECRET;
  const res = makeRes();
  login(makeReq(), res);
  assert.equal(res.statusCode, 503);
});

function mockGithub(userLogin) {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("access_token")) return { ok: true, json: async () => ({ access_token: "gho_x" }) };
    return { ok: true, json: async () => ({ login: userLogin }) };
  };
  return calls;
}

async function runCallback(state, cookieState, userLogin = "redbonzai") {
  mockGithub(userLogin);
  const res = makeRes();
  await callback(
    makeReq({
      url: `/api/auth/callback?code=abc&state=${state}`,
      headers: { cookie: `resume_oauth_state=${cookieState}` },
    }),
    res,
  );
  return res;
}

test("callback issues a session for the allowed GitHub user", async () => {
  const res = await runCallback("s1", "s1");
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, "/#edit");
  assert.ok([].concat(res.headers["set-cookie"]).some((c) => c.startsWith("resume_session=")));
});

test("callback matches the allowed user case-insensitively", async () => {
  const res = await runCallback("s1", "s1", "RedBonzai");
  assert.equal(res.headers.location, "/#edit");
});

test("callback refuses any other GitHub user", async () => {
  const res = await runCallback("s1", "s1", "someone-else");
  assert.equal(res.headers.location, "/?auth=denied&reason=wrong-account");
  assert.ok(![].concat(res.headers["set-cookie"]).some((c) => c.startsWith("resume_session=")));
});

test("callback refuses a state that does not match the cookie", async () => {
  const res = await runCallback("s1", "different");
  assert.equal(res.headers.location, "/?auth=failed&reason=state-mismatch");
});

test("callback refuses when there is no state cookie", async () => {
  mockGithub("redbonzai");
  const res = makeRes();
  await callback(makeReq({ url: "/api/auth/callback?code=abc&state=s1" }), res);
  assert.equal(res.headers.location, "/?auth=failed&reason=state-cookie-missing");
});

test("me reports signed-out, signed-in, and rejects a different account's cookie", () => {
  let res = makeRes();
  me(makeReq(), res);
  assert.deepEqual(res.json(), { authenticated: false });

  res = makeRes();
  me(makeReq({ headers: { cookie: sessionHeader("redbonzai") } }), res);
  assert.deepEqual(res.json(), { authenticated: true, user: "redbonzai" });

  res = makeRes();
  me(makeReq({ headers: { cookie: sessionHeader("someone-else") } }), res);
  assert.deepEqual(res.json(), { authenticated: false });
});

test("logout needs POST and the CSRF header, then clears the cookie", () => {
  let res = makeRes();
  logout(makeReq({ method: "GET" }), res);
  assert.equal(res.statusCode, 405);

  res = makeRes();
  logout(makeReq({ method: "POST" }), res);
  assert.equal(res.statusCode, 403);

  res = makeRes();
  logout(makeReq({ method: "POST", headers: { "x-requested-with": "resume-editor" } }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["set-cookie"], /Max-Age=0/);
});
