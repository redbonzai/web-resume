// Builds index.html from src/template.html, resume.json (embedded as an offline fallback)
// and the vendored export libraries. Run: node scripts/build.mjs
// The template also carries "ED" blocks for the claude.ai artifact version; they are removed here.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(root + p, "utf8");

const lib = (p) => {
  const s = read(p).replaceAll("�", "\\uFFFD");
  if (s.toLowerCase().includes("</script")) throw new Error(`${p} contains </script`);
  return s;
};
const data = JSON.stringify(JSON.parse(read("resume.json"))).replaceAll("</", "<\\/");

let html = read("src/template.html")
  .replace("__DATA__", () => data)
  .replace("__JSPDF__", () => lib("vendor/jspdf.umd.min.js"))
  .replace("__DOCX__", () => lib("vendor/docx.iife.js"));

html = html
  .replace(/<!--ED-->[\s\S]*?<!--\/ED-->/g, "")
  .replace(/\/\*ED\*\/[\s\S]*?\/\*\/ED\*\//g, "")
  .replaceAll("<!--OWN-->", "")
  .replaceAll("<!--/OWN-->", "")
  .replaceAll("/*OWN*/", "")
  .replaceAll("/*/OWN*/", "");

writeFileSync(root + "index.html", html);
console.log(`index.html written (${html.length} bytes)`);
