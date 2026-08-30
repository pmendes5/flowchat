# OpenReply Baseline Validation

Date: 2026-08-30
Upstream: `diwenne/openreply@cf9cc1ac03c918fbc84e806505b0fe9aa81acf01`
FlowChat branch: `feat/openreply-foundation`

## Automated gate

- [x] `npm ci`
- [x] `npm run db:generate`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run build`

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
