# Morris Hub security tracker

Admin module: `/home/admin/security`. Only an authenticated profile with the admin role can open it. All security tables and RPCs are restricted to the server service role; ordinary users cannot read findings through the Data API.

## Reviews and fixes

`.github/workflows/security-review.yml` runs on pushes to main, manually from GitHub Actions, and daily at 7:17 a.m. America/Indiana/Indianapolis. Scheduled Actions can be delayed by GitHub. The review uses CodeQL's extended JavaScript/TypeScript security queries and an npm lockfile audit. Dependabot also checks npm daily and GitHub Actions weekly.

The remediation job runs `npm audit fix --package-lock-only --ignore-scripts`, without `--force`. If the lockfile changes, it installs without lifecycle scripts and runs security, narration, and workout tests plus the production build. Only a passing candidate can open/update `security/compatible-dependency-fixes`. GitHub must allow Actions to create pull requests (repository Settings → Actions → General → Workflow permissions). A denied PR write is recorded as a remediation failure and emailed.

Compatible lockfile-only PRs merge automatically after validation if both main and the PR head still match the tested candidate and repository policy allows it. The merge uses an expected head SHA and does not bypass protection. A new review is explicitly dispatched after merging to confirm resolution. If publication, merging or follow-up scheduling fails, the issue is emailed and left for manual review. CodeQL code changes, unsupported fixes, and major dependency upgrades require manual review; this workflow does not claim to autonomously fix arbitrary application code. Findings close only when a later successful review no longer reports them. The tracker preserves findings from failed sources and ignores reports older than the latest run. A fix PR is never equivalent to a resolved vulnerability.

## Reporting and email

The report job uses a short-lived GitHub OIDC token rather than a stored production secret. The API verifies GitHub's signing keys, issuer, audience, immutable repository ID, exact main-branch workflow, event type, run ID, attempt, and commit SHA. PR workflows cannot report or alter findings. Reports are bounded and external links are restricted to this repository or GitHub advisories.

Alerts go to the owner-approved recipient **tmorr16@gmail.com** using the existing Resend account and verified `RESEND_FROM_EMAIL`. Alerts include medium/high/critical findings (including pending fix PRs), incomplete scans, failed fix validation or PR publication, and reports older than 36 hours. Unresolved issues receive daily reminders. Resend acceptance is recorded, not a claim of inbox delivery. A persisted queue, database claims and provider idempotency keys protect retries and concurrent jobs; failed sends remain visible in the admin module.

`/api/cron/security-alerts` runs daily at 14:47 UTC to retry pending messages and check report freshness independently of Actions. It fails closed unless `CRON_SECRET` is configured. The existing production `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and Supabase service-role configuration are required. If the entire site or email provider is unavailable, no system hosted solely on that site can guarantee email; check GitHub Actions failure notifications as a separate channel.

## Verification

- `npm run test:security`: signed-run authorization boundaries, payload limits, URL restrictions, audit/SARIF normalization, incomplete scans, cron authentication, notification retries and deduplication.
- Database transaction fixture verifies privileges, initial ingestion, failed-source retention, stale-run rejection, and resolution on a completed clean scan; fixture is rolled back.
- `npm run test:voice`, `npm run test:workout`, `npm run build`.

These automated reviews cover dependency advisories and statically detected code issues. They do not replace runtime testing or a full security assessment.
