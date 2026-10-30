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

/** Git's blob id for `buf`, so the new resume.json sha is known without another request. */
function gitBlobSha(buf) {
  return require("node:crypto")
    .createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]))
    .digest("hex");
}

async function ghJson(config, path, init, okStatus = [200, 201]) {
  const res = await gh(config, path, init && {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (res.status === 409 || res.status === 422) throw new Error("github_conflict");
  if (!okStatus.includes(res.status)) throw new Error(`github_${res.status}`);
  return res.json();
}

/**
 * Commits several files in ONE commit (git data API), failing with github_conflict instead
 * of overwriting if the branch moved. `files` is [{ path, content: Buffer }].
 */
async function commitFiles(config, { files, message }) {
  const r = `/repos/${config.repo}/git`;
  const ref = await ghJson(config, `${r}/ref/heads/${encodeURIComponent(config.branch)}`);
  const parent = ref.object.sha;
  const parentCommit = await ghJson(config, `${r}/commits/${parent}`);
  const entries = [];
  for (const f of files) {
    const blob = await ghJson(config, `${r}/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: f.content.toString("base64"), encoding: "base64" }),
    });
    entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await ghJson(config, `${r}/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: entries }),
  });
  const commit = await ghJson(config, `${r}/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }),
  });
  await ghJson(config, `${r}/refs/heads/${encodeURIComponent(config.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return { commit: commit.sha };
}

module.exports = { getResumeFile, putResumeFile, commitFiles, gitBlobSha };
