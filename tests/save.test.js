"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { setEnv, makeReq, makeRes, sessionHeader, goodResume } = require("./helpers");
const save = require("../api/save");
const resume = require("../api/resume");

setEnv();
const realFetch = global.fetch;
test.afterEach(() => {
  global.fetch = realFetch;
  setEnv();
});

const csrf = { "x-requested-with": "resume-editor" };
const owner = () => ({ cookie: sessionHeader("redbonzai"), ...csrf });

/** Fake GitHub contents API holding one file. */
function mockRepo({ sha = "sha-1", putStatus = 200 } = {}) {
  const state = { puts: [] };
  global.fetch = async (url, init = {}) => {
    if (init.method === "PUT") {
      state.puts.push({ url: String(url), body: JSON.parse(init.body) });
      if (putStatus !== 200) return { ok: false, status: putStatus, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ content: { sha: "sha-2" }, commit: { sha: "c-1" } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ sha, content: Buffer.from('{"name":"old"}').toString("base64") }),
    };
  };
  return state;
}

const post = (body, headers = owner()) => makeReq({ method: "POST", headers, body });

test("GET /api/resume rejects visitors and returns the file to the owner", async () => {
  mockRepo();
  let res = makeRes();
  await resume(makeReq(), res);
  assert.equal(res.statusCode, 401);

  res = makeRes();
  await resume(makeReq({ headers: { cookie: sessionHeader("redbonzai") } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { content: '{"name":"old"}', sha: "sha-1" });
});

test("save rejects visitors, other accounts, and requests without the CSRF header", async () => {
  const state = mockRepo();
  const body = { content: JSON.stringify(goodResume()), baseSha: "sha-1" };

  let res = makeRes();
  await save(post(body, csrf), res);
  assert.equal(res.statusCode, 401);

  res = makeRes();
  await save(post(body, { cookie: sessionHeader("someone-else"), ...csrf }), res);
  assert.equal(res.statusCode, 401);

  res = makeRes();
  await save(post(body, { cookie: sessionHeader("redbonzai") }), res);
  assert.equal(res.statusCode, 403);

  res = makeRes();
  await save(makeReq({ method: "GET", headers: owner() }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(state.puts.length, 0);
});

test("save rejects malformed bodies, invalid JSON and invalid resumes without writing", async () => {
  const state = mockRepo();
  let res = makeRes();
  await save(post({ content: 5 }), res);
  assert.equal(res.statusCode, 400);

  res = makeRes();
  await save(post({ content: "{nope", baseSha: "sha-1" }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "invalid_json");

  res = makeRes();
  await save(post({ content: JSON.stringify({ name: "x" }), baseSha: "sha-1" }), res);
  assert.equal(res.statusCode, 422);
  assert.ok(res.json().problems.length > 0);
  assert.equal(state.puts.length, 0);
});

test("save refuses when the file changed since the editor loaded it", async () => {
  const state = mockRepo({ sha: "sha-NEW" });
  const res = makeRes();
  await save(post({ content: JSON.stringify(goodResume()), baseSha: "sha-1" }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(state.puts.length, 0);
});

test("a valid save commits formatted JSON to the configured repo and branch", async () => {
  const state = mockRepo();
  const res = makeRes();
  await save(post({ content: JSON.stringify(goodResume()), baseSha: "sha-1" }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, sha: "sha-2", commit: "c-1" });
  assert.equal(state.puts.length, 1);
  const put = state.puts[0];
  assert.match(put.url, /repos\/redbonzai\/web-resume\/contents\/resume\.json$/);
  assert.equal(put.body.branch, "main");
  assert.equal(put.body.sha, "sha-1");
  const written = Buffer.from(put.body.content, "base64").toString("utf8");
  assert.deepEqual(JSON.parse(written), goodResume());
  assert.ok(written.endsWith("}\n"));
});

test("a write conflict from GitHub becomes a 409, other failures a 502", async () => {
  mockRepo({ putStatus: 409 });
  let res = makeRes();
  await save(post({ content: JSON.stringify(goodResume()), baseSha: "sha-1" }), res);
  assert.equal(res.statusCode, 409);

  mockRepo({ putStatus: 500 });
  res = makeRes();
  await save(post({ content: JSON.stringify(goodResume()), baseSha: "sha-1" }), res);
  assert.equal(res.statusCode, 502);
});

test("save is unavailable until the server is configured", async () => {
  delete process.env.GITHUB_TOKEN;
  const res = makeRes();
  await save(post({ content: "{}", baseSha: "x" }), res);
  assert.equal(res.statusCode, 503);
});
