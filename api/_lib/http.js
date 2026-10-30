"use strict";

const MAX_BODY_BYTES = 256 * 1024;

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined) {
    res.end();
    return;
  }
  if (typeof body === "string") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(body);
    return;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function redirect(res, location, headers = {}) {
  res.statusCode = 302;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", location);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end();
}

/** Browsers only add this header from our own page's script; cross-site forms cannot. */
function hasCsrfHeader(req) {
  return req.headers["x-requested-with"] === "resume-editor";
}

async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  let raw = req.body;
  if (raw === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) throw new Error("too_large");
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  if (typeof raw === "string") {
    if (raw.length > maxBytes) throw new Error("too_large");
    return JSON.parse(raw);
  }
  return raw;
}

module.exports = { send, redirect, hasCsrfHeader, readJsonBody, MAX_BODY_BYTES };
