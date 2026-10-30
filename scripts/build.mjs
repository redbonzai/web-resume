// Builds the page from src/template.html and resume.json (embedded as an offline fallback).
//   node scripts/build.mjs                    -> index.html for the hosted site
//   node scripts/build.mjs --artifact <file>  -> standalone page (claude.ai artifact version) that
//                                                builds PDF/Word in the browser with the vendored libs
// The hosted page's Export buttons download the files scripts/export.mjs builds on each deploy.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(root + p, "utf8");
const lib = (p) => {
  const s = read(p).replaceAll("\uFFFD", "\\uFFFD");
  if (s.toLowerCase().includes("</script")) throw new Error(`${p} contains </script`);
  return s;
};
const keep = (html, tag) =>
  html.replaceAll(`<!--${tag}-->`, "").replaceAll(`<!--/${tag}-->`, "").replaceAll(`/*${tag}*/`, "").replaceAll(`/*/${tag}*/`, "");
const drop = (html, tag) =>
  html
    .replace(new RegExp(`<!--${tag}-->[\\s\\S]*?<!--\\/${tag}-->`, "g"), "")
    .replace(new RegExp(`/\\*${tag}\\*/[\\s\\S]*?/\\*/${tag}\\*/`, "g"), "");

const data = JSON.stringify(JSON.parse(read("resume.json"))).replaceAll("</", "<\\/");
const template = read("src/template.html").replace("__DATA__", () => data);

const argv = process.argv.slice(2);
const art = argv.indexOf("--artifact");
if (art >= 0) {
  const out = resolve(argv[art + 1] || "artifact.html");
  const html = keep(drop(template, "OWN"), "ED")
    .replace("__JSPDF__", () => lib("vendor/jspdf.umd.min.js"))
    .replace("__DOCX__", () => lib("vendor/docx.iife.js"));
  writeFileSync(out, html);
  console.log(`${out} written (${html.length} bytes)`);
} else {
  const html = keep(drop(template, "ED"), "OWN");
  if (html.includes("__JSPDF__") || html.includes("__DOCX__")) throw new Error("export libraries leaked into index.html");
  writeFileSync(root + "index.html", html);
  console.log(`index.html written (${html.length} bytes)`);
}
