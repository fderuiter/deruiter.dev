# Check Vercel dashboard settings

Compare the portfolio project's Build and Deployment settings with
[`vercel.json`](../../vercel.json) before an intentional configuration change.
The project file supplies the install, build and ignore commands for the
deployment. Leave dashboard command overrides off so there is one place to
review the commands.

| Setting | Owner | Expected value |
| --- | --- | --- |
| Framework preset | Repository | Next.js |
| Root directory | Dashboard | Repository root |
| Install Command | Repository | `npm ci` |
| Build Command | Repository | `npm run build` |
| Ignored Build Step | Repository | `node scripts/vercel-ignore-build.js` |
| Output directory | Framework default | Next.js default |
| Node.js version | Dashboard | 24.x, within the range in `package.json` |
| Build heap limit | Repository | 3584 MB, set by `scripts/build.js` |
| Automatic Git deployments | Repository | Disabled through `git.deploymentEnabled` |

Run `npm run doctor` and look for **Vercel Build Commands**. This check reads
the repository file. Inspect the dashboard directly to confirm any overrides
and whether a project environment variable also sets a build heap flag.

The [release runbook](release-and-deploy.md) covers the weekly train and
manual releases. See [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
for command precedence.
