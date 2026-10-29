"use strict";

const { send, hasCsrfHeader, readJsonBody } = require("./_lib/http");
const { requireOwner } = require("./_lib/guard");
const { validateResume } = require("./_lib/validate");
const { getResumeFile, putResumeFile } = require("./_lib/github");

/**
 * Owner only: validates the submitted resume and commits it to resume.json on GitHub.
 * The existing deploy workflow then publishes it. `baseSha` is the version the editor was
 * opened from; if the file changed since then the save is refused instead of overwriting.
 */
module.exports = async function save(req, res) {
  if (req.method !== "POST") return send(res, 405, "Method not allowed");
  if (!hasCsrfHeader(req)) return send(res, 403, { error: "forbidden" });
  const config = requireOwner(req, res);
  if (!config) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return send(res, err.message === "too_large" ? 413 : 400, { error: "bad_request" });
  }
  if (!body || typeof body.content !== "string" || typeof body.baseSha !== "string") {
    return send(res, 400, { error: "bad_request" });
  }

  let parsed;
  try {
    parsed = JSON.parse(body.content);
  } catch (err) {
    return send(res, 400, { error: "invalid_json", message: err.message });
  }
  const problems = validateResume(parsed);
  if (problems.length) return send(res, 422, { error: "invalid_resume", problems });

  try {
    const current = await getResumeFile(config);
    if (current.sha !== body.baseSha) return send(res, 409, { error: "changed_elsewhere" });
    const result = await putResumeFile(config, {
      content: `${JSON.stringify(parsed, null, 2)}\n`,
      sha: current.sha,
      message: "content: update resume via web editor",
    });
    return send(res, 200, { ok: true, sha: result.sha, commit: result.commit });
  } catch (err) {
    if (err.message === "github_conflict") return send(res, 409, { error: "changed_elsewhere" });
    return send(res, 502, { error: "github_unavailable" });
  }
};
