"use strict";

/** Checks the fields the page renders. Returns a list of problems (empty when valid). */
function validateResume(data) {
  const errors = [];
  const need = (ok, msg) => {
    if (!ok) errors.push(msg);
  };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["resume must be a JSON object"];
  }
  for (const key of ["name", "headline", "summary"]) {
    need(typeof data[key] === "string" && data[key].trim() !== "", `"${key}" must be a non-empty string`);
  }
  need(
    Array.isArray(data.experience) && data.experience.length > 0,
    `"experience" must be a non-empty array`,
  );
  (Array.isArray(data.experience) ? data.experience : []).forEach((job, i) => {
    const at = `experience[${i}]${job && job.company ? ` (${job.company})` : ""}`;
    need(typeof job?.company === "string" && job.company !== "", `${at}: "company" is required`);
    need(typeof job?.role === "string" && job.role !== "", `${at}: "role" is required`);
    need(typeof job?.dates === "string" && job.dates !== "", `${at}: "dates" is required`);
    need(
      Array.isArray(job?.bullets) &&
        job.bullets.length > 0 &&
        job.bullets.every((b) => typeof b === "string"),
      `${at}: "bullets" must be a non-empty array of strings`,
    );
  });
  (Array.isArray(data.skills) ? data.skills : []).forEach((g, i) =>
    need(
      typeof g?.group === "string" && Array.isArray(g?.items) && g.items.every((s) => typeof s === "string"),
      `skills[${i}] needs "group" and a list of text "items"`,
    ),
  );
  (Array.isArray(data.links) ? data.links : []).forEach((l, i) =>
    need(/^https:\/\//.test(l?.url ?? ""), `links[${i}].url must start with https://`),
  );
  if (data.photo !== undefined && data.photo !== "") {
    need(
      typeof data.photo === "string" &&
        data.photo.length <= 500 &&
        !/^\s*(javascript|data|vbscript):/i.test(data.photo),
      `"photo" must be a file path or https:// URL`,
    );
  }
  return errors;
}

module.exports = { validateResume };
