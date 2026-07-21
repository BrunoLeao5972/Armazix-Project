# Integração Appmax — "Pagamento via App Max"

Gateway alternativo ao Mercado Pago (cartão, boleto, Pix, split, tokenização).
Este documento explica o fluxo para quem for mexer no módulo depois.

## Onde fica cada coisa

| Peça                                            | Arquivo                                                          |
|--------------------------------------------------|-------------------------------------------------------------------|
| Schema (colunas em `stores` e `orders`)          | `src/lib/db/schema.ts`                                            |
| Toda a lógica de servidor                        | `src/lib/api/appmax-handler.ts`                                   |
| Rotas registradas                                | `src/lib/api-handler.ts`                                          |
| Validação de webhook por query-string            | `src/lib/webhook-validator.ts` (`validateWebhookQueryKey`)        |
| Card "Pagamento via App Max" na UI               | `src/components/admin/PaymentMethodEditor.tsx` (branch `isAppmax`)|
| Tela que hospeda o card + estado de conexão      | `src/routes/admin/financial/-sec-gerais.tsx` (`PainelFormasPagamento`) |
| Testes                                           | `src/lib/api/__tests__/appmax-handler.test.ts`, `src/lib/__tests__/webhook-validator.test.ts` |

## Por que a arquitetura é diferente do Mercado Pago

No Mercado Pago, o lojista cola um Access Token gerado manualmente no painel
dele. A Appmax **não funciona assim** — o modelo documentado é de instalação
de app (parecido com uma app-store), com dois pares de `client_id`/`client_secret`:

1. **Credenciais da plataforma** (o "app" Armazix, um único par, fixo) — usadas
   para autenticar o Armazix junto à Appmax e iniciar o fluxo de autorização.
2. **Credenciais do merchant** (uma por loja) — geradas pela Appmax somente
   depois que o lojista aprova a instalação no painel dele. É isso que fica
   salvo, criptografado, em `stores.appmax_client_id` / `appmax_client_secret`.

Fluxo completo:

```
Lojista clica "Conectar com Appmax" (card em Formas de Pagamento)
        │
        ▼
POST /api/payments/appmax-connect (protegido, storeId vem do JWT)
  → pega um token de plataforma (client_credentials, credenciais do app Armazix)
  → chama a Appmax pedindo um "hash" de autorização (app_id + external_key=storeId + url_callback)
  → devolve { redirectUrl: https://admin.appmax.com.br/appstore/integration/{hash} }
        │
        ▼
Navegador do lojista é redirecionado pra lá — ele loga na conta Appmax DELE
e aprova a instalação do Armazix.
        │
        ▼
Appmax redireciona de volta para url_callback = GET /api/payments/appmax-callback
  → troca o hash pelas credenciais definitivas do merchant (client_id/client_secret)
  → salva criptografado em stores, seta appmax_connected_at
  → redireciona o navegador pra /admin/financial/gerais?appmax=connected
```

Em runtime (checkout), o Armazix troca o `client_id`/`client_secret` **da
loja** por um bearer token de curta duração (3600s, client_credentials) e usa
esse token pra chamar a API da Appmax. O token é cacheado em
`stores.appmax_access_token` (criptografado) + `appmax_token_expires_at` pra
não fazer esse handshake em toda cobrança.

## ⚠️ O que precisa ser validado no sandbox antes de produção

A doc oficial da Appmax tem uma [FAQ](https://appmax.readme.io/reference/faq)
que confirma o fluxo de instalação com exemplos de `curl` — usamos ela pra
corrigir os endpoints de `appmax-connect`/`appmax-callback` (ver histórico:
antes usávamos `/appstore/authorize` e `/appstore/credentials`, que estavam
errados; o correto, confirmado na FAQ, é `/app/authorize` e
`/app/client/generate`). Ainda restam pontos sem confirmação 100% na doc
pública, marcados com `NOTE (validar antes de produção)` no código:

- `startAppmaxConnectHandler` — o campo `client_key` no corpo do
  `POST {api}/app/authorize` é citado na FAQ mas nunca definido em nenhum
  outro lugar da doc. Assumimos que é o `client_id` da plataforma (Armazix),
  repetido no corpo além do header `Authorization: Bearer`. Se o sandbox
  rejeitar, o valor mais provável de estar errado é esse.
- `createAppmaxCheckoutHandler`, método cartão — o endpoint de cobrança com
  cartão tokenizado (`POST {api}/v1/payments/credit-card`) segue o mesmo
  padrão documentado para Pix/Boleto, mas essa página específica não foi
  encontrada na doc pública consultada. Pix e Boleto foram confirmados
  contra `reference/appmax-pagamento-pix` e `reference/appmax-pagamento-boleto`.
- Tokenização de cartão no client (Appmax.js) ainda não foi integrada no
  front do checkout — ver `reference/tokenizacao-com-appmax-js`.
- `appmaxHealthHandler` — ver seção própria abaixo.

Se qualquer um desses vier diferente no sandbox, o ponto de ajuste é sempre
uma função isolada em `appmax-handler.ts` — não é preciso reescrever o resto.

## Webhook

**Uma única URL para toda a plataforma** — diferente do que se imaginava
inicialmente (`/webhooks/appmax/{merchant_id}`), a doc da Appmax deixa claro
que o host do webhook é configurado **uma vez, na criação do app** no painel
de desenvolvedor da Appmax, não por loja. Por isso:

- A loja é identificada pelo `data.order.id` (ou `data.id`) do payload,
  casado com `orders.appmax_order_id` (salvo quando o pedido é criado no
  checkout — a Appmax não aceita um `external_id` nosso na criação do pedido).
- Segurança: não há assinatura HMAC documentada. Como a URL é única e fixa,
  o segredo (`WEBHOOK_API_KEY`, a mesma variável já usada pelo webhook do
  Mercado Pago) é embutido na própria URL registrada no painel da Appmax:
  `https://armazix.com.br/api/payments/appmax-webhook?key=<WEBHOOK_API_KEY>`.
  O handler também aceita o header `x-api-key`, caso o painel da Appmax
  permita configurar headers customizados.
- Responde `200` imediatamente e processa em background via `ctx.waitUntil()`
  — o projeto não tem fila/job assíncrono (Cloudflare Queues não está
  configurado); esse é o mesmo padrão já usado pelo webhook do Mercado Pago
  e por outras invalidações de cache no projeto (`src/lib/execution-context.ts`).
  Isso significa que se o Worker cair no meio do processamento, o evento não
  é reprocessado automaticamente por nós — só se a Appmax reenviar por conta
  própria (retry dela, não nosso).

### Eventos tratados (primeira fase)

| Evento Appmax                     | paymentStatus | orderStatus | Observação |
|------------------------------------|:---:|:---:|---|
| `order_approved`                   | paid | confirmed | |
| `order_paid`                       | paid | confirmed | |
| `order_authorized`                 | pending | received | em análise antifraude |
| `order_integrated`                 | paid | confirmed | |
| `order_refund`                     | refunded | cancelled | |
| `order_chargeback_in_treatment`    | pending | received | fica visível até resolver |
| `order_pix_created`                | pending | received | |
| `order_paid_by_pix`                | paid | confirmed | |
| `order_pix_expired`                | failed | cancelled | |
| `order_billet_created`             | pending | received | |
| `order_billet_overdue`             | failed | cancelled | |
| `order_authorized_with_delay`      | pending | received | |
| `payment_not_authorized`           | failed | cancelled | |
| `payment_authorized_with_delay`    | pending | received | |

O mapa completo está em `APPMAX_EVENT_MAP` (exportado, testável). Eventos não
mapeados e pedidos não encontrados **não quebram o handler** — são
registrados em `audit_logs` com `status: "error"` para investigação.

### `external_key` vs `external_id` — não são a mesma coisa

A FAQ da Appmax é explícita sobre isso (pergunta 7) e vale destacar porque é
fácil confundir:

| Campo | Quem define | Uso |
|---|---|---|
| `external_key` | Nós (Armazix) | Nosso `storeId`, enviado no `POST /app/authorize` pra Appmax repassar de volta e nós correlacionarmos a instalação com a nossa loja. |
| `external_id`  | Nós (Armazix) | UUID gerado por nós, único por instalação, guardado em `stores.appmax_external_id`. É o que a **URL de validação** (health-check) devolve pra Appmax confirmar que a instalação foi concluída. |

Os dois são gerados por nós, mas têm papéis diferentes e a Appmax pede
explicitamente pra não usar o mesmo valor nos dois.

### Auditoria

Todo evento processado (sucesso ou erro) grava uma linha em `audit_logs` com
`modulo: "PAGAMENTO_APPMAX"`, `details.payload` = payload bruto recebido.
Não criamos tabela nova pra isso — a tabela de auditoria já existente no
projeto cobre exatamente esse caso de uso.

## Variáveis de ambiente necessárias

Configuradas via `wrangler secret put` (ver comentário no topo de
`wrangler.jsonc`):

- `APPMAX_APP_ID`, `APPMAX_CLIENT_ID`, `APPMAX_CLIENT_SECRET` — credenciais
  do app Armazix na Appmax (uma vez, não por loja).
- `APPMAX_ENV` — `"production"` para usar `api.appmax.com.br`; qualquer outro
  valor (incluindo ausente) usa o sandbox `api.sandboxappmax.com.br`.
- `WEBHOOK_API_KEY` — já existe (reaproveitado do Mercado Pago).
- `ENCRYPTION_KEY` — já existe (reaproveitado; mesma AES-256-GCM de
  `src/lib/crypto.ts`).

## O que NÃO foi mudado

O Mercado Pago já tinha uma divergência pré-existente que encontramos ao
pesquisar: o card de "Mercado Pago" na tela de Formas de Pagamento salva num
lugar (`payment_methods`, tabela usada pelo PDV) que **não é lido** pelo
checkout público de verdade (que usa `stores.mp_access_token`, alimentado por
`saveMpTokenHandler` — endpoint sem nenhuma tela chamando ele hoje). Não
mexemos nisso — é um problema pré-existente e separado do escopo desta
tarefa. A Appmax foi construída do zero já ligando o card visível
(`payment_methods`, aba Formas de Pagamento) às credenciais reais que o
checkout usa (`stores.appmax_*`), então ela funciona ponta a ponta.

## Rotas

| Método | Rota | Auth | O que faz |
|---|---|---|---|
| POST | `/api/payments/appmax-connect` | owner/admin | Inicia o fluxo, devolve `redirectUrl` |
| GET  | `/api/payments/appmax-callback` | pública (Appmax redireciona) | Troca o hash pelas credenciais, salva, redireciona pro admin |
| GET  | `/api/payments/appmax-status` | qualquer membro da loja | `{ connected, connectedAt }` |
| POST | `/api/payments/appmax-disconnect` | owner/admin | Apaga as credenciais salvas |
| POST | `/api/payments/appmax-checkout` | pública (cliente da loja) | Cria pedido + cobrança (Pix/Boleto/Cartão) |
| POST | `/api/payments/appmax-webhook` | chave na query string ou header | Recebe e processa eventos |
| GET  | `/api/payments/appmax-health` | pública (Appmax chama) | "URL de validação" da instalação — devolve `external_id` |

## Tela "Configuração de URLs" no painel da Appmax

São 3 campos, todos preenchidos com URLs do Armazix:

1. **URL de Webhook** → `https://armazix.com.br/api/payments/appmax-webhook?key=<WEBHOOK_API_KEY>`
   Já estava pronto antes desta tarefa. Responde `200` em milissegundos (medido
   localmente: ~5ms) e processa o evento em background via `waitUntil` — bem
   dentro do limite de 10s da Appmax antes de reenviar com backoff.

2. **URL da plataforma** → `https://armazix.com.br` (só a URL institucional,
   sem implementação — é o link que a Appmax mostra pro merchant pra acessar
   o sistema).

3. **URL de validação** (health-check) → `https://armazix.com.br/api/payments/appmax-health`
   Era a única pendência real. Implementada em `appmaxHealthHandler`.
   Devolve `{ status: "ok", external_id: "<uuid>" }` quando recebe um
   identificador de instalação reconhecido (tentamos `external_key`/`store_id`/
   `storeId` via query string, ou os headers `x-external-key`/`x-store-id` —
   **a doc pública não mostra um exemplo de request pra esse endpoint
   específico**, então essa parte é a que mais precisa ser confirmada no
   sandbox: reveja o texto de ajuda ao lado do campo no painel, ou capture a
   primeira chamada real que a Appmax fizer, pra confirmar qual identificador
   ela realmente manda). Sem identificador reconhecido, responde só
   `{ status: "ok" }` (ping de uptime) — não quebra, mas também não confirma
   a instalação, então se a Appmax exigir sempre um `external_id` na resposta
   e não mandar nenhum identificador, essa função precisa ser revisada.

   O `external_id` é gerado (`crypto.randomUUID()`) e persistido em
   `stores.appmax_external_id` assim que o lojista clica em "Conectar com
   Appmax" (`ensureAppmaxExternalId`, chamado no início de
   `startAppmaxConnectHandler`) — antes mesmo do redirecionamento, pra
   garantir que já exista um valor estável caso a Appmax chame a URL de
   validação em qualquer ponto do fluxo de instalação.

### Testes manuais já feitos (local, `vite dev`)

```
GET  /api/payments/appmax-health                                    → 200 {"status":"ok"}                (0.16s)
GET  /api/payments/appmax-health?external_key=<uuid-inexistente>    → 404 {"status":"not_found",...}
POST /api/payments/appmax-webhook (sem key)                         → 401 Unauthorized
POST /api/payments/appmax-webhook?key=<errada>                      → 401 Unauthorized
POST /api/payments/appmax-webhook?key=<correta>                     → 200 "ok"                            (0.005s)
POST /api/payments/appmax-webhook (header x-api-key: <correta>)     → 200 "ok"
```

Faltou testar contra o sandbox real (`sandboxappmax.com.br`) — os testes
acima validam a lógica do lado do Armazix, mas não confirmam os campos
exatos que a Appmax envia na URL de validação. Antes de preencher a tela de
Configuração de URLs em produção, dispare uma instalação de teste no sandbox
e confira nos logs do Worker (`console.error`/`console.log` já existentes em
`appmaxHealthHandler`) qual identificador chegou de fato.

## Testando no sandbox

Use `sandboxappmax.com.br` (`APPMAX_ENV` não definido ou diferente de
`"production"`) para simular aprovações, recusas, chargebacks e disparos de
webhook antes de qualquer teste com dados reais, conforme orientado no ticket
original desta integração.
