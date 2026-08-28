> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

# FlowChat Meta Core Backend Implementation Plan

**Goal:** construir o backend local da Sprint 1 que prove o fluxo real Instagram: comentário QUERO → resposta pública → Private Reply com botão regular INICIAR AQUI → clique/postback → segunda DM.

**Architecture:** monorepo TypeScript com NestJS API, Worker BullMQ, PostgreSQL/Prisma, Redis e packages isolando config, contratos e integração Meta. A API autentica, normaliza, persiste e enfileira rapidamente; o Worker executa efeitos externos idempotentes, persistidos individualmente, sem expor payloads Meta às camadas internas.

**Tech Stack:** Node.js, TypeScript, NestJS, PostgreSQL, Prisma, Redis, BullMQ, pnpm, Turborepo, Zod, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-27-meta-core-backend-design.md`

## Global Constraints

- Nenhum frontend.
- Nenhum Flow Engine.
- Nenhuma IA/OpenAI.
- Payload Meta não pode vazar para o restante da aplicação.
- Webhook deve validar, persistir, enfileirar e responder rapidamente.
- Jobs e efeitos externos precisam ser idempotentes.
- Tokens Meta criptografados em repouso.
- Nunca logar segredos/tokens.
- Graph API version configurável.
- Antes de implementar endpoints/payloads Meta reais, validar tudo contra a documentação Meta vigente.
- Primeiro botão é botão regular/postback, NÃO Quick Reply.
- `QUERO`, textos e `FLOW_CONTINUE` são configuração temporária isolada.
- PostgreSQL e Redis via Docker Compose.
- Desenvolvimento local com Cloudflare Tunnel posteriormente.
- TDD para comportamento implementável por testes.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` precisam passar.
- Executar as Tasks estritamente na ordem numérica; cada Task consome somente interfaces já produzidas.
- Cada Task fecha um ciclo red–green verificável e termina em um commit pequeno; não agrupar Tasks distintas no mesmo commit.
- Executar um checkbox por vez e confirmar seu resultado esperado antes de avançar ao próximo.
- Não criar entidades ou capacidades de frontend, React, editor visual, React Flow, Flow Engine, IA, OpenAI, billing, planos, assinatura, analytics avançado, dashboard, inbox/CRM completos, publicação, insights, anúncios, workspace ou multi-tenancy.

---

## Planned File Structure

```text
.
├── .env.example                         # nomes de ambiente e exemplos não secretos
├── AGENTS.md                            # comandos e limites para agentes implementadores
├── docker-compose.yml                   # PostgreSQL 16 e Redis 7 com healthchecks
├── package.json                         # scripts raiz e versões de runtime
├── pnpm-workspace.yaml                  # apps/* e packages/*
├── turbo.json                           # pipeline lint/typecheck/test/build
├── tsconfig.base.json                   # TypeScript estrito compartilhado
├── eslint.config.mjs                    # lint compartilhado
├── vitest.workspace.ts                  # projetos de teste do monorepo
├── apps/
│   ├── api/
│   │   ├── src/main.ts                  # bootstrap HTTP, raw body e porta 3001
│   │   ├── src/app.module.ts            # composição Nest da API
│   │   ├── src/health.controller.ts     # GET /health
│   │   ├── src/auth/*                   # state OAuth, redirect e callback
│   │   └── src/webhooks/*               # verification e ingestão Meta
│   └── worker/
│       ├── src/main.ts                  # bootstrap standalone e shutdown
│       ├── src/worker.module.ts          # composição do consumidor
│       ├── src/event.processor.ts        # dispatch por evento interno
│       ├── src/comment-handler.ts        # comportamento temporário QUERO
│       ├── src/postback-handler.ts       # comportamento FLOW_CONTINUE
│       ├── src/effect-executor.ts        # claim/execute/complete de efeito externo
│       └── src/persistence.service.ts    # contato, conversa e mensagens
├── packages/
│   ├── config/src/*                     # schema Zod e configuração tipada
│   ├── contracts/src/*                  # eventos internos e jobs Zod
│   ├── database/
│   │   ├── prisma/schema.prisma          # entidades, enums, constraints e índices
│   │   ├── prisma/migrations/*           # migration inicial reproduzível
│   │   └── src/*                         # PrismaClient e repositórios focados
│   ├── security/src/token-crypto.ts      # AES-256-GCM versionado
│   └── meta/src/*                        # OAuth, assinatura, normalização e Graph API
├── docs/
│   ├── META-INTEGRATION.md               # decisões confirmadas em fontes Meta vigentes
│   └── MANUAL-META-TEST.md               # checklist de validação com conta real
└── test/
    ├── integration/*                     # API, fila e Worker com Postgres/Redis
    └── helpers/*                         # fixtures e servidor HTTP Meta falso
```

As respostas externas são protegidas em duas camadas. `WebhookEvent.dedupKey` impede duas publicações do mesmo evento interno; `ExternalEffect` usa `@@unique([sourceEventId, kind])` para reservar separadamente `COMMENT_PUBLIC_REPLY`, `COMMENT_PRIVATE_REPLY` e `POSTBACK_SECOND_DM`. O executor grava `processing` antes da chamada e usa `providerRequestId` como chave de idempotência quando a operação Meta vigente aceitar esse recurso. Se uma chamada tiver resultado ambíguo (timeout após envio), o efeito fica `uncertain`, não é reenviado automaticamente e exige reconciliação operacional; isso prioriza não duplicar mensagens. Essa estratégia protege retry parcial sem depender somente da existência do webhook.

### Task 1: Bootstrap do monorepo e guardrails

**Files**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `vitest.workspace.ts`, `AGENTS.md`, `.env.example`, `test/bootstrap/repository-shape.test.ts`
- Modify: `.gitignore`
- Test: `test/bootstrap/repository-shape.test.ts`

**Interfaces**
- Consumes: nenhuma interface de aplicação.
- Produces: scripts raiz `lint`, `typecheck`, `test`, `build`, `dev:api`, `dev:worker`, `db:up`, `db:down`; aliases `@flowchat/config`, `@flowchat/contracts`, `@flowchat/database`, `@flowchat/security`, `@flowchat/meta`; variáveis `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_REDIRECT_URI`, `META_GRAPH_API_VERSION`, `DATABASE_URL`, `REDIS_URL`, `APP_ENCRYPTION_KEY`.

- [ ] Step 1: Escrever o teste estrutural que falha.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('repository bootstrap', () => {
  it('declares every workspace and required command', () => {
    expect(readFileSync('pnpm-workspace.yaml', 'utf8')).toContain("- 'apps/*'");
    const root = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys(root.scripts)).toEqual(expect.arrayContaining(['lint', 'typecheck', 'test', 'build']));
  });
});
```

- [ ] Step 2: Executar `pnpm exec vitest run test/bootstrap/repository-shape.test.ts`; esperar FAIL porque `package.json` e `pnpm-workspace.yaml` ainda não existem.
- [ ] Step 3: Criar os manifests mínimos, com `packageManager: "pnpm@10.15.0"`, `engines.node: ">=22.0.0"`, scripts chamando `turbo run`, TypeScript com `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, ESLint sem logging de campos sensíveis e `.env.example` com valores seguros como `META_GRAPH_API_VERSION=vXX.X` e chave base64 de exemplo claramente não produtiva. Em `AGENTS.md`, registrar TDD, comandos, proibição de frontend/Flow Engine/IA, isolamento Meta e proibição de logs de credenciais.

```json
{
  "private": true,
  "packageManager": "pnpm@10.15.0",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "build": "turbo run build",
    "dev:api": "pnpm --filter @flowchat/api dev",
    "dev:worker": "pnpm --filter @flowchat/worker dev",
    "db:up": "docker compose up -d postgres redis",
    "db:down": "docker compose down"
  }
}
```

- [ ] Step 4: Executar `pnpm exec vitest run test/bootstrap/repository-shape.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.mjs vitest.workspace.ts AGENTS.md .env.example .gitignore test/bootstrap/repository-shape.test.ts && git commit -m "chore: bootstrap TypeScript monorepo"`.

### Task 2: Ambiente local PostgreSQL e Redis

**Files**
- Create: `docker-compose.yml`, `test/bootstrap/docker-compose.test.ts`
- Modify: `package.json`, `README.md`
- Test: `test/bootstrap/docker-compose.test.ts`

**Interfaces**
- Consumes: scripts `db:up` e `db:down` da Task 1.
- Produces: serviços Compose `postgres:5432` e `redis:6379`; comandos `db:health` e `dev:infra`.

- [ ] Step 1: Escrever teste que exige serviços, volumes e healthchecks.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('local infrastructure', () => {
  it('defines healthy postgres and redis services', () => {
    const yaml = readFileSync('docker-compose.yml', 'utf8');
    expect(yaml).toMatch(/postgres:[\s\S]*pg_isready/);
    expect(yaml).toMatch(/redis:[\s\S]*redis-cli.*ping/);
    expect(yaml).toContain('flowchat_postgres_data');
  });
});
```

- [ ] Step 2: Executar `pnpm exec vitest run test/bootstrap/docker-compose.test.ts`; esperar FAIL por arquivo ausente.
- [ ] Step 3: Criar Compose sem publicar segredos, usando `${POSTGRES_USER:-flowchat}`, `${POSTGRES_PASSWORD:-flowchat_local}`, `${POSTGRES_DB:-flowchat}`, PostgreSQL 16, Redis 7, volumes nomeados, restart e healthchecks; adicionar `db:health` como `docker compose ps --format json` e documentar que API/Worker rodam fora do Compose.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-flowchat}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-flowchat_local}
      POSTGRES_DB: ${POSTGRES_DB:-flowchat}
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
volumes:
  flowchat_postgres_data:
```

- [ ] Step 4: Executar `pnpm exec vitest run test/bootstrap/docker-compose.test.ts && docker compose config --quiet`; esperar PASS e exit code 0.
- [ ] Step 5: Executar `git add docker-compose.yml package.json README.md test/bootstrap/docker-compose.test.ts && git commit -m "chore: add local postgres and redis"`.

### Task 3: Configuração tipada com Zod

**Files**
- Create: `packages/config/package.json`, `packages/config/tsconfig.json`, `packages/config/src/env.schema.ts`, `packages/config/src/config.ts`, `packages/config/src/index.ts`, `packages/config/src/config.test.ts`
- Modify: `vitest.workspace.ts`
- Test: `packages/config/src/config.test.ts`

**Interfaces**
- Consumes: variáveis definidas na Task 1.
- Produces: `type AppConfig = Readonly<{ meta: MetaConfig; databaseUrl: string; redisUrl: string; encryptionKey: Buffer; port: number }>`; `loadConfig(env: NodeJS.ProcessEnv): AppConfig`; `MetaConfig` com `appId`, `appSecret`, `webhookVerifyToken`, `redirectUri`, `graphApiVersion`.

- [ ] Step 1: Escrever testes de ambiente inválido e válido.

```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const valid = {
  META_APP_ID: 'app', META_APP_SECRET: 'secret', META_WEBHOOK_VERIFY_TOKEN: 'verify',
  META_REDIRECT_URI: 'https://example.test/auth/instagram/callback', META_GRAPH_API_VERSION: 'v99.0',
  DATABASE_URL: 'postgresql://flowchat:local@localhost:5432/flowchat', REDIS_URL: 'redis://localhost:6379',
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: '3001'
};

describe('loadConfig', () => {
  it('rejects a non-32-byte encryption key', () => expect(() => loadConfig({ ...valid, APP_ENCRYPTION_KEY: 'bad' })).toThrow());
  it('returns typed config', () => expect(loadConfig(valid).meta.graphApiVersion).toBe('v99.0'));
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/config test`; esperar FAIL porque `loadConfig` não existe.
- [ ] Step 3: Implementar schema fechado, URLs válidas, `PORT` inteiro default 3001, versão com regex `^v\d+\.\d+$` e chave base64 decodificada com exatamente 32 bytes.

```ts
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const value = envSchema.parse(env);
  const encryptionKey = Buffer.from(value.APP_ENCRYPTION_KEY, 'base64');
  if (encryptionKey.length !== 32) throw new Error('APP_ENCRYPTION_KEY must decode to 32 bytes');
  return Object.freeze({
    meta: Object.freeze({ appId: value.META_APP_ID, appSecret: value.META_APP_SECRET,
      webhookVerifyToken: value.META_WEBHOOK_VERIFY_TOKEN, redirectUri: value.META_REDIRECT_URI,
      graphApiVersion: value.META_GRAPH_API_VERSION }),
    databaseUrl: value.DATABASE_URL, redisUrl: value.REDIS_URL, encryptionKey, port: value.PORT
  });
}
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/config test`; esperar 2 testes PASS.
- [ ] Step 5: Executar `git add packages/config vitest.workspace.ts && git commit -m "feat: add validated application config"`.

### Task 4: Contratos internos e contratos de jobs

**Files**
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/events.ts`, `packages/contracts/src/jobs.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/contracts.test.ts`
- Modify: `vitest.workspace.ts`
- Test: `packages/contracts/src/contracts.test.ts`

**Interfaces**
- Consumes: nenhum payload externo; somente primitivos FlowChat.
- Produces: `InstagramCommentCreated`, `InstagramPostbackReceived`, `InstagramMessageReceived`, união `InstagramEvent`; `ProcessWebhookJob`; `parseInstagramEvent(input: unknown): InstagramEvent`; `parseProcessWebhookJob(input: unknown): ProcessWebhookJob`; constante `PROCESS_WEBHOOK_QUEUE = 'meta-events'`.

- [ ] Step 1: Escrever testes que aceitam os três eventos internos e rejeitam campos Meta desconhecidos.

```ts
import { describe, expect, it } from 'vitest';
import { parseInstagramEvent, parseProcessWebhookJob } from './index.js';

describe('internal contracts', () => {
  it('parses a comment job', () => {
    const event = { type: 'instagram.comment.created', eventId: 'evt-1', accountId: 'ig-1',
      occurredAt: '2026-08-28T12:00:00.000Z', commentId: 'c-1', mediaId: 'm-1', actorId: 'u-1', text: 'QUERO' };
    expect(parseProcessWebhookJob({ webhookEventId: 'db-1', event }).event).toEqual(event);
  });
  it('rejects external-only fields', () => expect(() => parseInstagramEvent({ type: 'instagram.message.received', entry: [] })).toThrow());
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/contracts test`; esperar FAIL por exports ausentes.
- [ ] Step 3: Criar schemas Zod `.strict()` discriminados por `type`. Definir postback com `senderId`, `recipientId`, `payload` e `messageId?`; mensagem com `senderId`, `recipientId`, `messageId`, `text?`; job com `webhookEventId` e `event`.

```ts
export const processWebhookJobSchema = z.object({
  webhookEventId: z.string().min(1),
  event: instagramEventSchema
}).strict();
export type ProcessWebhookJob = z.infer<typeof processWebhookJobSchema>;
export const parseProcessWebhookJob = (input: unknown): ProcessWebhookJob => processWebhookJobSchema.parse(input);
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/contracts test`; esperar PASS.
- [ ] Step 5: Executar `git add packages/contracts vitest.workspace.ts && git commit -m "feat: define internal instagram contracts"`.

### Task 5: Schema Prisma, client e migration inicial

**Files**
- Create: `packages/database/package.json`, `packages/database/tsconfig.json`, `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/202608280001_init/migration.sql`, `packages/database/prisma/migrations/migration_lock.toml`, `packages/database/src/client.ts`, `packages/database/src/index.ts`, `packages/database/src/schema.test.ts`
- Modify: `vitest.workspace.ts`
- Test: `packages/database/src/schema.test.ts`

**Interfaces**
- Consumes: `DATABASE_URL` de `AppConfig`.
- Produces: `prisma: PrismaClient`; models `InstagramAccount`, `WebhookEvent`, `Contact`, `Conversation`, `Message`, `ExternalEffect`; enums `AccountStatus`, `WebhookStatus`, `ConversationStatus`, `MessageDirection`, `MessageType`, `ExternalEffectKind`, `ExternalEffectStatus`.

- [ ] Step 1: Escrever teste do DMMF para constraints essenciais.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('database schema', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  it('deduplicates webhooks and effects independently', () => {
    expect(schema).toContain('dedupKey');
    expect(schema).toContain('@@unique([sourceEventId, kind])');
    expect(schema).toContain('UNCERTAIN');
  });
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/database test`; esperar FAIL por schema ausente.
- [ ] Step 3: Definir todos os campos conceituais da spec. Usar `WebhookEvent.dedupKey @unique`, `InstagramAccount.instagramUserId @unique`, `Contact @@unique([instagramAccountId, instagramScopedUserId])`, uma conversa por conta/contato, `Message.externalMessageId` opcional com índice único quando presente, `Message.structuredPayload Json?`, `rawPayload Json?`, e o efeito abaixo.

```prisma
model ExternalEffect {
  id                String               @id @default(cuid())
  sourceEventId     String
  kind              ExternalEffectKind
  status            ExternalEffectStatus @default(PENDING)
  providerRequestId String               @unique
  providerResultId  String?
  attempts          Int                  @default(0)
  lastErrorCode     String?
  createdAt         DateTime             @default(now())
  completedAt       DateTime?
  sourceEvent       WebhookEvent         @relation(fields: [sourceEventId], references: [id])
  @@unique([sourceEventId, kind])
}
enum ExternalEffectStatus { PENDING PROCESSING COMPLETED FAILED UNCERTAIN }
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/database prisma validate && pnpm --filter @flowchat/database test`; esperar ambos PASS.
- [ ] Step 5: Executar `git add packages/database vitest.workspace.ts && git commit -m "feat: add sprint one database schema"`.

### Task 6: Criptografia autenticada de tokens

**Files**
- Create: `packages/security/package.json`, `packages/security/tsconfig.json`, `packages/security/src/token-crypto.ts`, `packages/security/src/index.ts`, `packages/security/src/token-crypto.test.ts`
- Modify: `vitest.workspace.ts`
- Test: `packages/security/src/token-crypto.test.ts`

**Interfaces**
- Consumes: `AppConfig.encryptionKey: Buffer` com 32 bytes.
- Produces: `encryptToken(plaintext: string, key: Buffer): string`; `decryptToken(envelope: string, key: Buffer): string`; envelope `v1.<iv-base64url>.<ciphertext-base64url>.<tag-base64url>`.

- [ ] Step 1: Escrever testes round-trip, chave errada e ausência do plaintext no envelope.

```ts
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from './token-crypto.js';

describe('token crypto', () => {
  it('round trips with AES-256-GCM', () => { const key = Buffer.alloc(32, 1); expect(decryptToken(encryptToken('token-secret', key), key)).toBe('token-secret'); });
  it('rejects a different key', () => expect(() => decryptToken(encryptToken('token-secret', Buffer.alloc(32, 1)), Buffer.alloc(32, 2))).toThrow());
  it('does not expose plaintext', () => expect(encryptToken('token-secret', Buffer.alloc(32, 1))).not.toContain('token-secret'));
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/security test`; esperar FAIL por módulo ausente.
- [ ] Step 3: Implementar AES-256-GCM com `randomBytes(12)`, `createCipheriv`, tag de 16 bytes, prefixo de versão, validação de chave e mensagens de erro que nunca incluam token/envelope.

```ts
export function encryptToken(plaintext: string, key: Buffer): string {
  assertKey(key); const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/security test`; esperar 3 testes PASS.
- [ ] Step 5: Executar `git add packages/security vitest.workspace.ts && git commit -m "feat: encrypt meta access tokens"`.

### Task 7: Bootstrap da API e health check

**Files**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/health.controller.ts`, `apps/api/src/health.controller.test.ts`
- Modify: `vitest.workspace.ts`
- Test: `apps/api/src/health.controller.test.ts`

**Interfaces**
- Consumes: `loadConfig`, `prisma`, `REDIS_URL`.
- Produces: `createApiApp(config: AppConfig): Promise<INestApplication>`; HTTP `GET /health` → `{ status: 'ok', database: 'up', redis: 'up' }`; listener default `3001`.

- [ ] Step 1: Escrever teste HTTP com probes injetados.

```ts
it('returns health on port-independent test app', async () => {
  const app = await createApiApp(testConfig, { database: async () => true, redis: async () => true });
  await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok', database: 'up', redis: 'up' });
  await app.close();
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/api test -- health.controller.test.ts`; esperar FAIL porque `createApiApp` não existe.
- [ ] Step 3: Implementar controller e factory Nest; habilitar shutdown hooks; em produção chamar `listen(config.port)`; não imprimir objeto config nem segredos.

```ts
@Controller('health')
export class HealthController {
  constructor(@Inject(HEALTH_PROBES) private readonly probes: HealthProbes) {}
  @Get() async health() {
    const [database, redis] = await Promise.all([this.probes.database(), this.probes.redis()]);
    return { status: database && redis ? 'ok' : 'degraded', database: database ? 'up' : 'down', redis: redis ? 'up' : 'down' };
  }
}
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/api test -- health.controller.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add apps/api vitest.workspace.ts && git commit -m "feat: bootstrap api health endpoint"`.

### Task 8: Bootstrap do Worker e fila compartilhada

**Files**
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/main.ts`, `apps/worker/src/worker.module.ts`, `apps/worker/src/queue.ts`, `apps/worker/src/queue.test.ts`
- Modify: `packages/contracts/src/jobs.ts`
- Test: `apps/worker/src/queue.test.ts`

**Interfaces**
- Consumes: `PROCESS_WEBHOOK_QUEUE`, `ProcessWebhookJob`, `AppConfig.redisUrl`.
- Produces: `createEventQueue(connection: ConnectionOptions): Queue<ProcessWebhookJob>`; `createEventWorker(connection, handler): Worker<ProcessWebhookJob>`; `EventJobHandler = (job: Job<ProcessWebhookJob>) => Promise<void>`.

- [ ] Step 1: Escrever teste que comprova nome, attempts e backoff da fila por uma factory BullMQ mockada.

```ts
it('creates the shared queue with bounded exponential retry', () => {
  const QueueCtor = vi.fn(); createEventQueue({ host: 'localhost' }, QueueCtor as never);
  expect(QueueCtor).toHaveBeenCalledWith('meta-events', expect.objectContaining({
    defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 }
  }));
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/worker test -- queue.test.ts`; esperar FAIL por factory ausente.
- [ ] Step 3: Implementar Queue/Worker com JSON validado por `parseProcessWebhookJob`, concurrency configurada internamente em 5, graceful shutdown fechando Worker e Queue em `SIGTERM`/`SIGINT`.

```ts
export const createEventWorker = (connection: ConnectionOptions, handle: EventJobHandler) =>
  new Worker<ProcessWebhookJob>(PROCESS_WEBHOOK_QUEUE, async job => handle({ ...job, data: parseProcessWebhookJob(job.data) }), { connection, concurrency: 5 });
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/worker test -- queue.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add apps/worker packages/contracts/src/jobs.ts && git commit -m "feat: bootstrap bullmq worker"`.

### Task 9: Verificação técnica vigente da Meta

**Files**
- Create: `docs/META-INTEGRATION.md`, `test/docs/meta-integration.test.ts`
- Modify: nenhum.
- Test: `test/docs/meta-integration.test.ts`

**Interfaces**
- Consumes: escopo e permissões previstas na spec; data da execução desta tarefa.
- Produces: `MetaVerifiedContract` documental com URLs, método, campos, permissões, evento de webhook, assinatura, limites de Private Reply, botão regular/postback ou equivalente, versão testada e links oficiais; somente os dados confirmados podem alimentar Tasks 10–15.

- [ ] Step 1: Escrever teste documental que falha enquanto decisões e fontes oficiais não estiverem registradas.

```ts
it('records every required verified Meta decision', () => {
  const doc = readFileSync('docs/META-INTEGRATION.md', 'utf8');
  for (const heading of ['OAuth', 'Permissions', 'Comment webhook', 'Public replies', 'Private Replies', 'Regular button and postback', 'Webhook signature', 'Graph API versioning']) expect(doc).toContain(`## ${heading}`);
  expect(doc).toMatch(/https:\/\/developers\.facebook\.com\//);
  expect(doc).toContain('Verified on:');
});
```

- [ ] Step 2: Executar `pnpm exec vitest run test/docs/meta-integration.test.ts`; esperar FAIL por documento ausente.
- [ ] Step 3: Consultar exclusivamente a documentação oficial Meta vigente e registrar, para Instagram Login/OAuth, permissões, comment webhook, reply pública, Private Reply, formato de botão regular, evento `messaging_postbacks` ou equivalente confirmado, `X-Hub-Signature-256` ou mecanismo vigente e versionamento: URL oficial, data, método, path, request/response mínimo e restrições. Se a documentação não confirmar botão/postback compatível, registrar a incompatibilidade como bloqueio factual e interromper Tasks 10–21 sem inventar endpoint ou campo.
- [ ] Step 4: Executar `pnpm exec vitest run test/docs/meta-integration.test.ts`; esperar PASS, e revisar manualmente que cada endpoint/campo do documento possui link oficial diretamente adjacente.
- [ ] Step 5: Executar `git add docs/META-INTEGRATION.md test/docs/meta-integration.test.ts && git commit -m "docs: verify current meta integration contracts"`.

### Task 10: Erros e cliente HTTP Meta

**Files**
- Create: `packages/meta/package.json`, `packages/meta/tsconfig.json`, `packages/meta/src/errors.ts`, `packages/meta/src/http-client.ts`, `packages/meta/src/index.ts`, `packages/meta/src/http-client.test.ts`
- Modify: `vitest.workspace.ts`
- Test: `packages/meta/src/http-client.test.ts`

**Interfaces**
- Consumes: endpoints e versão confirmados em `docs/META-INTEGRATION.md`; `MetaConfig`.
- Produces: `MetaErrorKind = 'transient' | 'invalid_request' | 'auth' | 'ambiguous'`; `MetaApiError`; `MetaHttpClient.request<T>(request: MetaRequest): Promise<T>`; `MetaRequest = { method; path; accessToken?; body?; timeoutMs?; providerRequestId? }`.

- [ ] Step 1: Escrever testes de URL versionada, token em header, sanitização e classificação.

```ts
it.each([[500, 'transient'], [400, 'invalid_request'], [401, 'auth'], [403, 'auth']])('classifies %i', async (status, kind) => {
  fetchMock.mockResolvedValue(response(status, { error: { code: 1, message: 'safe' } }));
  await expect(client.request({ method: 'POST', path: '/confirmed-path', accessToken: 'secret' })).rejects.toMatchObject({ kind });
  expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('access_token=secret');
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/meta test -- http-client.test.ts`; esperar FAIL por cliente ausente.
- [ ] Step 3: Implementar `fetch` com `AbortSignal.timeout`, base `https://graph.facebook.com/${graphApiVersion}`, Authorization header, parser de erro sem token/body sensível; timeout ou falha de rede após despacho gera `ambiguous`, 5xx `transient`, 400 `invalid_request`, 401/403 `auth`.

```ts
export class MetaApiError extends Error {
  constructor(public readonly kind: MetaErrorKind, public readonly status: number | undefined, public readonly code: string | undefined) { super(`Meta request failed: ${kind}`); }
  get retryable(): boolean { return this.kind === 'transient'; }
}
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/meta test -- http-client.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add packages/meta vitest.workspace.ts && git commit -m "feat: add sanitized meta http client"`.

### Task 11: OAuth Meta e lookup de conta

**Files**
- Create: `packages/meta/src/oauth.ts`, `packages/meta/src/accounts.ts`, `packages/meta/src/oauth.test.ts`
- Modify: `packages/meta/src/index.ts`
- Test: `packages/meta/src/oauth.test.ts`

**Interfaces**
- Consumes: `MetaHttpClient`, `MetaConfig`, contratos verificados na Task 9.
- Produces: `buildInstagramAuthorizationUrl(config: MetaConfig, state: string): URL`; `exchangeAuthorizationCode(code: string): Promise<{ accessToken: string; expiresAt: Date | null }>`; `lookupProfessionalAccount(accessToken: string): Promise<{ instagramUserId: string; username: string }>`.

- [ ] Step 1: Escrever teste com os parâmetros e permissões exatamente confirmados, importados de constantes locais.

```ts
it('builds an authorization URL with state and approved scopes', () => {
  const url = buildInstagramAuthorizationUrl(config, 'state-123');
  expect(url.searchParams.get('state')).toBe('state-123');
  expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
  expect(url.searchParams.get('scope')?.split(',')).toEqual(APPROVED_SCOPES);
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/meta test -- oauth.test.ts`; esperar FAIL por funções ausentes.
- [ ] Step 3: Implementar URL, troca e lookup usando apenas paths/campos copiados do registro verificado; authorization code e access token nunca aparecem em erro ou logger.

```ts
export async function exchangeAuthorizationCode(code: string): Promise<OAuthToken> {
  const result = await client.request<VerifiedTokenResponse>({ method: 'POST', path: VERIFIED_TOKEN_PATH, body: verifiedTokenBody(code, config) });
  return { accessToken: result.access_token, expiresAt: result.expires_in ? new Date(clock.now() + result.expires_in * 1000) : null };
}
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/meta test -- oauth.test.ts`; esperar PASS e confirmar em assertion que mensagens de erro não contêm code/token.
- [ ] Step 5: Executar `git add packages/meta/src/oauth.ts packages/meta/src/accounts.ts packages/meta/src/oauth.test.ts packages/meta/src/index.ts && git commit -m "feat: encapsulate instagram oauth"`.

### Task 12: Assinatura e normalização de webhooks Meta

**Files**
- Create: `packages/meta/src/webhook-signature.ts`, `packages/meta/src/webhook-normalizer.ts`, `packages/meta/src/webhook-signature.test.ts`, `packages/meta/src/webhook-normalizer.test.ts`, `packages/meta/src/fixtures/comment.json`, `packages/meta/src/fixtures/postback.json`, `packages/meta/src/fixtures/message.json`
- Modify: `packages/meta/src/index.ts`
- Test: `packages/meta/src/webhook-signature.test.ts`, `packages/meta/src/webhook-normalizer.test.ts`

**Interfaces**
- Consumes: `InstagramEvent`, assinatura/campos confirmados na Task 9.
- Produces: `verifyMetaWebhookSignature(rawBody: Buffer, signature: string | undefined, appSecret: string): boolean`; `normalizeMetaWebhook(input: unknown): NormalizedWebhookItem[]`; `NormalizedWebhookItem = { dedupKey: string; externalEventId: string | null; event: InstagramEvent; rawPayload: JsonValue }`.

- [ ] Step 1: Escrever testes com fixture sanitizada realista e assinatura HMAC conhecida.

```ts
it('normalizes a verified postback without leaking Meta fields', () => {
  const [item] = normalizeMetaWebhook(postbackFixture);
  expect(item.event).toEqual({ type: 'instagram.postback.received', eventId: expect.any(String), accountId: 'ig-1', occurredAt: expect.any(String), senderId: 'u-1', recipientId: 'ig-1', payload: 'FLOW_CONTINUE', messageId: 'mid-1' });
  expect(item.event).not.toHaveProperty('entry');
});
it('uses timing-safe HMAC verification', () => expect(verifyMetaWebhookSignature(body, knownSignature, 'app-secret')).toBe(true));
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/meta test -- webhook`; esperar FAIL por módulos ausentes.
- [ ] Step 3: Implementar HMAC sobre bytes crus com `createHmac` e `timingSafeEqual`; schemas externos privados ao package; dedup preferindo ID externo confirmado e, sem ele, SHA-256 de campos estáveis canônicos. Rejeitar itens malformados individualmente com erro sanitizado e nunca exportar tipos Meta.

```ts
export function deterministicDedupKey(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/meta test -- webhook`; esperar todos PASS.
- [ ] Step 5: Executar `git add packages/meta/src && git commit -m "feat: verify and normalize meta webhooks"`.

### Task 13: Operações de saída Meta isoladas

**Files**
- Create: `packages/meta/src/comment-replies.ts`, `packages/meta/src/private-replies.ts`, `packages/meta/src/messages.ts`, `packages/meta/src/outbound.test.ts`
- Modify: `packages/meta/src/index.ts`
- Test: `packages/meta/src/outbound.test.ts`

**Interfaces**
- Consumes: `MetaHttpClient`; endpoints/payloads confirmados na Task 9.
- Produces: `replyToComment(input: { accessToken; commentId; text; providerRequestId }): Promise<{ externalMessageId: string | null }>`; `sendPrivateReply(input: { accessToken; commentId; text; button: { title; payload }; providerRequestId }): Promise<{ externalMessageId: string | null }>`; `sendDirectMessage(input: { accessToken; recipientId; text; providerRequestId }): Promise<{ externalMessageId: string | null }>`.

- [ ] Step 1: Escrever testes que exigem o botão regular e rejeitam modelagem Quick Reply.

```ts
it('sends the confirmed regular postback button shape', async () => {
  await sendPrivateReply({ accessToken: 'token', commentId: 'c1', text: 'body', button: { title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' }, providerRequestId: 'fx-1' });
  expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({ body: VERIFIED_REGULAR_BUTTON_BODY }));
  expect(JSON.stringify(requestSpy.mock.calls)).not.toMatch(/quick_repl(y|ies)/i);
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/meta test -- outbound.test.ts`; esperar FAIL por operações ausentes.
- [ ] Step 3: Implementar cada operação em arquivo próprio, validando entrada com Zod, delegando HTTP ao cliente e traduzindo somente a resposta confirmada para `externalMessageId`. Usar `providerRequestId` no mecanismo idempotente oficial se confirmado; caso não exista, mantê-lo apenas como identificador local e preservar a política `UNCERTAIN` da Task 18.

```ts
export const sendPrivateReply = async (input: SendPrivateReplyInput): Promise<SendResult> => {
  const safe = sendPrivateReplySchema.parse(input);
  return parseSendResult(await client.request({ method: VERIFIED_PRIVATE_REPLY_METHOD, path: privateReplyPath(safe.commentId), accessToken: safe.accessToken, body: regularButtonBody(safe) }));
};
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/meta test -- outbound.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add packages/meta/src && git commit -m "feat: add focused meta outbound operations"`.

### Task 14: Endpoints OAuth da API

**Files**
- Create: `apps/api/src/auth/oauth-state.service.ts`, `apps/api/src/auth/instagram-auth.controller.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/instagram-auth.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/auth/instagram-auth.controller.test.ts`

**Interfaces**
- Consumes: `buildInstagramAuthorizationUrl`, `exchangeAuthorizationCode`, `lookupProfessionalAccount`, `encryptToken`, `prisma.instagramAccount`.
- Produces: `OAuthStateService.issue(): { state: string; cookie: string }`; `OAuthStateService.verify(state: string, cookie: string | undefined): boolean`; `GET /auth/instagram`; `GET /auth/instagram/callback?code&state`.

- [ ] Step 1: Escrever testes de redirect, state inválido e persistência criptografada.

```ts
it('rejects callback with mismatched state before token exchange', async () => {
  await request(app.getHttpServer()).get('/auth/instagram/callback?code=secret-code&state=wrong').set('Cookie', validCookie).expect(400);
  expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
});
it('upserts encrypted token and never returns it', async () => {
  const response = await request(app.getHttpServer()).get(validCallback).set('Cookie', validCookie).expect(200);
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ accessTokenEncrypted: 'ciphertext' }) }));
  expect(JSON.stringify(response.body)).not.toContain('access-token');
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/api test -- instagram-auth.controller.test.ts`; esperar FAIL por módulo ausente.
- [ ] Step 3: Implementar state aleatório de 32 bytes em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, expiração 10 minutos e assinatura HMAC; validar e apagar cookie no callback; trocar code, consultar conta, criptografar token e fazer upsert por `instagramUserId`; retornar somente `{ connected: true, instagramUserId, username }`.

```ts
await prisma.instagramAccount.upsert({
  where: { instagramUserId: account.instagramUserId },
  create: { ...account, accessTokenEncrypted, tokenExpiresAt, status: 'ACTIVE' },
  update: { username: account.username, accessTokenEncrypted, tokenExpiresAt, status: 'ACTIVE' }
});
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/api test -- instagram-auth.controller.test.ts`; esperar PASS e nenhuma captura de logger conter code/token.
- [ ] Step 5: Executar `git add apps/api/src/auth apps/api/src/app.module.ts && git commit -m "feat: add secure instagram oauth endpoints"`.

### Task 15: Verificação GET do webhook

**Files**
- Create: `apps/api/src/webhooks/meta-webhook.controller.ts`, `apps/api/src/webhooks/webhooks.module.ts`, `apps/api/src/webhooks/meta-webhook-verification.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/webhooks/meta-webhook-verification.test.ts`

**Interfaces**
- Consumes: `AppConfig.meta.webhookVerifyToken`; query names confirmados na Task 9.
- Produces: `GET /webhooks/meta` que retorna challenge como texto somente quando mode e verify token são válidos.

- [ ] Step 1: Escrever testes de sucesso e falha sem expor o token.

```ts
it('returns the challenge for a valid verification request', () => request(app.getHttpServer()).get('/webhooks/meta').query(validQuery).expect(200, 'challenge-1'));
it('rejects a wrong token', () => request(app.getHttpServer()).get('/webhooks/meta').query({ ...validQuery, 'hub.verify_token': 'wrong' }).expect(403));
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/api test -- meta-webhook-verification.test.ts`; esperar FAIL por rota ausente.
- [ ] Step 3: Implementar comparação constante do verify token, validação estrita de mode/challenge e resposta 403 genérica.

```ts
if (mode !== VERIFIED_SUBSCRIBE_MODE || !safeEqual(token, config.meta.webhookVerifyToken)) throw new ForbiddenException('Webhook verification failed');
return new StreamableFile(Buffer.from(challenge), { type: 'text/plain' });
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/api test -- meta-webhook-verification.test.ts`; esperar 2 testes PASS.
- [ ] Step 5: Executar `git add apps/api/src/webhooks apps/api/src/app.module.ts && git commit -m "feat: verify meta webhook challenge"`.

### Task 16: Ingestão POST, persistência e enqueue deduplicado

**Files**
- Create: `apps/api/src/webhooks/webhook-ingestion.service.ts`, `apps/api/src/webhooks/meta-webhook-ingestion.test.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/webhooks/meta-webhook.controller.ts`, `apps/api/src/webhooks/webhooks.module.ts`
- Test: `apps/api/src/webhooks/meta-webhook-ingestion.test.ts`

**Interfaces**
- Consumes: `verifyMetaWebhookSignature`, `normalizeMetaWebhook`, `prisma.webhookEvent`, `Queue<ProcessWebhookJob>`.
- Produces: `POST /webhooks/meta` → HTTP 200 `{ accepted: number }`; `WebhookIngestionService.ingest(rawBody: Buffer, signature: string | undefined): Promise<{ accepted: number }>`; job ID `webhook:<dedupKey>`.

- [ ] Step 1: Escrever testes de assinatura, persistência, velocidade lógica e duplicação.

```ts
it('persists and enqueues one job for duplicate delivery', async () => {
  await postSignedWebhook(app, commentFixture).expect(200);
  await postSignedWebhook(app, commentFixture).expect(200);
  expect(webhookEventCreate).toHaveBeenCalledTimes(1);
  expect(queueAdd).toHaveBeenCalledTimes(1);
  expect(queueAdd).toHaveBeenCalledWith('process-webhook', expect.any(Object), expect.objectContaining({ jobId: expect.stringMatching(/^webhook:/) }));
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/api test -- meta-webhook-ingestion.test.ts`; esperar FAIL por POST ausente.
- [ ] Step 3: Habilitar raw body no adapter Nest; verificar assinatura antes do JSON; para cada item normalizado executar transação curta com insert `WebhookEvent(PENDING)` e enqueue após commit. Tratar unique violation como entrega aceita já vista; se enqueue falhar, deixar `PENDING` observável e responder 503 para permitir reentrega, sem executar negócio sincronicamente.

```ts
const created = await repository.createIfAbsent({ dedupKey: item.dedupKey, externalEventId: item.externalEventId, eventType: item.event.type, payload: item.rawPayload });
if (created) await queue.add('process-webhook', { webhookEventId: created.id, event: item.event }, { jobId: `webhook:${item.dedupKey}` });
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/api test -- meta-webhook-ingestion.test.ts`; esperar PASS, incluindo resposta antes de qualquer chamada Meta de saída.
- [ ] Step 5: Executar `git add apps/api/src && git commit -m "feat: ingest meta webhooks asynchronously"`.

### Task 17: Persistência de contatos, conversas e mensagens

**Files**
- Create: `apps/worker/src/persistence.service.ts`, `apps/worker/src/persistence.service.test.ts`
- Modify: `apps/worker/src/worker.module.ts`
- Test: `apps/worker/src/persistence.service.test.ts`

**Interfaces**
- Consumes: `InstagramEvent`, models Prisma da Task 5.
- Produces: `recordInbound(event: InstagramEvent, sourceWebhookEventId: string): Promise<{ contactId: string; conversationId: string }>`; `recordOutbound(input: { conversationId; externalMessageId; type; text; structuredPayload?; rawPayload? }): Promise<void>`. O serviço copia de forma opaca `WebhookEvent.payload` para `Message.rawPayload` pelo ID de origem, sem expor formatos Meta aos handlers.

- [ ] Step 1: Escrever teste de upsert e payload estruturado de postback.

```ts
it('upserts contact/conversation and stores postback payload', async () => {
  const ids = await service.recordInbound(postbackEvent, 'webhook-db');
  expect(contactUpsert).toHaveBeenCalledWith(expect.objectContaining({ where: { instagramAccountId_instagramScopedUserId: { instagramAccountId: 'account-db', instagramScopedUserId: 'u-1' } } }));
  expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direction: 'INBOUND', type: 'POSTBACK', structuredPayload: { payload: 'FLOW_CONTINUE' }, rawPayload: sanitizedStoredWebhookPayload }) }));
  expect(ids.conversationId).toBe('conversation-db');
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/worker test -- persistence.service.test.ts`; esperar FAIL por serviço ausente.
- [ ] Step 3: Resolver `InstagramAccount` por `event.accountId`, fazer upserts transacionais de Contact/Conversation, atualizar `lastMessageAt` e persistir comment/message/postback inbound e outbound. Os handlers passam apenas o evento normalizado e `sourceWebhookEventId`; dentro da transação, o serviço lê `WebhookEvent.payload` e o copia como JSON opaco para `Message.rawPayload`, sem interpretar nem exportar tipos Meta. Para outbound, persistir em `rawPayload` somente a resposta sanitizada do provider, nunca access token, app secret ou request body sensível.

```ts
await tx.message.create({ data: { conversationId: conversation.id, externalMessageId: event.messageId ?? null,
  direction: 'INBOUND', type: event.type === 'instagram.postback.received' ? 'POSTBACK' : 'TEXT',
  text: 'text' in event ? event.text ?? null : null,
  structuredPayload: event.type === 'instagram.postback.received' ? { payload: event.payload } : undefined,
  rawPayload: sourceWebhookEvent.payload } });
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/worker test -- persistence.service.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add apps/worker/src/persistence.service.ts apps/worker/src/persistence.service.test.ts apps/worker/src/worker.module.ts && git commit -m "feat: persist instagram conversations and messages"`.

### Task 18: Executor idempotente de efeitos e classificação de retry

**Files**
- Create: `packages/database/src/effects.repository.ts`, `packages/database/src/effects.repository.test.ts`, `apps/worker/src/effect-executor.ts`, `apps/worker/src/effect-executor.test.ts`, `apps/worker/src/retry-policy.ts`, `apps/worker/src/retry-policy.test.ts`
- Modify: `packages/database/src/index.ts`, `apps/worker/src/worker.module.ts`
- Test: `packages/database/src/effects.repository.test.ts`, `apps/worker/src/effect-executor.test.ts`, `apps/worker/src/retry-policy.test.ts`

**Interfaces**
- Consumes: `ExternalEffect`, `MetaApiError`, Prisma transactions.
- Produces: `EffectsRepository.claim(sourceEventId: string, kind: ExternalEffectKind): Promise<EffectClaim>`; `complete(id: string, providerResultId: string | null): Promise<void>`; `fail(id: string, errorCode: string): Promise<void>`; `markUncertain(id: string, errorCode: string): Promise<void>`; `EffectExecutor.run<T>(input: { sourceEventId: string; kind: ExternalEffectKind; reconcile?: () => Promise<'completed' | 'not_sent' | 'unknown'> }, operation: () => Promise<T>): Promise<T | { skipped: true }>`; `classifyJobError(error): 'retry' | 'discard'`. Um efeito `UNCERTAIN` somente volta a chamar a Meta quando `reconcile()` retorna `not_sent` ou quando a mesma `providerRequestId` possui semântica idempotente oficialmente confirmada.

- [ ] Step 1: Escrever testes concorrentes e de falha ambígua.

```ts
it('executes a completed effect only once', async () => {
  repository.claim.mockResolvedValueOnce({ state: 'claimed', effect }).mockResolvedValueOnce({ state: 'completed', effect });
  await executor.run(input, operation); await executor.run(input, operation);
  expect(operation).toHaveBeenCalledTimes(1);
});
it('does not automatically retry an ambiguous send', async () => {
  operation.mockRejectedValue(new MetaApiError('ambiguous', undefined, 'TIMEOUT'));
  await expect(executor.run(input, operation)).rejects.toThrow();
  expect(repository.markUncertain).toHaveBeenCalledWith(effect.id, 'TIMEOUT');
});
it('retries a timeout through BullMQ without blindly repeating the effect', () => {
  expect(classifyJobError(new MetaApiError('ambiguous', undefined, 'TIMEOUT'))).toBe('retry');
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/database test -- effects.repository.test.ts && pnpm --filter @flowchat/worker test -- effect-executor.test.ts retry-policy.test.ts`; esperar FAIL.
- [ ] Step 3: Implementar claim atômico: insert pela unique key; `COMPLETED` retorna skip; `PROCESSING` recente retorna busy; `PROCESSING` expirado só pode retomar a chamada quando o mecanismo oficial confirmado aceitar a mesma chave idempotente. Gerar `providerRequestId = sha256(sourceEventId + ':' + kind)`. Meta 5xx e timeout são retryable e voltam pelo backoff exponencial do BullMQ; antes de repetir um timeout pós-despacho, marcar `UNCERTAIN` e reconciliar o resultado ou reutilizar a chave idempotente confirmada, nunca realizar reenvio cego. Meta 400 inválido e 401/403 ficam `FAILED` e lançam `UnrecoverableError`, sem loop. Se a API vigente não oferecer idempotência nem reconciliação para um efeito ambíguo, manter `UNCERTAIN`, encerrar o retry desse efeito com falha operacional observável e não arriscar duplicá-lo.

```ts
export function toBullMqError(error: unknown): Error {
  if (error instanceof MetaApiError && (error.kind === 'transient' || error.kind === 'ambiguous')) return error;
  return new UnrecoverableError(error instanceof MetaApiError ? `Meta ${error.kind}` : 'Permanent worker failure');
}
```

- [ ] Step 4: Reexecutar os três comandos da Step 2; esperar PASS, incluindo uma única operação sob duas claims concorrentes.
- [ ] Step 5: Executar `git add packages/database/src apps/worker/src && git commit -m "feat: make external effects retry safe"`.

### Task 19: Handler temporário de comentário `QUERO`

**Files**
- Create: `apps/worker/src/sprint-one-config.ts`, `apps/worker/src/comment-handler.ts`, `apps/worker/src/comment-handler.test.ts`
- Modify: `apps/worker/src/worker.module.ts`
- Test: `apps/worker/src/comment-handler.test.ts`

**Interfaces**
- Consumes: `InstagramCommentCreated`, `EffectExecutor`, `replyToComment`, `sendPrivateReply`, `recordInbound`, `recordOutbound`, decriptação do token da conta.
- Produces: `SPRINT_ONE_BEHAVIOR`; `containsKeyword(text: string): boolean`; `CommentHandler.handle(event, webhookEventId): Promise<void>`.

- [ ] Step 1: Escrever testes de matching e efeitos independentes.

```ts
it.each(['QUERO', 'eu quero agora', 'QuErO!'])('matches %s case-insensitively', text => expect(containsKeyword(text)).toBe(true));
it('uses two independently keyed effects and the regular button', async () => {
  await handler.handle({ ...commentEvent, text: 'Eu quero' }, 'webhook-db');
  expect(effectRun).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'COMMENT_PUBLIC_REPLY' }), expect.any(Function));
  expect(effectRun).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'COMMENT_PRIVATE_REPLY' }), expect.any(Function));
  expect(sendPrivateReply).toHaveBeenCalledWith(expect.objectContaining({ button: { title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' } }));
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/worker test -- comment-handler.test.ts`; esperar FAIL por handler ausente.
- [ ] Step 3: Isolar constantes e usar substring Unicode case-insensitive via `text.normalize('NFKC').toLocaleUpperCase('pt-BR').includes('QUERO')`. Persistir inbound antes dos efeitos; executar resposta pública e Private Reply por effects distintos; registrar cada outbound após completar o respectivo efeito.

```ts
export const SPRINT_ONE_BEHAVIOR = Object.freeze({
  keyword: 'QUERO', publicReply: 'Te mandei uma mensagem  Dá uma olhadinha na sua DM.',
  privateReply: 'Oi!\nVi que você comentou QUERO.\nClique abaixo para continuar.',
  button: { title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' },
  continuation: 'Funcionou ✅ O FlowChat recebeu seu clique e continuou a automação.'
});
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/worker test -- comment-handler.test.ts`; esperar PASS e confirmar que texto sem `QUERO` produz zero efeitos.
- [ ] Step 5: Executar `git add apps/worker/src/sprint-one-config.ts apps/worker/src/comment-handler.ts apps/worker/src/comment-handler.test.ts apps/worker/src/worker.module.ts && git commit -m "feat: handle sprint one instagram comments"`.

### Task 20: Handler de postback e dispatch do Worker

**Files**
- Create: `apps/worker/src/postback-handler.ts`, `apps/worker/src/postback-handler.test.ts`, `apps/worker/src/event.processor.ts`, `apps/worker/src/event.processor.test.ts`
- Modify: `apps/worker/src/main.ts`, `apps/worker/src/worker.module.ts`
- Test: `apps/worker/src/postback-handler.test.ts`, `apps/worker/src/event.processor.test.ts`

**Interfaces**
- Consumes: `InstagramPostbackReceived`, `InstagramMessageReceived`, `CommentHandler`, `EffectExecutor`, `sendDirectMessage`, `PersistenceService`.
- Produces: `PostbackHandler.handle(event, webhookEventId): Promise<'continued' | 'ignored'>`; `EventProcessor.handle(job: Job<ProcessWebhookJob>): Promise<void>`; transições `WebhookEvent` pending → processing → completed/failed.

- [ ] Step 1: Escrever testes de payload permitido, desconhecido e segunda DM única.

```ts
it('sends the continuation once for FLOW_CONTINUE', async () => {
  expect(await handler.handle({ ...postbackEvent, payload: 'FLOW_CONTINUE' }, 'webhook-db')).toBe('continued');
  expect(effectRun).toHaveBeenCalledWith(expect.objectContaining({ kind: 'POSTBACK_SECOND_DM' }), expect.any(Function));
  expect(sendDirectMessage).toHaveBeenCalledWith(expect.objectContaining({ text: SPRINT_ONE_BEHAVIOR.continuation }));
});
it('safely ignores an unknown payload', async () => {
  expect(await handler.handle({ ...postbackEvent, payload: 'UNKNOWN' }, 'webhook-db')).toBe('ignored');
  expect(sendDirectMessage).not.toHaveBeenCalled();
});
```

- [ ] Step 2: Executar `pnpm --filter @flowchat/worker test -- postback-handler.test.ts event.processor.test.ts`; esperar FAIL.
- [ ] Step 3: Persistir cada postback inbound com `recordInbound(event, webhookEventId)`; comparar payload por igualdade exata; logar somente event ID e resultado `ignored`; dispatch explícito dos três tipos internos, tratando mensagem recebida apenas como persistência nesta Sprint; atualizar status e erro sanitizado; conectar `createEventWorker` ao processor.

```ts
switch (job.data.event.type) {
  case 'instagram.comment.created': return commentHandler.handle(job.data.event, job.data.webhookEventId);
  case 'instagram.postback.received': return postbackHandler.handle(job.data.event, job.data.webhookEventId).then(() => undefined);
  case 'instagram.message.received': return persistence.recordInbound(job.data.event, job.data.webhookEventId).then(() => undefined);
}
```

- [ ] Step 4: Executar `pnpm --filter @flowchat/worker test -- postback-handler.test.ts event.processor.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add apps/worker/src && git commit -m "feat: process instagram postbacks and events"`.

### Task 21: Testes end-to-end de idempotência e integração API/Worker

**Files**
- Create: `test/helpers/meta-server.ts`, `test/helpers/infrastructure.ts`, `test/integration/health.integration.test.ts`, `test/integration/webhook-worker.integration.test.ts`, `test/integration/idempotency.integration.test.ts`
- Modify: `vitest.workspace.ts`, `package.json`
- Test: `test/integration/health.integration.test.ts`, `test/integration/webhook-worker.integration.test.ts`, `test/integration/idempotency.integration.test.ts`

**Interfaces**
- Consumes: API, PostgreSQL, Redis, Queue, Worker, cliente Meta e todos os handlers.
- Produces: suíte `test:integration`; fixtures HTTP Meta locais; prova automatizada sem conta Meta real.

- [ ] Step 1: Escrever cenários completos inicialmente falhos.

```ts
it.each([
  ['duplicate comment delivery', deliverSameCommentTwice, { publicReplies: 1, privateReplies: 1 }],
  ['replayed comment job', replayCommentJob, { publicReplies: 1, privateReplies: 1 }],
  ['duplicate postback delivery', deliverSamePostbackTwice, { secondDms: 1 }],
  ['failure after public reply', failPrivateReplyOnceThenRetry, { publicReplies: 1, privateReplies: 1 }]
])('%s keeps external effects singular', async (_name, arrange, expected) => {
  await arrange(harness); await harness.drain(); expect(harness.meta.counts()).toMatchObject(expected);
});
```

- [ ] Step 2: Executar `pnpm test:integration`; esperar FAIL até o harness iniciar API/Worker e limpar bancos entre casos.
- [ ] Step 3: Implementar harness com PostgreSQL/Redis do Compose, schema isolado por execução, queue prefix único, servidor HTTP Meta falso e clock determinístico. Cobrir health, assinatura inválida, verification GET, comment/message/postback normalization, enqueue, worker, 5xx e timeout com backoff, 400/401/403 sem loop, reconciliação ou chave idempotente antes de repetir timeout ambíguo, persistência de `Message.rawPayload` sanitizado e todos os cinco casos explícitos de idempotência.

```ts
export async function createIntegrationHarness(): Promise<IntegrationHarness> {
  const namespace = `flowchat-test-${randomUUID()}`;
  const meta = await FakeMetaServer.start();
  const database = await createIsolatedDatabase(namespace);
  const redis = createIsolatedRedis(namespace);
  return startSystem({ metaBaseUrl: meta.url, database, redis, queuePrefix: namespace });
}
```

- [ ] Step 4: Executar `pnpm test:integration`; esperar PASS com chamadas contadas exatamente: comentário duplicado = 1 pública + 1 Private Reply; postback duplicado = 1 segunda DM; retry parcial não repete efeito concluído.
- [ ] Step 5: Executar `git add test vitest.workspace.ts package.json && git commit -m "test: prove meta flow idempotency"`.

### Task 22: README e workflow de desenvolvimento

**Files**
- Create: `test/docs/readme-workflow.test.ts`
- Modify: `README.md`
- Test: `test/docs/readme-workflow.test.ts`

**Interfaces**
- Consumes: todos os comandos, envs e endpoints produzidos nas Tasks 1–21.
- Produces: workflow reproduzível para instalação, migration, API, Worker, qualidade, Cloudflare Tunnel e configuração Meta.

- [ ] Step 1: Escrever teste documental com seções e comandos exatos.

```ts
it('documents the complete local workflow', () => {
  const readme = readFileSync('README.md', 'utf8');
  for (const text of ['Node.js 22', 'pnpm install', 'docker compose up -d postgres redis', 'prisma migrate deploy', 'pnpm dev:api', 'pnpm dev:worker', 'cloudflared tunnel --url http://localhost:3001', 'pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm build', 'Meta setup checklist']) expect(readme).toContain(text);
});
```

- [ ] Step 2: Executar `pnpm exec vitest run test/docs/readme-workflow.test.ts`; esperar FAIL porque README ainda é mínimo.
- [ ] Step 3: Documentar prerequisites Node 22/pnpm/Docker/Cloudflared, instalação, cópia `.env.example` → `.env`, geração segura de chave com `openssl rand -base64 32`, infra, migration, dois terminais, health, túnel, atualização de callback/webhook na Meta, comandos de qualidade, troubleshooting sem imprimir segredos e checklist das permissões verificadas em `docs/META-INTEGRATION.md`.
- [ ] Step 4: Executar `pnpm exec vitest run test/docs/readme-workflow.test.ts`; esperar PASS.
- [ ] Step 5: Executar `git add README.md test/docs/readme-workflow.test.ts && git commit -m "docs: explain local backend workflow"`.

### Task 23: Checklist manual Meta real e verificação final

**Files**
- Create: `docs/MANUAL-META-TEST.md`, `test/docs/manual-meta-test.test.ts`
- Modify: nenhum.
- Test: `test/docs/manual-meta-test.test.ts`

**Interfaces**
- Consumes: `docs/META-INTEGRATION.md`, endpoints OAuth/webhook, fluxo completo e critérios de idempotência.
- Produces: registro manual datado com evidências esperadas para a Definition of Done real.

- [ ] Step 1: Escrever teste documental do checklist real.

```ts
it('covers the real Meta acceptance path', () => {
  const doc = readFileSync('docs/MANUAL-META-TEST.md', 'utf8');
  for (const item of ['Create and configure Meta App', 'Complete OAuth', 'Expose webhook with Cloudflare Tunnel', 'Comment QUERO', 'Verify one public reply', 'Verify Private Reply', 'INICIAR AQUI', 'FLOW_CONTINUE', 'Verify one second DM', 'Duplicate delivery']) expect(doc).toContain(item);
});
```

- [ ] Step 2: Executar `pnpm exec vitest run test/docs/manual-meta-test.test.ts`; esperar FAIL por documento ausente.
- [ ] Step 3: Criar checklist separado com pré-condições de conta profissional/App Review, configuração do App, OAuth, URL HTTPS pública, subscription/verificação, comentário real `QUERO`, texto público exato, Private Reply e botão regular `INICIAR AQUI`, clique e segunda DM exata, inspeção segura de banco/Worker e reentrega/replay quando possível. Para cada item, incluir campos `Executed at`, `Graph API version`, `Expected`, `Observed`, `Evidence reference` e `Pass/Fail`, sem armazenar tokens ou dados pessoais desnecessários.
- [ ] Step 4: Executar `pnpm exec vitest run test/docs/manual-meta-test.test.ts && pnpm lint && pnpm typecheck && pnpm test && pnpm build`; esperar todos PASS. Executar também `git diff --check`; esperar exit code 0.
- [ ] Step 5: Executar `git add docs/MANUAL-META-TEST.md test/docs/manual-meta-test.test.ts && git commit -m "docs: add real meta acceptance checklist"`.

## Requirement Coverage Matrix

| Requisito aprovado | Tasks |
|---|---|
| Monorepo, tooling, comandos e guardrails | 1 |
| PostgreSQL/Redis via Compose e health local | 2, 7 |
| Config Zod e Graph version configurável | 3 |
| Contratos internos sem vazamento Meta | 4, 12 |
| Prisma, entidades, índices e migrations | 5 |
| Token criptografado e logs sem segredo | 6, 10, 14 |
| API 3001 e Worker BullMQ com shutdown | 7, 8 |
| Verificação da documentação Meta vigente | 9 |
| Cliente Meta, OAuth, assinatura, normalização e operações | 10–13 |
| OAuth API com state anti-CSRF e upsert seguro | 14 |
| Verification GET e ingestion POST rápido | 15, 16 |
| Contatos, conversas e mensagens sem inbox/CRM | 17 |
| Retry 5xx/timeout e falhas 400/401/403 | 10, 18, 21 |
| Idempotência por evento e efeito externo parcial | 5, 16, 18, 21 |
| Comentário `QUERO`, resposta pública e Private Reply | 19 |
| Botão regular `INICIAR AQUI`/`FLOW_CONTINUE`, nunca Quick Reply | 9, 13, 19 |
| Postback e segunda DM única | 20, 21 |
| Message webhook persistido sem automação extra | 12, 17, 20 |
| Integração automatizada sem conta Meta real | 21 |
| README, Cloudflare Tunnel e setup Meta | 22 |
| Aceitação manual com conta real e Definition of Done | 23 |
| Ausência de frontend, Flow Engine e IA/OpenAI | Global Constraints, 1, 19–23 |

## Final Execution Gate

Ao terminar a Task 23, o agente executor deve conferir a spec linha a linha contra a matriz, confirmar a consistência das assinaturas públicas descritas em **Interfaces**, procurar marcadores de trabalho incompleto e linguagem vaga, e corrigir qualquer ocorrência antes de considerar o plano concluído. Deve ainda confirmar explicitamente que não há frontend, Flow Engine ou IA/OpenAI; que o primeiro botão permanece regular/postback e não Quick Reply; e que `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `git diff --check` terminam com exit code 0. O teste manual real somente pode ser marcado como aprovado depois de evidência observada com uma conta profissional real.
