# web-resume

Christian Dominguez's resume as a single static page: search, expandable role blocks, and
PDF / Word export. Everything on the page renders from [`resume.json`](./resume.json).
Live at https://christian-dominguez-resume.vercel.app/

## Update the resume

**From the live site (owner only).** Open the site, click "Owner sign in" in the toolbar, sign
in with GitHub, then click Edit. Change the JSON, preview it, and press "Save to site". The save
commits `resume.json` to `main`, and the deploy workflow republishes in about a minute.

**From Git.** Edit `resume.json`, commit and push to `main`. To try a change first, open a
pull request; the workflow deploys a preview and comments its URL. Validate locally with
`npm run validate`.

## How owner sign-in works

- `/api/auth/login` sends you to GitHub's OAuth screen. `/api/auth/callback` exchanges the code,
  reads your GitHub username once, and throws the GitHub token away.
- Only the account named in `ALLOWED_GITHUB_USER` gets a session. The session is a signed,
  `HttpOnly`, `Secure`, `SameSite=Lax` cookie that expires after 8 hours.
- `/api/resume` and `/api/save` check that cookie on every call. Saving also needs an
  `X-Requested-With` header, validates the JSON, and refuses to overwrite a newer version.
- Commits are made server-side with a fine-grained token limited to this repository. That token
  never reaches the browser.
- Visitors only ever see the read-only page. The editor code runs only after `/api/auth/me`
  confirms the signed-in owner.

### One-time setup

1. **OAuth app.** GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App.
   - Homepage URL: `https://web-resume-beryl.vercel.app`
   - Authorization callback URL: `https://web-resume-beryl.vercel.app/api/auth/callback`
   - Create it, then generate a client secret.
2. **Repository token.** GitHub -> Settings -> Developer settings -> Fine-grained tokens ->
   Generate. Repository access: only `redbonzai/web-resume`. Permission: Contents, Read and write.
3. **Session secret.** Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. **Vercel.** Project `web-resume` -> Settings -> Environment Variables. Add these for
   Production (see [`.env.example`](./.env.example)): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
   `SESSION_SECRET`, `ALLOWED_GITHUB_USER`, `SITE_URL`, `GITHUB_REPO`, `GITHUB_BRANCH`,
   `GITHUB_TOKEN`.
5. Redeploy (push any change, or re-run the workflow). Environment variables apply to new deployments only.

If the site gets a custom domain later, change `SITE_URL` and the OAuth app's URLs to match.

## Change your photo

Signed in as the owner, tap your avatar (or "Change photo" in the editor) and pick an image.
Drag to position it, zoom with the slider, a pinch or the scroll wheel, then "Save photo". The
square crop is stored as `photo.jpg` and `resume.json`'s `"photo"` is pointed at it, in one
commit; the site republishes in about a minute. Without a photo the page shows your initials.

## Word and PDF downloads

Every deploy runs `node scripts/export.mjs`, which builds `downloads/Christian-Dominguez-Resume.docx`
and `.pdf` from `resume.json`, and the site's Export buttons download exactly those files. Editing
`resume.json` (from the web editor or Git) therefore updates the page, both downloads, and the copy
you upload to job sites, in one step. To get the files locally, run `node scripts/export.mjs`
(needs Google Chrome for the PDF; `--no-pdf` makes the Word file only). `downloads/` is not
committed.

## Change the page itself

The page is built from `src/template.html` plus `resume.json`. After editing the template run
`node scripts/build.mjs` and commit the regenerated `index.html`; CI fails if you forget.
`node scripts/build.mjs --artifact out.html` builds the standalone version that makes PDF/Word in
the browser with the libraries in `vendor/` (jsPDF 2.5.2 and docx 9.8.1). `resume.json` edits do not need a rebuild: the page
loads it at runtime and only keeps an embedded copy as an offline fallback.

## Files

| File                           | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| `index.html`                   | The built page (generated; do not edit by hand)                |
| `src/template.html`            | Page source: styles, search, blocks, export, editor, cropper   |
| `vendor/`                      | docx (used by the exporter) and jsPDF (standalone build only)  |
| `scripts/export.mjs`           | Builds the Word and PDF downloads from `resume.json`           |
| `scripts/build.mjs`            | Builds `index.html` from the template                          |
| `photo.jpg`                    | Your cropped photo (written by the photo editor)               |
| `resume.json`                  | All resume content                                             |
| `api/`                         | Serverless functions: GitHub sign-in, load, save, photo        |
| `api/_lib/`                    | Session signing, validation, GitHub client (not routes)        |
| `tests/`                       | `npm test` runs the sign-in, session, validation, save, photo and export tests |
| `scripts/validate.mjs`         | Checks `resume.json` before every deploy                       |
| `vercel.json`                  | Static hosting, clean URLs, cache and security headers         |
| `.github/workflows/deploy.yml` | Test and validate, then deploy to Vercel                       |

## Deploy workflow

`deploy.yml` runs the tests, validates `resume.json` and checks `index.html` is built from the
current template, then builds the Word/PDF downloads and deploys with the Vercel CLI.
Pull requests get a preview; pushes to `main` go to production. It reads `VERCEL_TOKEN`,
`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from the `PRODUCTION` GitHub environment.

## Notes

- The export buttons download the Word and PDF files built from `resume.json` on the last deploy.
- Do not commit real secrets. `.env.example` lists names only.
