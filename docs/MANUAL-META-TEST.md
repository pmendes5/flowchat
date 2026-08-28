# Manual Meta acceptance test

Status: NOT_EXECUTED

Este checklist define a Task 23, mas não registra aprovação. Não há credenciais,
requests reais ou evidência de uma conta profissional neste arquivo. A execução
permanece impedida enquanto OAuth estiver `BLOCKED_BY_VERIFICATION` e a
capability inicial continuar protegida por `MetaCapabilityNotVerifiedError`.

## Preconditions

- [ ] Create and configure Meta App com Instagram API with Instagram Login.
- [ ] Confirmar no Meta App Dashboard o authorization endpoint, token exchange,
  campos de lookup e callback vigentes.
- [ ] Complete OAuth somente após essa confirmação oficial.
- [ ] Usar uma conta profissional e dados de teste autorizados.
- [ ] Expose webhook with Cloudflare Tunnel e cadastrar `/webhooks/meta`.
- [ ] Confirmar as subscriptions necessárias sem imprimir tokens ou secrets.

## Acceptance path

- [ ] Comment QUERO em uma mídia de teste.
- [ ] Verify one public reply e confirmar que duplicação do webhook não produz
  uma segunda resposta pública.
- [ ] Verify Private Reply usando somente um contrato documentado ou evidência
  previamente validada; não combinar estruturas por inferência.
- [ ] Confirmar visualmente o botão regular `INICIAR AQUI` — nunca Quick Reply.
- [ ] Clicar e observar webhook com payload `FLOW_CONTINUE`.
- [ ] Verify one second DM.
- [ ] Duplicate delivery do comentário e do postback; confirmar uma única
  resposta pública, uma única abertura e uma única segunda DM.

## Evidence record template

Preencher uma linha por item somente durante a execução autorizada. Requests e
responses devem ser sanitizados, removendo tokens, authorization codes, app
secret, identificadores pessoais desnecessários e headers sensíveis.

| Check | Executed at | Graph API version | Expected | Observed | Evidence reference | Pass/Fail |
|---|---|---|---|---|---|---|
| App/OAuth verified | — | — | Contrato vigente confirmado | NOT_EXECUTED | — | — |
| Public reply | — | — | Uma resposta | NOT_EXECUTED | — | — |
| Opening Private Reply | — | — | Botão regular INICIAR AQUI | NOT_EXECUTED | — | — |
| FLOW_CONTINUE webhook | — | — | Um postback interno | NOT_EXECUTED | — | — |
| Second DM | — | — | Uma mensagem | NOT_EXECUTED | — | — |
| Duplicate delivery | — | — | Efeitos singulares | NOT_EXECUTED | — | — |

## Resolution rule

Se o probe confirmar a combinação de abertura, registrar o contrato observado
e a evidência sanitizada em `docs/META-INTEGRATION.md` antes de implementar o
adapter. Se provar impossibilidade, parar e solicitar decisão de produto; não
adotar fallback textual nem Quick Reply automaticamente.
