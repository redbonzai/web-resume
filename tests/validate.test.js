"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateResume } = require("../api/_lib/validate");
const { goodResume } = require("./helpers");
const fs = require("node:fs");
const path = require("node:path");

test("the shipped resume.json is valid", () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "resume.json"), "utf8"));
  assert.deepEqual(validateResume(data), []);
});

test("a complete resume is valid", () => {
  assert.deepEqual(validateResume(goodResume()), []);
});

test("non-objects are rejected", () => {
  for (const bad of [null, [], "x", 3]) assert.equal(validateResume(bad).length, 1);
});

test("missing top-level fields and empty experience are reported", () => {
  const r = goodResume();
  r.name = " ";
  r.experience = [];
  const errors = validateResume(r).join("\n");
  assert.match(errors, /"name"/);
  assert.match(errors, /"experience"/);
});

test("each role needs company, role, dates and text bullets", () => {
  const r = goodResume();
  r.experience[0] = { company: "Acme", bullets: [1] };
  const errors = validateResume(r).join("\n");
  assert.match(errors, /"role" is required/);
  assert.match(errors, /"dates" is required/);
  assert.match(errors, /bullets/);
});

test("links must use https", () => {
  const r = goodResume();
  r.links = [{ label: "x", url: "javascript:alert(1)" }];
  assert.match(validateResume(r).join("\n"), /https/);
});

test("photo may be a path or https URL but not a script or data URL", () => {
  const ok = goodResume();
  ok.photo = "photo.jpg";
  assert.deepEqual(validateResume(ok), []);
  for (const bad of ["javascript:alert(1)", "data:text/html;base64,AAAA"]) {
    const r = goodResume();
    r.photo = bad;
    assert.match(validateResume(r).join("\n"), /photo/);
  }
});
