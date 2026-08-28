# FlowChat

Backend TypeScript da integração Meta/Instagram da Sprint 1. Não há frontend,
Flow Engine, IA, billing, dashboard ou inbox/CRM neste escopo.

## Pré-requisitos

- Node.js 22 ou superior
- pnpm 10
- Docker com Compose
- Cloudflared, somente para expor o webhook local por HTTPS

## Instalação e configuração

```powershell
pnpm install
Copy-Item .env.example .env
openssl rand -base64 32
```

Copie a saída do último comando para `APP_ENCRYPTION_KEY` no `.env` local. Não
versione esse arquivo. Preencha os demais valores apenas no seu ambiente, sem
copiar credenciais para issues, commits, logs ou conversas.

O OAuth está `BLOCKED_BY_VERIFICATION`: não configure nem implemente endpoints,
campos ou parâmetros de autorização até confirmar o contrato vigente no Meta
App Dashboard/documentação oficial. O que está confirmado é Instagram API with
Instagram Login, host `graph.instagram.com`, login type Business Login for
Instagram e as permissões listadas abaixo.

## Banco e infraestrutura

```powershell
docker compose up -d postgres redis
pnpm --filter @flowchat/database prisma generate
pnpm --filter @flowchat/database prisma migrate deploy
```

O primeiro comando equivale a `pnpm db:up`. Confira os containers com
`pnpm db:health`. Se o Docker retornar acesso negado ao pipe do engine dentro de
um sandbox, execute esta verificação no host.

## Executar API e Worker

Use dois terminais:

```powershell
pnpm dev:api
```

```powershell
pnpm dev:worker
```

A API usa a porta 3001 por padrão. Verifique `GET http://localhost:3001/health`.
O webhook é `GET/POST http://localhost:3001/webhooks/meta`.

## Túnel HTTPS

Com a API em execução:

```powershell
cloudflared tunnel --url http://localhost:3001
```

Cadastre a URL HTTPS temporária acrescida de `/webhooks/meta` no Meta App
Dashboard. Não conclua OAuth nem faça o teste manual real enquanto o contrato
OAuth estiver bloqueado. Alterações na URL do túnel exigem atualizar o webhook
no Dashboard.

## Qualidade

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

No Windows, se a ExecutionPolicy bloquear `pnpm.ps1`, use o launcher equivalente
`pnpm.cmd`, por exemplo `pnpm.cmd test`. Antes dos checks em uma instalação nova,
execute `pnpm --filter @flowchat/database prisma generate`.

## Meta setup checklist

- Usar Instagram API with Instagram Login e Business Login for Instagram.
- Solicitar somente `instagram_business_basic`,
  `instagram_business_manage_messages` e
  `instagram_business_manage_comments` no escopo atual.
- Configurar o verify token do webhook e assinar/verificar os bytes crus com o
  app secret.
- Manter Task 11 e Task 14 `BLOCKED_BY_VERIFICATION` até confirmar OAuth.
- Manter o primeiro botão regular `INICIAR AQUI` com payload `FLOW_CONTINUE`;
  não transformar em Quick Reply.
- Não executar chamadas Meta reais até o checklist manual da Task 23.

Veja [docs/META-INTEGRATION.md](docs/META-INTEGRATION.md) para os contratos já
verificados e as capabilities ainda pendentes.

## Troubleshooting seguro

Nunca imprima tokens, app secrets, authorization codes, `.env` ou corpos de erro
do provider. Erros de assinatura devem ser investigados comparando os bytes crus
recebidos, sem registrar o secret. Erros de Prisma Client ausente são resolvidos
com `prisma generate`; falhas de conexão com PostgreSQL/Redis devem ser checadas
com `pnpm db:health` e logs sanitizados dos containers.
