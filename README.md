# Resume

Christian Dominguez's resume as a single static page: search, expandable role blocks, and
PDF / Word export. Everything on the page renders from [`resume.json`](./resume.json).

## Update the resume

1. Edit `resume.json` (text, roles, bullets, skills, links).
2. Commit and push to `main`. The workflow validates the file and deploys it to Vercel.

To try a change first, open a pull request. The workflow deploys a preview and comments its URL.

`index.html` carries a copy of the data as a fallback and fetches `resume.json` on load, so
editing `resume.json` alone is enough. Validate locally with `node scripts/validate.mjs`.

## Add your photo

Put an image next to `index.html` (for example `photo.jpg`) and set `"photo": "photo.jpg"` in
`resume.json`. Until then the page shows your initials.

## Files

| File                         | Purpose                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| `index.html`                 | The page: styles, search, expandable blocks, PDF/Word export  |
| `resume.json`                | All resume content                                            |
| `wj-mark.svg`                | WarehouseJobs.com mark                                        |
| `vercel.json`                | Static hosting config, clean URLs, cache and security headers |
| `scripts/validate.mjs`       | Checks `resume.json` before every deploy                      |
| `.github/workflows/deploy.yml` | Validate, then deploy to Vercel (preview on PRs, prod on main) |

## One-time Vercel setup

1. Install the CLI and sign in: `npm i -g vercel && vercel login`.
2. In this folder run `vercel link` and create a project named `resume`. This writes
   `.vercel/project.json`, which holds the `orgId` and `projectId`.
3. In GitHub, open the repo's Settings -> Secrets and variables -> Actions:
   - Secret `VERCEL_TOKEN`: create at Vercel -> Account Settings -> Tokens.
   - Variable `VERCEL_ORG_ID`: the `orgId` value.
   - Variable `VERCEL_PROJECT_ID`: the `projectId` value.
4. Optional: add your domain under the Vercel project's Settings -> Domains.
5. If preview or production URLs ask for a Vercel login, turn off Deployment Protection for
   this project (Settings -> Deployment Protection), since the resume is meant to be public.

## Notes

- The page fetches `resume.json` on load. The export buttons build the PDF and Word files in the
  browser from the same data, so they always match what is shown.
- There is no editor in this public build. Content changes go through Git.
