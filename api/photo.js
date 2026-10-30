"use strict";

const crypto = require("node:crypto");
const { send, hasCsrfHeader, readJsonBody } = require("./_lib/http");
const { requireOwner } = require("./_lib/guard");
const { getResumeFile, commitFiles, gitBlobSha } = require("./_lib/github");

const PHOTO_PATH = "photo.jpg";
const MAX_PHOTO_BYTES = 600 * 1024;

/** Accepts only a base64 JPEG data URL (the cropper always produces one). */
function decodeJpeg(dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  const isJpeg = buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return isJpeg && buf.length <= MAX_PHOTO_BYTES ? buf : null;
}

/**
 * Owner only: stores the cropped photo as photo.jpg and points resume.json's "photo" at it,
 * both in a single commit. The ?v= suffix changes with the image so browsers never show a
 * stale cached photo. Returns the new resume.json sha so an open editor can keep saving.
 */
module.exports = async function photo(req, res) {
  if (req.method !== "POST") return send(res, 405, "Method not allowed");
  if (!hasCsrfHeader(req)) return send(res, 403, { error: "forbidden" });
  const config = requireOwner(req, res);
  if (!config) return;

  let body;
  try {
    body = await readJsonBody(req, 1024 * 1024);
  } catch (err) {
    return send(res, err.message === "too_large" ? 413 : 400, { error: "bad_request" });
  }
  const image = decodeJpeg(body && body.image);
  if (!image) return send(res, 422, { error: "invalid_image" });

  try {
    const current = await getResumeFile(config);
    let resume;
    try {
      resume = JSON.parse(current.content);
    } catch {
      return send(res, 409, { error: "resume_unreadable" });
    }
    const version = crypto.createHash("sha256").update(image).digest("hex").slice(0, 10);
    resume.photo = `${PHOTO_PATH}?v=${version}`;
    const json = Buffer.from(`${JSON.stringify(resume, null, 2)}\n`, "utf8");
    const result = await commitFiles(config, {
      message: "content: update resume photo via web editor",
      files: [
        { path: PHOTO_PATH, content: image },
        { path: config.file, content: json },
      ],
    });
    return send(res, 200, { ok: true, photo: resume.photo, sha: gitBlobSha(json), commit: result.commit });
  } catch (err) {
    if (err.message === "github_conflict") return send(res, 409, { error: "changed_elsewhere" });
    return send(res, 502, { error: "github_unavailable" });
  }
};
