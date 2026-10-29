// Fails the build if resume.json is not valid or is missing the fields the page renders.
// Uses the same rules as the editor's save endpoint (api/_lib/validate.js).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateResume } = require("../api/_lib/validate.js");

let data;
try {
  data = JSON.parse(readFileSync(new URL("../resume.json", import.meta.url), "utf8"));
} catch (err) {
  console.error(`resume.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const errors = validateResume(data);
if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log(`resume.json OK: ${data.experience.length} roles, ${(data.skills ?? []).length} skill groups.`);
