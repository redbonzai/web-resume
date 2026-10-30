import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { buildDocx, buildPrintHtml, fileBase } from "../scripts/export.mjs";

const resume = JSON.parse(readFileSync(new URL("../resume.json", import.meta.url), "utf8"));

/** Reads one entry out of a zip buffer (enough for a .docx; no dependency). */
function unzipEntry(buf, name) {
  let off = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(off + 10);
  let p = buf.readUInt32LE(off + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const entry = buf.toString("utf8", p + 46, p + 46 + nlen);
    if (entry === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    p += 46 + nlen + elen + clen;
  }
  throw new Error(`${name} not in zip`);
}

test("file names match what the page's Export buttons request", () => {
  assert.equal(fileBase({ name: " Christian  Dominguez " }), "Christian-Dominguez-Resume");
});

test("the Word file contains every section and role from resume.json", async () => {
  const buf = await buildDocx(resume);
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const xml = unzipEntry(buf, "word/document.xml");
  const text = xml.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  for (const s of [resume.name, resume.headline, "Summary", "Core Skills", "Professional Experience", "Education"]) {
    assert.ok(text.includes(s), s);
  }
  for (const j of resume.experience) {
    assert.ok(text.includes(j.company), j.company);
    for (const b of j.bullets) assert.ok(text.includes(b), b.slice(0, 40));
  }
  for (const g of resume.skills) assert.ok(text.includes(g.items.join(", ")), g.group);
});

test("the PDF layout escapes content and includes every bullet", () => {
  const html = buildPrintHtml({ ...resume, summary: 'a <script>x</script> & "b"' });
  assert.ok(!html.includes("<script>x"));
  assert.ok(html.includes("a &lt;script&gt;x&lt;/script&gt; &amp; &quot;b&quot;"));
  const count = (html.match(/<li>/g) || []).length;
  const expected = resume.experience.reduce((n, j) => n + j.bullets.length, 0);
  assert.ok(count >= expected, `${count} >= ${expected}`);
});
