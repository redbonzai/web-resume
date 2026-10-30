// Builds the downloadable resume files from resume.json, so the site, its Export buttons and
// any file you upload elsewhere always say the same thing.
//
//   node scripts/export.mjs                 -> downloads/<Name>-Resume.docx and .pdf
//   node scripts/export.mjs --out dir       -> write somewhere else
//   node scripts/export.mjs --no-pdf        -> Word only (no Chrome needed)
//
// No npm install: Word uses the docx library already vendored for the page, and the PDF is
// printed by headless Chrome (preinstalled on GitHub's ubuntu runners). Set CHROME_PATH to
// point at a specific Chrome or Chromium binary.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));

export function fileBase(R) {
  return `${R.name.trim().replace(/\s+/g, "-")}-Resume`;
}

function loadDocxLib() {
  const ctx = { console, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, Promise, setTimeout, clearTimeout, Buffer, URL, atob, btoa };
  ctx.globalThis = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, "vendor/docx.iife.js"), "utf8"), ctx);
  return ctx.docx;
}

const contactLine = (R) => [R.location, R.phone, R.email].filter(Boolean).join("  •  ");
const companyLine = (j) => j.company + (j.location && !/^remote$/i.test(j.location) ? ` – ${j.location}` : "");
const roleLine = (j) => j.role + (j.tags && j.tags.length ? ` (${j.tags.slice(0, 8).join(" / ")})` : "");

/** Word document (Buffer). Arial, one column, real bullets and headings: parses cleanly in ATS. */
export async function buildDocx(R) {
  const d = loadDocxLib();
  const { Paragraph: P, TextRun: T, ExternalHyperlink: Link, AlignmentType, BorderStyle, HeadingLevel } = d;
  const ACCENT = "C85000";
  const rule = { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } };
  const kids = [];
  const section = (title) =>
    kids.push(new P({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 100 }, border: rule, children: [new T({ text: title, bold: true, size: 28, color: "111111" })] }));
  const bullet = (children) => new P({ bullet: { level: 0 }, spacing: { after: 60 }, children });

  kids.push(new P({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new T({ text: R.name, bold: true, size: 44, color: "111111" })] }));
  kids.push(new P({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new T({ text: R.headline, bold: true, size: 24, color: ACCENT })] }));
  kids.push(new P({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new T({ text: contactLine(R), size: 19, color: "444444" })] }));
  const links = [];
  (R.links || []).forEach((l, i) => {
    if (i) links.push(new T({ text: "  •  ", size: 19, color: "444444" }));
    links.push(new Link({ link: l.url, children: [new T({ text: l.label, size: 19, style: "Hyperlink" })] }));
  });
  if (links.length) kids.push(new P({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: links }));

  section("Summary");
  kids.push(new P({ spacing: { after: 60 }, children: [new T({ text: R.summary, size: 20 })] }));

  section("Core Skills");
  (R.skills || []).forEach((g) => kids.push(bullet([new T({ text: `${g.group}: `, bold: true, size: 20 }), new T({ text: g.items.join(", "), size: 20 })])));

  section("Professional Experience");
  (R.experience || []).forEach((j) => {
    kids.push(new P({ heading: HeadingLevel.HEADING_3, keepNext: true, keepLines: true, spacing: { before: 200, after: 20 }, children: [new T({ text: companyLine(j), bold: true, size: 25, color: "111111" })] }));
    kids.push(new P({ keepNext: true, spacing: { after: 80 }, children: [new T({ text: `${roleLine(j)}  |  ${j.dates}`, bold: true, size: 19, color: "333333" })] }));
    j.bullets.forEach((b) => kids.push(bullet([new T({ text: b, size: 20 })])));
  });

  section("Education");
  (R.education || []).forEach((e) =>
    kids.push(new P({ spacing: { after: 40 }, children: [new T({ text: e.school, bold: true, size: 20 }), new T({ text: e.detail ? ` – ${e.detail}` : "", size: 20 })] })),
  );

  const doc = new d.Document({
    creator: R.name,
    title: `${R.name} Resume`,
    description: R.headline,
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, bottom: 900, left: 1080, right: 1080 } } }, children: kids }],
  });
  return Buffer.from(await d.Packer.toBuffer(doc));
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Print layout for the PDF: same content and order as the Word file. */
export function buildPrintHtml(R) {
  const skills = (R.skills || []).map((g) => `<li><b>${esc(g.group)}:</b> ${esc(g.items.join(", "))}</li>`).join("");
  const jobs = (R.experience || [])
    .map(
      (j) => `<section class="job"><h3>${esc(companyLine(j))}</h3><p class="role">${esc(roleLine(j))} &nbsp;|&nbsp; ${esc(j.dates)}</p>
<ul>${j.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>`,
    )
    .join("");
  const edu = (R.education || []).map((e) => `<p><b>${esc(e.school)}</b>${e.detail ? ` – ${esc(e.detail)}` : ""}</p>`).join("");
  const links = (R.links || []).map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(" &nbsp;•&nbsp; ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(R.name)} Resume</title>
<style>
@page{size:Letter;margin:0.55in 0.7in}
*{box-sizing:border-box}
body{margin:0;font:10pt/1.4 Arial,"Liberation Sans",Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
header{text-align:center;margin-bottom:6pt}
h1{font-size:22pt;margin:0 0 3pt;letter-spacing:-.2pt}
.headline{font-weight:700;font-size:12pt;color:#c85000;margin:0 0 3pt}
.contact{color:#444;font-size:9.5pt;margin:0 0 2pt}
a{color:#1a56b8;text-decoration:none}
h2{font-size:13.5pt;margin:12pt 0 5pt;padding-bottom:2pt;border-bottom:1px solid #999;break-after:avoid}
h3{font-size:12pt;margin:9pt 0 1pt;break-after:avoid}
.role{font-weight:700;font-size:9.5pt;color:#333;margin:0 0 3pt;break-after:avoid}
ul{margin:0;padding-left:15pt}
li{margin:0 0 2.5pt}
.job li{break-inside:avoid}
p{margin:0 0 3pt}
</style></head><body>
<header><h1>${esc(R.name)}</h1><p class="headline">${esc(R.headline)}</p>
<p class="contact">${esc(contactLine(R))}</p><p class="contact">${links}</p></header>
<h2>Summary</h2><p>${esc(R.summary)}</p>
<h2>Core Skills</h2><ul>${skills}</ul>
<h2>Professional Experience</h2>${jobs}
<h2>Education</h2>${edu}
</body></html>`;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const r = spawnSync("which", [name], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

export function printPdf(html, outFile) {
  const chrome = findChrome();
  if (!chrome) throw new Error("Chrome not found. Install Google Chrome or set CHROME_PATH (or use --no-pdf).");
  const dir = mkdtempSync(join(tmpdir(), "resume-pdf-"));
  try {
    const page = join(dir, "resume.html");
    writeFileSync(page, html);
    const args = [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions",
      "--no-pdf-header-footer",
      `--print-to-pdf=${outFile}`, pathToFileURL(page).href,
    ];
    if (typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox");
    const r = spawnSync(chrome, args, { encoding: "utf8", timeout: 90_000 });
    if (r.status !== 0 || !existsSync(outFile) || statSync(outFile).size < 1000) {
      throw new Error(`Chrome could not print the PDF (exit ${r.status}): ${(r.stderr || "").slice(-400)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf("--out");
  const out = resolve(root, outIdx >= 0 ? argv[outIdx + 1] : "downloads");
  const R = JSON.parse(readFileSync(join(root, "resume.json"), "utf8"));
  mkdirSync(out, { recursive: true });
  const base = join(out, fileBase(R));

  writeFileSync(`${base}.docx`, await buildDocx(R));
  console.log(`wrote ${base}.docx`);
  if (!argv.includes("--no-pdf")) {
    printPdf(buildPrintHtml(R), `${base}.pdf`);
    console.log(`wrote ${base}.pdf`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
