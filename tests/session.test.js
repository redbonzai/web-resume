"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sign, verify, parseCookies, getSession, createSessionCookie } = require("../api/_lib/session");

const SECRET = "s".repeat(40);

test("a signed token verifies and returns its payload", () => {
  const token = sign({ u: "me", exp: Date.now() + 1000 }, SECRET);
  assert.equal(verify(token, SECRET).u, "me");
});

test("a token signed with another secret is rejected", () => {
  const token = sign({ u: "me", exp: Date.now() + 1000 }, "other-secret-other-secret-other-secret");
  assert.equal(verify(token, SECRET), null);
});

test("a tampered payload is rejected", () => {
  const token = sign({ u: "me", exp: Date.now() + 1000 }, SECRET);
  const [, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "admin", exp: Date.now() + 1000 })).toString("base64url");
  assert.equal(verify(`${forged}.${mac}`, SECRET), null);
});

test("an expired token is rejected", () => {
  const token = sign({ u: "me", exp: 1000 }, SECRET);
  assert.equal(verify(token, SECRET, 2000), null);
});

test("malformed and empty tokens are rejected", () => {
  for (const bad of ["", "abc", "a.b.c", undefined, null]) assert.equal(verify(bad, SECRET), null);
  assert.equal(verify("a.b", ""), null);
});

test("the session cookie is HttpOnly, Secure and SameSite=Lax", () => {
  const cookie = createSessionCookie("me", SECRET);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(cookie.includes(flag), flag);
});

test("getSession reads the user from the cookie header", () => {
  const cookie = createSessionCookie("me", SECRET).split(";")[0];
  assert.deepEqual(getSession({ headers: { cookie: `a=1; ${cookie}` } }, SECRET), { user: "me" });
  assert.equal(getSession({ headers: {} }, SECRET), null);
  assert.deepEqual(parseCookies("a=1; b=two%20words"), { a: "1", b: "two words" });
});
