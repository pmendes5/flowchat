# FlowChat backend guardrails

## Scope

- Implement only the TypeScript backend for the approved Sprint 1 scope.
- Do not add frontend, React, a visual Flow Engine, AI agents, OpenAI integration, billing, dashboards, or inbox/CRM features.
- Keep Meta/Instagram provider payloads and OAuth details inside `@flowchat/meta`; publish only stable internal contracts to other packages.

## Quality

- Follow TDD: write a failing test, run it, implement the minimum, then run the passing test.
- Before handing off work, run the relevant checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` when the affected workspaces exist.
- Keep TypeScript strict. Do not weaken compiler settings to make code compile.

## Security

- Never commit `.env` files, credentials, Meta tokens, app secrets, authorization codes, or production encryption keys.
- Never log credentials or sensitive fields. Sanitize provider payloads and errors before logging or persisting diagnostic data.
- Keep external Meta effects idempotent and avoid retries that can duplicate an ambiguous send.
