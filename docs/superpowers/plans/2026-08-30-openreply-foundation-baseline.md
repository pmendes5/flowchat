# OpenReply Foundation Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the pinned OpenReply baseline into `pmendes5/flowchat`, prove it cleanly builds and runs locally, and validate the canonical real-Instagram `QUERO → public reply → opening DM button → postback → reveal DM` flow before any FlowChat architectural refactor.

**Architecture:** This plan is deliberately limited to the foundation gate from the approved design. `feat/openreply-foundation` starts from FlowChat `main`; the OpenReply snapshot is imported in one commit while `docs/superpowers/**` is preserved. The imported application remains architecturally unchanged until its existing auth, workspace, OAuth, webhook, BullMQ worker, PostgreSQL, Redis, and real Meta message flow have been proven.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript 5, Prisma 7.8, PostgreSQL 16, BullMQ 5.76, Redis 7, NextAuth 5 beta, Zod 4, Vitest 4, npm, Docker Compose, Cloudflare Tunnel, Meta Graph API v25.0.

**Spec:** `docs/superpowers/specs/2026-08-30-openreply-flowchat-foundation-design.md`

## Global Constraints

- Target repository: `pmendes5/flowchat`.
- Target branch: `feat/openreply-foundation`, created from `main` at or after `94f8ade1aaa1c44f0812e8f38913dad2c624251b`.
- Preserve `feat/meta-core-backend` unchanged; do not merge it into this branch.
- OpenReply source is pinned to `diwenne/openreply@cf9cc1ac03c918fbc84e806505b0fe9aa81acf01`.
- Import OpenReply as one snapshot commit; do not graft or merge upstream Git history.
- Retain the upstream MIT `LICENSE` and document the pinned upstream commit.
- Preserve FlowChat `docs/superpowers/**` during the root replacement.
- Do not rebrand, refactor Meta integration, add Flow models, add the visual builder, or add AI in this plan.
- Use the imported `package-lock.json` and `npm ci`; do not switch to pnpm.
- Keep `META_GRAPH_API_VERSION=v25.0` for the baseline.
- Never commit `.env`, access tokens, app secrets, webhook verify tokens, encryption keys, OAuth codes, Resend keys, or other credentials.
- Enter Meta and email-provider secrets only in the local ignored `.env`; do not paste them into ChatGPT, Codex prompts, documentation, test fixtures, commits, or terminal screenshots.
- A baseline checkpoint is successful only when the real Instagram flow is observed end-to-end and its local database/worker evidence is recorded without credentials or message-token payloads.

---

## File Structure for This Plan

The OpenReply snapshot supplies the application files. This plan intentionally adds only provenance and validation documentation around that unmodified baseline.

- `LICENSE` — upstream MIT license; imported verbatim.
- `package.json` / `package-lock.json` — upstream npm dependency and script definitions; imported verbatim.
- `.env.example` — upstream environment contract; imported verbatim during baseline.
- `docker-compose.yml` — PostgreSQL 16 and Redis 7 local services; imported verbatim.
- `prisma/schema.prisma` and `prisma/migrations/**` — upstream data model and migrations; imported verbatim.
- `app/api/webhook/route.ts` — existing webhook verification, persistence, parsing, and queueing path; no redesign yet.
- `app/api/instagram/connect/route.ts` — existing Instagram OAuth start route; no redesign yet.
- `app/api/instagram/callback/route.ts` — existing OAuth callback, token exchange, account persistence, and webhook subscription; no redesign yet.
- `lib/meta/**` — existing Meta OAuth/client/webhook code; no redesign yet.
- `lib/queue/**` and `worker/dm-worker.ts` — existing BullMQ queue and worker implementation; no redesign yet.
- `__tests__/**` — imported upstream test suite used as the automated baseline gate.
- `docs/superpowers/specs/2026-08-30-openreply-flowchat-foundation-design.md` — approved FlowChat design; preserved.
- `docs/superpowers/plans/2026-08-30-openreply-foundation-baseline.md` — this execution plan; preserved.
- `docs/upstream/openreply-baseline.md` — provenance note created in Task 1.
- `docs/validation/openreply-baseline.md` — evidence checklist created and updated by Tasks 2–6.

---

### Task 1: Create the Foundation Branch and Import the Pinned OpenReply Snapshot

**Files:**
- Replace: tracked repository root files outside `docs/superpowers/**` with the contents of `diwenne/openreply@cf9cc1ac03c918fbc84e806505b0fe9aa81acf01`
- Preserve: `docs/superpowers/**`
- Create: `docs/upstream/openreply-baseline.md`
- Verify: `LICENSE`, `package.json`, `package-lock.json`, `lib/meta/client.ts`, `lib/meta/oauth.ts`, `lib/meta/webhook.ts`, `app/api/webhook/route.ts`, `lib/queue/dm-worker.ts`, `prisma/schema.prisma`

**Interfaces:**
- Consumes: FlowChat `main`; pinned OpenReply Git commit.
- Produces: branch `feat/openreply-foundation` containing the exact OpenReply application snapshot plus preserved FlowChat design/plan docs and one provenance document.

- [ ] **Step 1: Verify the FlowChat checkout is clean and update `main`**

Run from the FlowChat repository in PowerShell:

```powershell
git status --short
```

Expected: no output. If there are local changes, stop; do not stash, discard, or overwrite them automatically.

Then run:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

Expected: `main` is at or ahead of `94f8ade1aaa1c44f0812e8f38913dad2c624251b` and the pull is fast-forward only.

- [ ] **Step 2: Create the implementation branch**

```powershell
git switch -c feat/openreply-foundation
```

Expected: current branch is `feat/openreply-foundation`.

Verify:

```powershell
git branch --show-current
```

Expected:

```text
feat/openreply-foundation
```

- [ ] **Step 3: Clone and pin the upstream source outside the repository**

```powershell
$upstream = Join-Path $env:TEMP ("openreply-flowchat-" + [guid]::NewGuid().ToString("N"))
git clone https://github.com/diwenne/openreply.git $upstream
git -C $upstream checkout cf9cc1ac03c918fbc84e806505b0fe9aa81acf01
$upstreamHead = (git -C $upstream rev-parse HEAD).Trim()
if ($upstreamHead -ne "cf9cc1ac03c918fbc84e806505b0fe9aa81acf01") { throw "Unexpected OpenReply commit: $upstreamHead" }
```

Expected: no exception; `$upstreamHead` equals the pinned SHA.

- [ ] **Step 4: Remove the old tracked application files while preserving FlowChat design documents**

```powershell
git rm -r --ignore-unmatch . ':(exclude)docs/superpowers/**'
```

Expected: old tracked application files are staged for deletion, while `docs/superpowers/**` remains in the working tree.

Verify before copying anything:

```powershell
if (-not (Test-Path "docs/superpowers")) { throw "docs/superpowers was removed unexpectedly" }
```

- [ ] **Step 5: Copy the pinned OpenReply working tree without its `.git` directory**

```powershell
Get-ChildItem -Force $upstream |
  Where-Object { $_.Name -ne ".git" } |
  Copy-Item -Destination . -Recurse -Force
```

Do not copy `$upstream\.git`.

Verify the upstream license exists:

```powershell
if (-not (Test-Path "LICENSE")) { throw "OpenReply LICENSE missing" }
```

- [ ] **Step 6: Create the provenance document**

Create `docs/upstream/openreply-baseline.md` with exactly this content:

```markdown
# OpenReply Upstream Baseline

FlowChat adopted OpenReply as its Instagram/application foundation on 2026-08-30.

- Upstream repository: `diwenne/openreply`
- Imported commit: `cf9cc1ac03c918fbc84e806505b0fe9aa81acf01`
- Import strategy: source snapshot in one FlowChat commit; upstream Git history was not merged.
- License: MIT; the imported upstream `LICENSE` file is retained in this repository.

The imported baseline must be validated without structural refactoring before FlowChat Core replaces the legacy campaign executor.
```

- [ ] **Step 7: Verify critical imported files byte-for-byte against the pinned checkout**

```powershell
$critical = @(
  "LICENSE",
  "package.json",
  "package-lock.json",
  ".env.example",
  "docker-compose.yml",
  "prisma/schema.prisma",
  "lib/meta/client.ts",
  "lib/meta/oauth.ts",
  "lib/meta/webhook.ts",
  "app/api/webhook/route.ts",
  "lib/queue/dm-worker.ts"
)

foreach ($file in $critical) {
  $localHash = (Get-FileHash -Algorithm SHA256 $file).Hash
  $upstreamHash = (Get-FileHash -Algorithm SHA256 (Join-Path $upstream $file)).Hash
  if ($localHash -ne $upstreamHash) { throw "Imported file differs from upstream: $file" }
}
```

Expected: no exception.

- [ ] **Step 8: Stage and inspect the one-shot import**

```powershell
git add -A
git status --short
git diff --cached --stat
```

Check all three conditions before committing:

1. `docs/superpowers/**` is still present.
2. `LICENSE` is staged and matches upstream.
3. No `.env` or secret-bearing local file is staged.

Explicit secret-file check:

```powershell
$staged = git diff --cached --name-only
$forbidden = $staged | Where-Object { $_ -match '(^|/|\\)\.env($|\.)' -and $_ -notmatch '\.env\.example$' }
if ($forbidden) { throw "Secret env file staged: $($forbidden -join ', ')" }
```

- [ ] **Step 9: Commit the imported foundation**

```powershell
git commit -m "chore: adopt OpenReply as FlowChat foundation"
```

Expected: one commit contains the OpenReply source snapshot and provenance note, without upstream history grafting.

- [ ] **Step 10: Remove the temporary upstream clone**

```powershell
Remove-Item -Recurse -Force $upstream
```

Expected: FlowChat working tree remains clean.

```powershell
git status --short
```

Expected: no output.

---

### Task 2: Prove the Imported Baseline Passes Its Automated Quality Gate

**Files:**
- Create: `docs/validation/openreply-baseline.md`
- Test: `__tests__/oauth.test.ts`
- Test: `__tests__/webhook.test.ts`
- Test: `__tests__/dm-worker.test.ts`
- Test: complete imported `__tests__/**` suite

**Interfaces:**
- Consumes: imported npm scripts and upstream test suite from Task 1.
- Produces: a reproducible automated-baseline record proving dependency install, Prisma generation, typecheck, lint, tests, and production build pass before any FlowChat modification.

- [ ] **Step 1: Create the validation record with unchecked gates**

Create `docs/validation/openreply-baseline.md`:

```markdown
# OpenReply Baseline Validation

Date: 2026-08-30
Upstream: `diwenne/openreply@cf9cc1ac03c918fbc84e806505b0fe9aa81acf01`
FlowChat branch: `feat/openreply-foundation`

## Automated gate

- [ ] `npm ci`
- [ ] `npm run db:generate`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`

## Local runtime gate

- [ ] PostgreSQL healthy
- [ ] Redis healthy
- [ ] Prisma migrations deployed
- [ ] Next.js application reachable
- [ ] BullMQ worker connected and running

## Auth/workspace gate

- [ ] Magic-link login succeeds
- [ ] Authenticated dashboard loads
- [ ] Workspace is created/resolved for the signed-in user

## Instagram connection gate

- [ ] Public HTTPS tunnel reaches the local app
- [ ] Meta webhook verification succeeds at `/api/webhook`
- [ ] Instagram OAuth returns through `/api/instagram/callback`
- [ ] Connected Instagram account is stored
- [ ] `webhookSubscribed` is true or subscription success is otherwise verified

## Real `QUERO` acceptance gate

- [ ] Campaign configured for keyword `QUERO`
- [ ] Real external account comments `QUERO`
- [ ] Comment webhook is persisted and processed
- [ ] Public reply is visible on Instagram
- [ ] Opening private reply is received
- [ ] Opening private reply contains `INICIAR AQUI`
- [ ] Button tap produces a postback event
- [ ] Reveal/second DM is received
- [ ] Matching `DmLog` reaches `SENT`

## Security check

- [ ] No secrets, tokens, OAuth codes, webhook payload credentials, or `.env` values were committed to Git
```

- [ ] **Step 2: Install exactly the locked dependencies**

```powershell
npm ci
```

Expected: exit code `0` and no mutation of `package-lock.json`.

Verify:

```powershell
git diff -- package-lock.json
```

Expected: no output.

Mark only the `npm ci` checkbox as complete after the command succeeds.

- [ ] **Step 3: Generate the Prisma client**

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/instrareply"
npm run db:generate
```

Expected: exit code `0`.

Mark `npm run db:generate` complete only after success.

- [ ] **Step 4: Run typecheck**

```powershell
npm run typecheck
```

Expected: exit code `0`.

Mark `npm run typecheck` complete only after success.

- [ ] **Step 5: Run lint**

```powershell
npm run lint
```

Expected: exit code `0`.

Mark `npm run lint` complete only after success.

- [ ] **Step 6: Run the focused Meta/OAuth/worker tests first**

```powershell
npx vitest run __tests__/oauth.test.ts __tests__/webhook.test.ts __tests__/dm-worker.test.ts
```

Expected: exit code `0`.

If any focused test fails, stop. Do not refactor or rebrand; diagnose the imported baseline first.

- [ ] **Step 7: Run the full upstream test suite**

```powershell
npm test
```

Expected: exit code `0`.

Mark `npm test` complete only after the entire suite passes.

- [ ] **Step 8: Run the production build using non-secret CI-safe values**

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/instrareply"
$env:REDIS_URL = "redis://localhost:6379"
$env:NEXTAUTH_URL = "http://localhost:3000"
$env:NEXTAUTH_SECRET = "test-secret-for-ci-build"
$env:CRON_SECRET = "test-secret-for-ci-cron"
$env:ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
$env:RESEND_API_KEY = "re_test"
$env:EMAIL_FROM = "OpenReply <login@example.com>"
$env:META_GRAPH_API_VERSION = "v25.0"
$env:INSTAGRAM_APP_ID = "test"
$env:INSTAGRAM_APP_SECRET = "test"
$env:FACEBOOK_APP_SECRET = "test"
$env:WEBHOOK_VERIFY_TOKEN = "test"
npm run build
```

Expected: exit code `0`.

Mark `npm run build` complete only after success.

- [ ] **Step 9: Commit the automated-baseline record**

```powershell
git add docs/validation/openreply-baseline.md
git diff --cached --check
git commit -m "test: verify imported OpenReply baseline"
```

Expected: only the validation document changes in this commit.

---

### Task 3: Bring Up PostgreSQL, Redis, the Next.js App, and the Worker Locally

**Files:**
- Local only, never commit: `.env`
- Modify: `docs/validation/openreply-baseline.md`
- Runtime: `docker-compose.yml`, Prisma migrations, Next.js app, `worker/dm-worker.ts`

**Interfaces:**
- Consumes: upstream `.env.example`, Docker Compose services, Prisma migrations, npm `dev` and `worker` scripts.
- Produces: a healthy local OpenReply baseline runtime with persistent database and queue services.

- [ ] **Step 1: Create the ignored local environment file**

```powershell
Copy-Item .env.example .env
```

Confirm Git ignores it:

```powershell
git check-ignore .env
```

Expected: `.env` is printed. If `.env` is not ignored, stop before placing any secret in it.

- [ ] **Step 2: Generate local application secrets without sharing them**

Generate a 32-byte hex encryption key:

```powershell
$encryptionKey = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
$encryptionKey
```

Generate independent random values for `NEXTAUTH_SECRET`, `CRON_SECRET`, and `WEBHOOK_VERIFY_TOKEN`:

```powershell
$nextAuthSecret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$cronSecret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$webhookVerifyToken = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Place these values directly into local `.env`. Do not paste them into chat, documentation, commits, or screenshots.

Keep these baseline values:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/openreply
REDIS_URL=redis://localhost:6379
META_GRAPH_API_VERSION=v25.0
NEXTAUTH_URL=http://localhost:3000
```

The Meta and email-provider values are filled locally in later tasks.

- [ ] **Step 3: Start PostgreSQL and Redis**

```powershell
docker compose up -d postgres redis
docker compose ps
```

Expected: both `postgres` and `redis` report healthy after their health checks complete.

If they are still starting, wait and rerun `docker compose ps`; do not continue until both are healthy.

- [ ] **Step 4: Deploy the imported Prisma migrations**

```powershell
npm run db:migrate
```

Expected: exit code `0`; all imported migrations are applied to database `openreply`.

Verify from PostgreSQL:

```powershell
docker compose exec -T postgres psql -U postgres -d openreply -c 'SELECT COUNT(*) AS migration_count FROM "_prisma_migrations";'
```

Expected: query succeeds and `migration_count` is greater than `0`.

- [ ] **Step 5: Start the application in its own PowerShell window**

```powershell
npm run dev
```

Expected: Next.js reports a local URL on port `3000` and remains running.

From another PowerShell window:

```powershell
$response = Invoke-WebRequest http://localhost:3000/login -UseBasicParsing
$response.StatusCode
```

Expected: `200`.

- [ ] **Step 6: Start the worker in a separate PowerShell window**

```powershell
npm run worker
```

Expected: the process remains running without Redis connection errors or immediate uncaught exceptions.

- [ ] **Step 7: Record the local runtime gate**

In `docs/validation/openreply-baseline.md`, mark these items complete only after direct verification:

```markdown
- [x] PostgreSQL healthy
- [x] Redis healthy
- [x] Prisma migrations deployed
- [x] Next.js application reachable
- [x] BullMQ worker connected and running
```

- [ ] **Step 8: Verify no local secrets are staged and commit the runtime evidence**

```powershell
git status --short
$stagedOrModifiedEnv = git status --short | Select-String -Pattern '\.env($|\s)'
if ($stagedOrModifiedEnv) { throw ".env unexpectedly visible to Git status" }
git add docs/validation/openreply-baseline.md
git diff --cached --check
git commit -m "test: validate local OpenReply runtime"
```

Expected: commit contains only the updated validation record.

---

### Task 4: Validate Magic-Link Login and Workspace Access

**Files:**
- Local only, never commit: `.env`
- Modify: `docs/validation/openreply-baseline.md`
- Exercise: existing auth and workspace code without modification

**Interfaces:**
- Consumes: running application/database from Task 3 and OpenReply email authentication.
- Produces: a verified authenticated user session with an accessible workspace, proving login/workspace plumbing before Instagram setup.

- [ ] **Step 1: Configure one real email delivery path locally**

Use the imported Resend path for the baseline. In `.env`, set locally:

```dotenv
RESEND_API_KEY=<your-local-resend-key>
EMAIL_FROM=<a-sender-address-accepted-by-your-Resend-account>
ALLOWED_EMAILS=<the-single-email-address-you-will-use-for-this-baseline>
```

Do not copy these real values into this document, source code, Git, ChatGPT, or Codex prompts.

Restart `npm run dev` after changing `.env`.

- [ ] **Step 2: Request a magic link through the UI**

Open:

```text
http://localhost:3000/login
```

Enter only the email address listed in local `ALLOWED_EMAILS` and request the magic link.

Expected: the UI accepts the request and the email provider delivers the message.

- [ ] **Step 3: Complete login using the received magic link**

Open the received magic link in the same browser profile used for the FlowChat/OpenReply test.

Expected: the authenticated dashboard loads and the user is not redirected back to `/login`.

- [ ] **Step 4: Verify user, workspace, and membership exist without printing session tokens**

```powershell
docker compose exec -T postgres psql -U postgres -d openreply -c 'SELECT COUNT(*) AS users FROM "User"; SELECT COUNT(*) AS workspaces FROM "Workspace"; SELECT COUNT(*) AS memberships FROM "WorkspaceMember";'
```

Expected: each count is at least `1`.

Do not query or print `Session.sessionToken` or `VerificationToken.token`.

- [ ] **Step 5: Record and commit the auth/workspace gate**

Mark only after the UI and database checks succeed:

```markdown
- [x] Magic-link login succeeds
- [x] Authenticated dashboard loads
- [x] Workspace is created/resolved for the signed-in user
```

Then:

```powershell
git add docs/validation/openreply-baseline.md
git diff --cached --check
git commit -m "test: validate OpenReply auth and workspace"
```

---

### Task 5: Validate the Existing Instagram OAuth and Webhook Connection Through a Public Tunnel

**Files:**
- Local only, never commit: `.env`
- Modify: `docs/validation/openreply-baseline.md`
- Exercise: `app/api/instagram/connect/route.ts`
- Exercise: `app/api/instagram/callback/route.ts`
- Exercise: `app/api/webhook/route.ts`
- Exercise: `lib/meta/oauth.ts`, `lib/meta/client.ts`, `lib/meta/webhook.ts`

**Interfaces:**
- Consumes: authenticated workspace from Task 4, existing Meta app credentials, running app/worker, Cloudflare Tunnel.
- Produces: a connected Instagram professional account and verified webhook path on the unmodified imported baseline.

- [ ] **Step 1: Start one HTTPS tunnel to the Next.js app**

In a separate PowerShell window:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Expected: Cloudflare prints one `https://...trycloudflare.com` URL. Keep this tunnel process running for the entire OAuth/webhook acceptance session.

Call that URL `<PUBLIC_BASE_URL>` in the remaining steps. Do not start a second quick tunnel during the same test because the hostname would change.

- [ ] **Step 2: Configure the baseline app to generate public callback URLs**

In local `.env`, set:

```dotenv
NEXTAUTH_URL=<PUBLIC_BASE_URL>
META_GRAPH_API_VERSION=v25.0
INSTAGRAM_APP_ID=<local Meta app id>
INSTAGRAM_APP_SECRET=<local Meta Instagram app secret>
FACEBOOK_APP_SECRET=<local Meta/Facebook signing secret used by the webhook>
WEBHOOK_VERIFY_TOKEN=<the local random token generated in Task 3>
```

Do not expose the real right-hand-side values outside local `.env`.

Restart both `npm run dev` and `npm run worker` after changing `.env`.

- [ ] **Step 3: Update the Meta app URLs to exactly match this tunnel session**

In the Meta app configuration, set the Instagram OAuth redirect URI to:

```text
<PUBLIC_BASE_URL>/api/instagram/callback
```

Set the webhook callback URL to:

```text
<PUBLIC_BASE_URL>/api/webhook
```

For webhook verification, enter the same local `WEBHOOK_VERIFY_TOKEN` value from `.env` directly in the Meta dashboard. Do not paste that token into chat or documentation.

Expected: Meta webhook verification succeeds.

- [ ] **Step 4: Verify the public login path before OAuth**

Open:

```text
<PUBLIC_BASE_URL>/login
```

Sign in through the magic-link flow using the allowed baseline email.

Expected: authenticated dashboard loads on the public tunnel origin. This is required because OAuth state/session and the callback use `NEXTAUTH_URL`.

- [ ] **Step 5: Connect Instagram through the existing settings UI**

From the authenticated public FlowChat/OpenReply UI, use the existing Instagram connect action. Complete Meta consent in the browser.

Expected sequence:

```text
/api/instagram/connect
→ Instagram authorization
→ <PUBLIC_BASE_URL>/api/instagram/callback
→ dashboard?connected=true
```

The callback must complete without exposing the OAuth `code` in screenshots or logs shared externally.

- [ ] **Step 6: Verify the account is stored and webhook subscription succeeded**

Run a count/status-only query that does not print encrypted tokens:

```powershell
docker compose exec -T postgres psql -U postgres -d openreply -c 'SELECT COUNT(*) AS connected_accounts, BOOL_AND("webhookSubscribed") AS all_subscribed FROM "InstagramAccount";'
```

Expected: `connected_accounts >= 1` and `all_subscribed = t` for the baseline account set.

If `webhookSubscribed` is false, stop before the real `QUERO` test and diagnose the subscription result while keeping the baseline architecture unchanged.

- [ ] **Step 7: Record and commit the Instagram connection gate**

Mark only after direct verification:

```markdown
- [x] Public HTTPS tunnel reaches the local app
- [x] Meta webhook verification succeeds at `/api/webhook`
- [x] Instagram OAuth returns through `/api/instagram/callback`
- [x] Connected Instagram account is stored
- [x] `webhookSubscribed` is true or subscription success is otherwise verified
```

Then:

```powershell
git add docs/validation/openreply-baseline.md
git diff --cached --check
git commit -m "test: validate OpenReply Instagram connection"
```

---

### Task 6: Run and Record the Real Canonical `QUERO` Acceptance Flow

**Files:**
- Modify: `docs/validation/openreply-baseline.md`
- Exercise: existing campaign UI, webhook route, BullMQ worker, Meta client, and postback handling without architectural changes

**Interfaces:**
- Consumes: connected/subscribed Instagram account from Task 5.
- Produces: the foundation checkpoint proving the imported OpenReply baseline performs the exact real Instagram interaction that the later Flow Engine must reproduce.

- [ ] **Step 1: Eliminate competing automation handlers for the test keyword**

Temporarily disable any other tool or automation that reacts to the same `QUERO` keyword on the same target Instagram content.

Expected: only the imported OpenReply baseline is responsible for the test interaction.

Do not disconnect the Instagram account from FlowChat/OpenReply.

- [ ] **Step 2: Create the canonical baseline campaign in the existing OpenReply UI**

Configure one active campaign with these semantics:

```text
Name: FlowChat Baseline QUERO
Trigger: Instagram comment
Keyword: QUERO
Public reply: enabled
Public reply text: Te mandei uma mensagem 💌 Dá uma olhadinha na sua DM.
Opening DM: enabled
Opening DM text:
Oi! 👋
Vi que você comentou QUERO.
Clique abaixo para continuar.
Opening DM button label: INICIAR AQUI
Reveal/next DM text: Funcionou ✅ O FlowChat recebeu seu clique e continuou a automação.
```

Use either one specific real post/reel or the imported campaign option that matches the intended target. Keep all unrelated campaign features disabled for this acceptance run, including follow-gating and delayed follow-up.

Expected: the campaign saves and remains active.

- [ ] **Step 3: Produce one real comment from a different Instagram user**

From a real Instagram account other than the connected professional account, comment exactly:

```text
QUERO
```

on the target post/reel.

Expected: the webhook reaches the local tunnel and the worker receives a comment job.

- [ ] **Step 4: Verify webhook persistence without dumping the raw payload**

```powershell
docker compose exec -T postgres psql -U postgres -d openreply -c 'SELECT status, COUNT(*) FROM "WebhookEvent" GROUP BY status ORDER BY status;'
```

Expected: at least one relevant event reaches `PROCESSED`; there is no new unexplained `FAILED` event for the acceptance interaction.

Do not select the `payload` column into shared terminal output.

- [ ] **Step 5: Verify the public reply and opening private reply in Instagram**

Observe on the real Instagram clients:

1. Public comment reply appears: `Te mandei uma mensagem 💌 Dá uma olhadinha na sua DM.`
2. The commenter receives the opening DM.
3. The opening DM contains a visible `INICIAR AQUI` button.

Do not continue if any of the three observations fails; capture only non-secret error evidence and diagnose the imported baseline first.

- [ ] **Step 6: Click `INICIAR AQUI` and verify the reveal DM**

Click the real `INICIAR AQUI` button from the commenter account.

Expected:

1. Meta delivers the postback to `/api/webhook`.
2. The worker processes the postback job.
3. The commenter receives exactly one reveal message:

```text
Funcionou ✅ O FlowChat recebeu seu clique e continuou a automação.
```

- [ ] **Step 7: Verify the matching delivery log reached `SENT`**

Run an aggregate query only:

```powershell
docker compose exec -T postgres psql -U postgres -d openreply -c 'SELECT status, COUNT(*) FROM "DmLog" GROUP BY status ORDER BY status;'
```

Expected: at least one `SENT` row corresponding to the acceptance test and no unexplained new permanent failure for that interaction.

Use the application diagnostics UI for correlation if needed; do not print access tokens or raw webhook payloads.

- [ ] **Step 8: Mark the complete real acceptance gate and security check**

In `docs/validation/openreply-baseline.md`, mark these items only after observation:

```markdown
- [x] Campaign configured for keyword `QUERO`
- [x] Real external account comments `QUERO`
- [x] Comment webhook is persisted and processed
- [x] Public reply is visible on Instagram
- [x] Opening private reply is received
- [x] Opening private reply contains `INICIAR AQUI`
- [x] Button tap produces a postback event
- [x] Reveal/second DM is received
- [x] Matching `DmLog` reaches `SENT`
- [x] No secrets, tokens, OAuth codes, webhook payload credentials, or `.env` values were committed to Git
```

- [ ] **Step 9: Run the automated gate once more after the real acceptance session**

```powershell
npm run typecheck
npm run lint
npm test
```

Expected: all three commands exit `0`.

This ensures no baseline diagnostic fix accidentally broke the imported suite. If no code was changed during diagnostics, it still confirms the checkpoint state.

- [ ] **Step 10: Commit the real baseline checkpoint**

```powershell
git add docs/validation/openreply-baseline.md
git diff --cached --check
git status --short
git commit -m "test: validate OpenReply Instagram baseline"
```

Expected: the validation document records a completely checked baseline gate and the commit contains no secret material.

- [ ] **Step 11: Push the foundation branch**

```powershell
git push -u origin feat/openreply-foundation
```

Expected: `origin/feat/openreply-foundation` exists and tracks the local branch.

- [ ] **Step 12: Stop at the architecture checkpoint**

Do not rebrand or begin Flow Core in this plan.

The next implementation plan starts only after this checkpoint exists:

```text
OpenReply imported
+ automated checks green
+ local runtime healthy
+ login/workspace verified
+ Instagram OAuth connected
+ webhook subscribed
+ real QUERO → public reply → opening DM button → postback → reveal DM verified
```

---

## Self-Review Results

### Spec coverage for this plan

This plan intentionally implements only Sections 2 and 3 of the approved design plus the baseline portions of the existing architecture needed to prove them. It covers repository migration, pinned provenance, license retention, local runtime, login/workspace, Instagram OAuth, webhook connectivity, worker operation, and the real canonical `QUERO` acceptance gate.

The following approved design areas are intentionally deferred into separate implementation plans after the baseline checkpoint, because they are independent subsystems and should not be mixed into foundation validation:

- FlowChat rebrand;
- normalized Channel Layer and Contact/Identity;
- Flow / FlowVersion / FlowRun / FlowRunEvent / WaitState / ExternalEffect;
- node registry and Flow Engine;
- visual builder;
- Story Reply and Follow Started triggers;
- Inbox, human handoff, and handoff email notifications;
- Tags and Custom Fields;
- Condition, Delay, and Wait Message;
- AI Agent and Knowledge Base;
- later SaaS/billing work.

### Placeholder scan

The plan contains no implementation placeholders. Angle-bracket values appear only where real credentials, private URLs, or locally chosen account data must never be embedded in a committed plan; every such value has an explicit source and handling rule.

### Type/interface consistency

This baseline plan does not introduce new application interfaces. All exercised route paths, script names, model/table names, environment variable names, and branch/commit identifiers match the pinned OpenReply baseline used to write the plan.
