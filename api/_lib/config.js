"use strict";

/** Reads configuration from the environment on every call so tests can change it. */
function getConfig() {
  const env = process.env;
  return {
    clientId: env.GITHUB_CLIENT_ID || "",
    clientSecret: env.GITHUB_CLIENT_SECRET || "",
    sessionSecret: env.SESSION_SECRET || "",
    allowedUser: (env.ALLOWED_GITHUB_USER || "").trim().toLowerCase(),
    siteUrl: (env.SITE_URL || "").trim().replace(/\/+$/, ""),
    repo: env.GITHUB_REPO || "redbonzai/web-resume",
    branch: env.GITHUB_BRANCH || "main",
    file: "resume.json",
    githubToken: env.GITHUB_TOKEN || "",
  };
}

/** Returns the names of required settings that are empty. */
function missing(config, keys) {
  return keys.filter((k) => !config[k]);
}

module.exports = { getConfig, missing };
