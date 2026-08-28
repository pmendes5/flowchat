# FlowChat — Meta Core Backend Design

## Status e escopo

Este documento registra o design aprovado para o backend fundamental da Sprint 1 do FlowChat. A Sprint tem como finalidade provar uma integração real e completa com Instagram/Meta, sem antecipar funcionalidades do produto futuro.

## Produto

O FlowChat será uma plataforma SaaS de automação para Instagram semelhante ao ManyChat. No futuro, poderá incluir editor visual de funis, automações por comentário e DM, inbox, contatos, agentes de IA para vendas, múltiplas contas do Instagram e arquitetura multi-tenant.

Essas capacidades futuras não fazem parte da Sprint 1.

## Objetivo da Sprint 1

Construir somente o backend fundamental necessário para provar a integração real com Instagram/Meta por meio deste fluxo:

1. Uma pessoa comenta a palavra-chave `QUERO` em um post ou reel real.
2. A Meta envia o webhook do comentário ao FlowChat.
3. O FlowChat valida, persiste, normaliza e processa o evento.
4. O FlowChat publica uma resposta pública no comentário, por exemplo: `Te mandei uma mensagem  Dá uma olhadinha na sua DM.`
5. Ao mesmo tempo, o FlowChat envia uma Private Reply na DM com uma mensagem semelhante a:

   ```text
   Oi!
   Vi que você comentou QUERO.
   Clique abaixo para continuar.
   ```

6. A Private Reply contém um botão regular do Instagram, com o texto `INICIAR AQUI` e o payload interno estável `FLOW_CONTINUE`.
7. A pessoa clica em `INICIAR AQUI`.
8. A Meta envia ao FlowChat o webhook de postback ou interação equivalente suportada pela Instagram Messaging API.
9. O backend valida, persiste e normaliza o clique como `instagram.postback.received`.
10. O Worker processa o evento.
11. O FlowChat envia a segunda DM: `Funcionou ✅ O FlowChat recebeu seu clique e continuou a automação.`

O fluxo deve funcionar com uma conta profissional real do Instagram.

O botão inicial deve ser projetado como um botão regular anexado à mensagem, semelhante ao comportamento do ManyChat, usando postback ou a interação equivalente efetivamente suportada pela Instagram Messaging API. Ele não é uma Quick Reply. Quick Replies poderão ser suportadas futuramente como outro tipo de elemento de mensagem, fora do escopo desta Sprint.

## Arquitetura

O projeto usará um monorepo TypeScript, gerenciado com pnpm e Turborepo, com a seguinte estrutura planejada:

```text
flowchat/
├── apps/
│   ├── api/
│   └── worker/
├── packages/
│   ├── database/
│   ├── contracts/
│   ├── meta/
│   └── config/
├── docs/
├── AGENTS.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

Tecnologias aprovadas:

- Node.js;
- TypeScript;
- NestJS;
- PostgreSQL;
- Prisma;
- Redis;
- BullMQ;
- pnpm;
- Turborepo;
- Zod;
- Docker e Docker Compose.

Não haverá frontend na Sprint 1.

## Responsabilidades dos componentes

### `apps/api`

- Expor HTTP e health checks.
- Iniciar o OAuth do Instagram e receber seu callback.
- Atender à verificação do webhook.
- Receber webhooks da Meta.

### `apps/worker`

- Executar processamento assíncrono.
- Consumir jobs do BullMQ.
- Processar eventos normalizados.
- Realizar chamadas de saída para a Meta.

### `packages/database`

- Conter o Prisma, seu schema, o client compartilhado e as migrations.

### `packages/contracts`

- Definir tipos e schemas compartilhados, eventos internos e contratos de jobs.

### `packages/meta`

- Implementar o cliente da Meta Graph API.
- Encapsular OAuth.
- Verificar a assinatura e a autenticidade dos webhooks.
- Fazer parsing e normalização dos payloads da Meta.

### `packages/config`

- Ler e validar de forma tipada as variáveis de ambiente.

## Isolamento da integração Meta

Payloads específicos da Meta não devem vazar para o restante da aplicação. O package `meta` deve convertê-los em eventos internos estáveis, por exemplo:

- `instagram.comment.created`;
- `instagram.postback.received`;
- `instagram.message.received`.

As demais camadas devem trabalhar somente com os contratos internos do FlowChat.

## Webhook e processamento assíncrono

O fluxo de entrada e processamento será:

```text
Meta
→ API
→ valida autenticidade
→ persiste WebhookEvent
→ verifica idempotência
→ enfileira job
→ responde HTTP rapidamente
→ Worker processa
→ Worker executa ações externas
```

O endpoint de webhook deve contemplar os eventos necessários de comentário, mensagem e postback/interação, validar sua autenticidade, persistir o payload recebido, normalizá-lo, enfileirar o contrato interno correspondente e responder rapidamente. A assinatura, os campos e o formato exatos usados para identificar um postback devem ser confirmados contra a documentação Meta vigente e por validação experimental antes da integração real. O endpoint não deve executar IA ou funis, aguardar processamento pesado nem conter lógica de negócio extensa.

## Idempotência

Reentregas do mesmo evento pela Meta não podem repetir nenhum efeito externo. Isso inclui a resposta pública ao comentário, a Private Reply inicial e a segunda DM disparada pelo clique. Quando houver um identificador externo confiável, ele deve ser persistido e usado para deduplicação. Quando não houver identificador único suficiente, deve ser usada uma chave determinística de deduplicação construída a partir dos campos estáveis do evento.

Os jobs também devem ser idempotentes, de modo que retries ou reprocessamentos não repitam efeitos externos. A idempotência deve cobrir tanto o processamento do comentário quanto o processamento do postback, incluindo a hipótese de o webhook ser entregue mais de uma vez ou o job ser executado novamente. A implementação da estratégia de deduplicação e da idempotência dos jobs deve possuir testes.

## Banco de dados inicial

A Sprint 1 terá somente as entidades necessárias ao fluxo aprovado. A modelagem poderá evoluir durante a implementação, sem adicionar entidades de funcionalidades futuras sem necessidade concreta.

### `InstagramAccount`

Campos conceituais:

- `id`;
- `instagramUserId`;
- `username`;
- `accessTokenEncrypted`;
- `tokenExpiresAt`;
- `status`;
- `createdAt`;
- `updatedAt`.

Access tokens jamais devem ser armazenados em texto puro.

### `WebhookEvent`

Campos conceituais:

- `id`;
- `externalEventId` ou chave de deduplicação;
- `eventType`;
- `payload`;
- `status`;
- `receivedAt`;
- `processedAt`;
- `error`.

Estados conceituais:

- `pending`;
- `processing`;
- `completed`;
- `failed`.

### `Contact`

Campos conceituais:

- `id`;
- `instagramAccountId`;
- `instagramScopedUserId`;
- `username`;
- `name`;
- `createdAt`;
- `updatedAt`.

### `Conversation`

Campos conceituais:

- `id`;
- `instagramAccountId`;
- `contactId`;
- `status`;
- `lastMessageAt`;
- `createdAt`;
- `updatedAt`.

### `Message`

Campos conceituais:

- `id`;
- `conversationId`;
- `externalMessageId`;
- `direction`;
- `type`;
- `text`;
- dados estruturados da interação, quando aplicáveis, incluindo o payload interno do botão;
- `rawPayload`;
- `createdAt`.

## Meta e Instagram

A integração usará uma aplicação Meta criada do zero e será projetada para contas profissionais do Instagram.

Permissões previstas inicialmente:

- `instagram_business_basic`;
- `instagram_business_manage_comments`;
- `instagram_business_manage_messages`.

A arquitetura não deve fixar uma versão específica da Graph API. A versão será configurável via ambiente ou configuração para facilitar upgrades futuros. Antes da implementação real, permissões, endpoints, tipos de botão, suporte a postback ou interação equivalente e payloads de entrada e saída devem ser conferidos contra a documentação vigente da Meta e validados experimentalmente quando necessário. Esta especificação não fixa nomes de campos, formatos ou endpoints que ainda dependam dessa verificação.

## OAuth

Mesmo sem frontend, a Sprint 1 deve implementar o fluxo OAuth:

```text
GET /auth/instagram
→ redireciona para autorização Meta/Instagram

GET /auth/instagram/callback
→ recebe authorization code
→ troca por token
→ identifica conta profissional
→ persiste InstagramAccount de forma segura
```

Na futura interface web, o botão `Conectar Instagram` apenas utilizará esse fluxo; a Sprint 1 não implementará essa interface.

## Segurança

Segredos nunca devem ser versionados. As variáveis previstas são:

```dotenv
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_REDIRECT_URI=
META_GRAPH_API_VERSION=

DATABASE_URL=
REDIS_URL=

APP_ENCRYPTION_KEY=
```

O arquivo `.env` deve permanecer ignorado. O `.env.example` deve conter somente nomes de variáveis e exemplos seguros.

Access tokens devem ser criptografados em repouso usando `APP_ENCRYPTION_KEY` ou uma abstração equivalente. O webhook deve verificar a autenticidade das requisições da Meta quando aplicável.

Logs não devem expor access tokens, app secret, authorization codes ou dados sensíveis desnecessários.

## Desenvolvimento local

A abordagem aprovada é executar o backend localmente e expor a API por um túnel HTTPS:

```text
Instagram/Meta
→ HTTPS público
→ Cloudflare Tunnel
→ localhost:3001
→ NestJS API
→ PostgreSQL / Redis
→ Worker
→ Meta Graph API
```

PostgreSQL e Redis devem rodar via Docker Compose. API e Worker poderão inicialmente rodar diretamente pelo pnpm durante o desenvolvimento.

## Retries e tratamento de erros

O BullMQ deve aplicar retries somente a erros potencialmente transitórios. Jobs precisam permanecer idempotentes durante retries.

- Meta 5xx ou timeout: retry com backoff.
- Meta 400 por requisição inválida: não realizar retry infinito.
- Meta 401/403: registrar falha de autenticação ou permissão e não entrar em loop infinito.

## Primeiro comportamento end-to-end

A Sprint 1 não implementará o Flow Engine. Pode existir um handler temporário, claramente isolado, destinado apenas ao teste end-to-end aprovado:

- se um comentário contiver a palavra-chave `QUERO`, publicar uma única resposta pública e enviar uma única Private Reply conforme o objetivo da Sprint;
- anexar à Private Reply um botão regular com texto `INICIAR AQUI` e payload interno estável `FLOW_CONTINUE`, usando postback ou interação equivalente suportada pela Instagram Messaging API;
- quando chegar o clique com o payload esperado, enviar uma única vez a segunda DM definida no objetivo da Sprint;
- ignorar, rejeitar com segurança ou registrar como não aplicável um payload que não corresponda a `FLOW_CONTINUE`, sem continuar a automação.

`QUERO`, os textos das mensagens e `FLOW_CONTINUE` serão configuração temporária ou valores hardcoded claramente isolados. A arquitetura deve permitir que futuramente esses valores venham da configuração de cada automação e que o payload identifique flow, versão, node ou outros dados, sem implementar agora editor visual, configuração de automações ou Flow Engine.

O primeiro botão não deve ser modelado ou documentado como Quick Reply. Quick Replies permanecem apenas como uma possibilidade futura e distinta.

## Architecture Principles

1. **Simplicidade antes de abstração:** implementar a solução mais simples que sustente com segurança o fluxo da Sprint 1.
2. **YAGNI:** não construir capacidades antes de existir necessidade concreta no escopo atual.
3. **Integração Meta isolada:** concentrar detalhes e payloads externos no package `meta`.
4. **Jobs idempotentes:** retries e reprocessamentos não podem duplicar efeitos externos.
5. **Webhook rápido:** validar, persistir, enfileirar e responder sem processamento pesado síncrono.
6. **Contratos internos estáveis:** desacoplar as camadas internas dos formatos variáveis da Meta.
7. **Observabilidade desde o início:** permitir acompanhar recebimento, processamento, falhas e retries dos eventos.
8. **Segurança de segredos:** proteger credenciais, tokens e outros dados sensíveis em armazenamento e logs.
9. **Componentes pequenos e testáveis:** manter responsabilidades claras e verificáveis de forma isolada.
10. **Nenhuma dependência da futura UI:** todo o backend da Sprint 1 deve funcionar sem frontend.

## Qualidade e testes

O projeto deverá oferecer comandos equivalentes a:

```shell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Todos deverão passar antes de a Sprint 1 ser considerada concluída.

Devem existir testes para:

- normalização de payload Meta;
- normalização do postback/interação do botão para `instagram.postback.received`;
- validação do payload `FLOW_CONTINUE` antes de continuar a automação;
- validação dos contratos;
- idempotência do processamento do comentário e do clique;
- garantia de que a reentrega do comentário não produz múltiplas respostas públicas nem múltiplas Private Replies;
- garantia de que um webhook de postback duplicado não envia a segunda DM duas vezes;
- webhook verification;
- comportamento do worker;
- tratamento de erros e retries;
- criptografia e decriptação de tokens.

## Non-goals da Sprint 1

Não implementar nesta Sprint:

- frontend;
- React;
- editor visual;
- React Flow;
- Flow Engine;
- agentes de IA;
- OpenAI;
- billing;
- planos;
- assinatura;
- analytics avançado;
- dashboard;
- inbox completo;
- CRM completo;
- publicação de posts;
- insights;
- anúncios.

## Definition of Done

A Sprint 1 só termina quando:

1. O ambiente local funciona.
2. PostgreSQL funciona.
3. Redis funciona.
4. A API funciona.
5. O Worker funciona.
6. O OAuth conecta uma conta profissional real.
7. O webhook público é validado pela Meta.
8. Um comentário real com `QUERO` chega ao backend.
9. A resposta pública aparece no comentário.
10. Apenas uma resposta pública é criada.
11. A Private Reply real chega na DM.
12. A Private Reply contém o botão regular `INICIAR AQUI`.
13. Um clique real no botão chega ao webhook.
14. O evento de postback é normalizado e processado.
15. A segunda DM é enviada.
16. Um webhook duplicado não duplica nenhuma dessas ações, incluindo resposta pública, Private Reply ou segunda DM.
17. Eventos e mensagens relevantes ficam persistidos.
18. O lint passa.
19. O typecheck passa.
20. Os testes passam.
21. O build passa.
22. O README explica como executar o projeto localmente.

## Decisões para o futuro

A arquitetura deve permanecer preparada para evolução, mas sem implementar agora:

- workspace e multi-tenancy;
- versões de flows;
- flow runs resumíveis;
- wait-for-message;
- editor visual;
- agente de IA;
- inbox.

## Riscos conhecidos

- **Mudanças na API da Meta:** permissões, endpoints e payloads podem mudar; a integração isolada e a versão configurável reduzem o impacto, mas a documentação vigente deve ser conferida antes da implementação real.
- **Permissões e App Review:** permissões necessárias podem depender de aprovação da Meta e impedir o fluxo real até sua liberação.
- **Expiração de token:** tokens expirados podem interromper chamadas externas e devem ser tratados como falhas de autenticação, sem retries infinitos.
- **Duplicação ou reentrega de webhook:** a Meta pode reenviar eventos; deduplicação persistida e jobs idempotentes são obrigatórios para evitar mensagens duplicadas.
- **Variação no suporte a botões e postbacks:** o tipo de botão regular, a interação equivalente, os campos do payload e o evento recebido podem variar conforme a API e a conta; todos devem ser confirmados na documentação vigente e no ambiente real antes da implementação.
- **Indisponibilidade de Redis ou PostgreSQL:** falhas nesses componentes podem impedir enfileiramento ou persistência e precisam ser observáveis.
- **Mudança da URL do túnel local:** alterações na URL pública podem exigir atualização da configuração do webhook e do OAuth na aplicação Meta.
- **Diferenças entre desenvolvimento e produção:** túnel e processos locais não reproduzem integralmente o ambiente de produção, o que pode revelar diferenças operacionais posteriormente.
