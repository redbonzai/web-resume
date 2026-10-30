"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { setEnv, makeReq, makeRes, sessionHeader } = require("./helpers");
const photo = require("../api/photo");
const { gitBlobSha } = require("../api/_lib/github");

setEnv();
const realFetch = global.fetch;
test.afterEach(() => {
  global.fetch = realFetch;
  setEnv();
});

const csrf = { "x-requested-with": "resume-editor" };
const owner = () => ({ cookie: sessionHeader("redbonzai"), ...csrf });
const jpeg = (n = 64) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(n)]);
const dataUrl = (buf) => `data:image/jpeg;base64,${buf.toString("base64")}`;
const ok = (body, status = 200) => ({ ok: true, status, json: async () => body });

/** Fake GitHub: contents read + git data API. Records every call. */
function mockGit({ refStatus = 200 } = {}) {
  const calls = [];
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url: u, body });
    if (u.includes("/contents/resume.json")) {
      return ok({ sha: "r-1", content: Buffer.from('{"name":"Old","photo":""}').toString("base64") });
    }
    if (method === "GET" && u.includes("/git/ref/heads/main")) return ok({ object: { sha: "c-parent" } });
    if (method === "GET" && u.includes("/git/commits/c-parent")) return ok({ tree: { sha: "t-base" } });
    if (u.endsWith("/git/blobs")) return ok({ sha: `b-${calls.length}` }, 201);
    if (u.endsWith("/git/trees")) return ok({ sha: "t-new" }, 201);
    if (u.endsWith("/git/commits")) return ok({ sha: "c-new" }, 201);
    if (method === "PATCH") return refStatus === 200 ? ok({}) : { ok: false, status: refStatus, json: async () => ({}) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return calls;
}

const post = (body, headers = owner()) => makeReq({ method: "POST", url: "/api/photo", headers, body });

test("photo rejects visitors and requests without the CSRF header", async () => {
  const calls = mockGit();
  let res = makeRes();
  await photo(post({ image: dataUrl(jpeg()) }, csrf), res);
  assert.equal(res.statusCode, 401);
  res = makeRes();
  await photo(post({ image: dataUrl(jpeg()) }, { cookie: sessionHeader("redbonzai") }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 0);
});

test("photo rejects anything that is not a JPEG data URL, and oversized images", async () => {
  const calls = mockGit();
  for (const image of [
    "https://evil.test/x.jpg",
    "data:image/png;base64,iVBORw0KGgo=",
    `data:image/jpeg;base64,${Buffer.from("not a jpeg").toString("base64")}`,
    dataUrl(jpeg(700 * 1024)),
  ]) {
    const res = makeRes();
    await photo(post({ image }), res);
    assert.equal(res.statusCode, 422, image.slice(0, 30));
  }
  assert.equal(calls.length, 0);
});

test("photo commits photo.jpg and resume.json together and returns the new sha", async () => {
  const calls = mockGit();
  const img = jpeg();
  const res = makeRes();
  await photo(post({ image: dataUrl(img) }), res);
  assert.equal(res.statusCode, 200);
  const out = res.json();
  assert.match(out.photo, /^photo\.jpg\?v=[0-9a-f]{10}$/);

  const blobs = calls.filter((c) => c.url.endsWith("/git/blobs"));
  assert.equal(Buffer.from(blobs[0].body.content, "base64").equals(img), true);
  const json = Buffer.from(blobs[1].body.content, "base64");
  assert.equal(JSON.parse(json).photo, out.photo);
  assert.equal(JSON.parse(json).name, "Old");
  assert.equal(out.sha, gitBlobSha(json));

  const tree = calls.find((c) => c.url.endsWith("/git/trees")).body;
  assert.equal(tree.base_tree, "t-base");
  assert.deepEqual(tree.tree.map((e) => e.path), ["photo.jpg", "resume.json"]);
  const commit = calls.find((c) => c.url.endsWith("/git/commits") && c.method === "POST").body;
  assert.deepEqual(commit.parents, ["c-parent"]);
  const patch = calls.find((c) => c.method === "PATCH");
  assert.deepEqual(patch.body, { sha: "c-new", force: false });
});

test("photo reports a conflict when the branch moved during the commit", async () => {
  mockGit({ refStatus: 422 });
  const res = makeRes();
  await photo(post({ image: dataUrl(jpeg()) }), res);
  assert.equal(res.statusCode, 409);
});

test("gitBlobSha matches git's own blob id", () => {
  // `printf 'hello\n' | git hash-object --stdin`
  assert.equal(gitBlobSha(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a");
});
