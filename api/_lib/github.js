"use strict";

const API = "https://api.github.com";

async function gh(config, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubToken}`,
      "User-Agent": "web-resume-editor",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  return res;
}

function contentsPath(config) {
  return `/repos/${config.repo}/contents/${config.file}`;
}

/** Reads resume.json from the repository. Returns { content, sha }. */
async function getResumeFile(config) {
  const res = await gh(config, `${contentsPath(config)}?ref=${encodeURIComponent(config.branch)}`);
  if (!res.ok) throw new Error(`github_read_${res.status}`);
  const json = await res.json();
  return { content: Buffer.from(json.content, "base64").toString("utf8"), sha: json.sha };
}

/** Commits new content for resume.json on the configured branch. */
async function putResumeFile(config, { content, sha, message }) {
  const res = await gh(config, contentsPath(config), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha,
      branch: config.branch,
    }),
  });
  if (res.status === 409 || res.status === 422) throw new Error("github_conflict");
  if (!res.ok) throw new Error(`github_write_${res.status}`);
  const json = await res.json();
  return { sha: json.content.sha, commit: json.commit.sha };
}

module.exports = { getResumeFile, putResumeFile };
