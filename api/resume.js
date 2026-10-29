"use strict";

const { send } = require("./_lib/http");
const { requireOwner } = require("./_lib/guard");
const { getResumeFile } = require("./_lib/github");

/** Owner only: the current resume.json from GitHub, plus the sha needed to save over it. */
module.exports = async function resume(req, res) {
  if (req.method !== "GET") return send(res, 405, "Method not allowed");
  const config = requireOwner(req, res);
  if (!config) return;
  try {
    return send(res, 200, await getResumeFile(config));
  } catch {
    return send(res, 502, { error: "github_unavailable" });
  }
};
