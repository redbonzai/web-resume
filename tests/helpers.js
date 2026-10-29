"use strict";

const { createSessionCookie } = require("../api/_lib/session");

const ENV = {
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  SESSION_SECRET: "x".repeat(40),
  ALLOWED_GITHUB_USER: "redbonzai",
  SITE_URL: "https://example.test",
  GITHUB_REPO: "redbonzai/web-resume",
  GITHUB_BRANCH: "main",
  GITHUB_TOKEN: "ghp_test",
};

function setEnv() {
  Object.assign(process.env, ENV);
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.ended = true;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
  return res;
}

function makeReq({ method = "GET", url = "/", headers = {}, body } = {}) {
  return { method, url, headers, body };
}

/** Cookie header value for a valid session of `user`. */
function sessionHeader(user = "redbonzai") {
  const setCookie = createSessionCookie(user, ENV.SESSION_SECRET);
  return setCookie.split(";")[0];
}

const goodResume = () => ({
  name: "Test Person",
  headline: "Engineer",
  summary: "Builds things.",
  links: [{ label: "Site", url: "https://example.test" }],
  skills: [{ group: "Languages", items: ["TypeScript"] }],
  experience: [{ company: "Acme", role: "Engineer", dates: "2020 - present", bullets: ["Did work."] }],
});

module.exports = { ENV, setEnv, makeRes, makeReq, sessionHeader, goodResume };
