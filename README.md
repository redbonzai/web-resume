# web-resume

Christian Dominguez's resume as a single static page: search, expandable role blocks, and
PDF / Word export. Everything on the page renders from [`resume.json`](./resume.json).
Live at https://web-resume-beryl.vercel.app/

## Update the resume

**From the live site (owner only).** Open the site, click "Owner sign in" in the footer, sign
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

## Add your photo

Put an image next to `index.html` (for example `photo.jpg`) and set `"photo": "photo.jpg"` in
`resume.json`. Until then the page shows your initials.

## Files

| File                           | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| `index.html`                   | The page: styles, search, expandable blocks, export, editor    |
| `resume.json`                  | All resume content                                             |
| `api/`                         | Serverless functions: GitHub sign-in, load and save            |
| `api/_lib/`                    | Session signing, validation, GitHub client (not routes)        |
| `tests/`                       | `npm test` runs the sign-in, session, validation and save tests |
| `scripts/validate.mjs`         | Checks `resume.json` before every deploy                       |
| `vercel.json`                  | Static hosting, clean URLs, cache and security headers         |
| `.github/workflows/deploy.yml` | Test and validate, then deploy to Vercel                       |

## Deploy workflow

`deploy.yml` runs the tests and validates `resume.json`, then deploys with the Vercel CLI.
Pull requests get a preview; pushes to `main` go to production. It reads `VERCEL_TOKEN`,
`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from the `PRODUCTION` GitHub environment.

## Notes

- The export buttons build the PDF and Word files in the browser from the same data as the page.
- Do not commit real secrets. `.env.example` lists names only.
