// Fails the build if resume.json is not valid or is missing the fields the page renders.
import { readFileSync } from "node:fs";

const path = new URL("../resume.json", import.meta.url);
let data;
try {
  data = JSON.parse(readFileSync(path, "utf8"));
} catch (err) {
  console.error(`resume.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

for (const key of ["name", "headline", "summary"]) {
  need(typeof data[key] === "string" && data[key].trim() !== "", `"${key}" must be a non-empty string`);
}
need(Array.isArray(data.experience) && data.experience.length > 0, `"experience" must be a non-empty array`);
(data.experience ?? []).forEach((job, i) => {
  const at = `experience[${i}]${job.company ? ` (${job.company})` : ""}`;
  need(typeof job.company === "string" && job.company !== "", `${at}: "company" is required`);
  need(typeof job.role === "string" && job.role !== "", `${at}: "role" is required`);
  need(typeof job.dates === "string" && job.dates !== "", `${at}: "dates" is required`);
  need(Array.isArray(job.bullets) && job.bullets.length > 0, `${at}: "bullets" must be a non-empty array`);
});
(data.skills ?? []).forEach((g, i) =>
  need(typeof g.group === "string" && Array.isArray(g.items), `skills[${i}] needs "group" and "items"`),
);
(data.links ?? []).forEach((l, i) =>
  need(/^https:\/\//.test(l.url ?? ""), `links[${i}].url must start with https://`),
);

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log(`resume.json OK: ${data.experience.length} roles, ${(data.skills ?? []).length} skill groups.`);
