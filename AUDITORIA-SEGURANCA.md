# Auditoria de Segurança — Armazix

**Data:** 25/07/2026
**Commit auditado:** `e27bb07` (branch `main`)
**Escopo:** backend (`src/lib/**`), frontend (`src/routes`, `src/components`), configs (`wrangler.jsonc`, `.env.example`), schema/migrations (`src/lib/db/schema.ts`), histórico do git.
**Natureza:** somente leitura. Nenhuma correção foi aplicada.

> ⚠️ Este arquivo descreve vulnerabilidades exploráveis. **Não commitar** no repositório
> público. Adicione ao `.gitignore` ou mova para um local privado após a leitura.

---

## Status das correções

Atualizado em 25/07/2026. **Todos os itens marcados ✅ abaixo estão em produção** —
as 4 migrations foram aplicadas no banco e o deploy foi publicado
(`wrangler deploy`, Version ID `199e326f-4061-467e-b3a9-3c71f4ceda5f`).

| Achado | Status | Como foi resolvido |
|---|---|---|
| **C-5** — escalada via convite + troca de senha | ✅ Corrigido | Entrada na equipe passou a exigir convite aceito (`store-invite-handler.ts`); escrita no registro global de `users` restrita a membro exclusivo da loja. 6 testes de regressão. |
| **C-1** — reset de senha global | ✅ Corrigido | Código passou a ser validado só contra o usuário resolvido pelo e-mail; teto de 5 tentativas por usuário; `Math.random()` → CSPRNG; um código vivo por vez. Mesma falha existia na verificação de e-mail, também corrigida. 8 testes de regressão. |
| **C-3** — sequestro de credenciais Appmax | ✅ Eliminado | Integração Appmax removida do produto. |
| **C-4** — webhook Appmax sem verificação | ✅ Eliminado | Idem. |
| **M-4** — rota `appmax-diagnose` em produção | ✅ Eliminado | Idem. |
| **M-5** — segredo do webhook na query string | ✅ Eliminado | `validateWebhookQueryKey()` removido junto — só a Appmax usava. |
| **M-9** — health-check público da Appmax | ✅ Eliminado | Idem. |
| **A-3** — webhook de pedidos do MP validava header errado | ✅ Corrigido | Reescrito: a notificação virou gatilho, a verdade vem de `GET /v1/payments` com o token da loja. Verifica vínculo pedido↔pagamento, vínculo pedido↔loja, valor e moeda; idempotência por `gateway_payment_id`; proíbe rebaixar pedido já pago. 13 testes. `validateWebhookApiKey` e `WEBHOOK_API_KEY` removidos por ficarem órfãos. |
| **C-2** — preço do pedido vinha do navegador | ✅ Corrigido | Novo motor `lib/pricing/order-pricing.ts` recalcula tudo do banco (preço, promoção, adicionais, variação, frete, cupom). `createOrderHandler` e o checkout do MP passaram a usá-lo. 24 testes. |
| **M-6** — cupom não revalidado na criação do pedido | ✅ Corrigido | Junto com o C-2: expiração, valor mínimo e teto de usos passam a valer no pedido real, e o desconto é calculado no servidor. Incremento de `usedCount` virou condicional para não estourar o teto em concorrência. |
| **M-7** — `quantity` sem validação | ✅ Corrigido | Junto com o C-2: precisa ser inteiro entre 1 e 999, e todo item precisa referenciar um produto real da loja. |
| **A-1** — vitrine pública expondo CNPJ e dados de billing | ✅ Corrigido | `GET /api/store/get` passou a usar allowlist explícita em vez de exclusão. `ownerName` é a única exceção, liberada só para quem prova pelo cookie ser membro daquela loja — e nesse caso a resposta vira `private, no-store` em vez de cacheável publicamente. 12 testes. |
| **M-12** — rate limits `payments`/`sensitive` nunca aplicados | 🟡 Parcial | `sensitive` passou a ser usado no convite de equipe; as rotas de checkout continuam sem o perfil `payments`. |
| Demais achados | ⬜ Pendente | Ver seções abaixo. |

**Migrations pendentes de aplicar** (`npm run db:migrate`):
`0013_store_invites.sql`, `0014_verification_code_attempts.sql`, `0015_remove_appmax.sql`.
A `0015` é **destrutiva** — apaga as credenciais Appmax salvas, o que é intencional.

---

## Índice de achados

| # | Severidade | Achado | Arquivo |
|---|---|---|---|
| C-1 | Crítico | Reset de senha global — código não vinculado ao usuário | `auth/index.ts` + `reset-password-handler.ts` |
| C-2 | Crítico | Preço/total do pedido confiados do cliente no checkout público | `crud-handler.ts` |
| C-3 | Crítico | Callback Appmax permite sequestro das credenciais de outra loja | `appmax-handler.ts` |
| C-4 | Crítico | Webhook Appmax marca pedido como pago sem confirmar no gateway | `appmax-handler.ts` |
| C-5 | Crítico | Owner pode anexar usuário alheio à loja e trocar a senha global dele | `user-handler.ts` |
| A-1 | Alto | Rota pública da loja expõe credenciais Appmax, CNPJ e dados de billing | `store-handler.ts` |
| A-2 | Alto | Checkout Mercado Pago aceita `storeId` arbitrário (cross-tenant) | `payment-handler.ts` |
| A-3 | Alto | Webhook do Mercado Pago valida header que o MP nunca envia | `payment-handler.ts` |
| A-4 | Alto | Enumeração de PII de clientes por telefone, sem auth | `crud-handler.ts` |
| A-5 | Alto | OTP de cliente sem limite de tentativas e gerado com `Math.random()` | `customer-handler.ts` + `auth/index.ts` |
| A-6 | Alto | Dependências com CVEs conhecidas (1 crítica, 10 altas) | `package.json` |
| M-1 | Médio | Baixa de estoque antes da confirmação do pagamento | `payment-handler.ts`, `appmax-handler.ts` |
| M-2 | Médio | `createTenantDb()` ignora o `storeId` — isolamento é só convenção | `db/index.ts` |
| M-3 | Médio | SSRF / varredura de portas via teste de impressora | `print-handler.ts` |
| M-4 | Médio | Rota `appmax-diagnose` temporária ativa em produção | `appmax-handler.ts` |
| M-5 | Médio | Segredo do webhook Appmax trafega na query string | `webhook-validator.ts` |
| M-6 | Médio | Cupom não é revalidado na criação do pedido | `crud-handler.ts` |
| M-7 | Médio | `quantity` sem validação (aceita negativo/fracionário) | vários |
| M-8 | Médio | Race condition no número sequencial do pedido | vários |
| M-9 | Médio | Health-check Appmax público permite enumerar lojas e escrever no banco | `appmax-handler.ts` |
| M-10 | Médio | Adições de produto legíveis sem filtro de loja | `crud-handler.ts` |
| M-11 | Médio | Imagens aceitas sem validação de tipo, tamanho ou esquema | `banners-handler.ts`, `crud-handler.ts` |
| M-12 | Médio | Rate limits de `payments`/`sensitive` definidos mas nunca aplicados | `api-handler.ts` |
| M-13 | Médio | Preço confiado do cliente no PDV | `pdv-handler.ts` |
| B-1 | Baixo | CSP com `unsafe-inline` e `unsafe-eval` | `server.ts`, `security-headers.ts` |
| B-2 | Baixo | Payload completo do webhook (com PII) gravado no audit log | `appmax-handler.ts` |
| B-3 | Baixo | CPF de toda a equipe visível para qualquer membro da loja | `user-handler.ts` |
| B-4 | Baixo | Rate limit falha em aberto e descarta os headers gerados | `rate-limit.ts`, `api-handler.ts` |
| B-5 | Baixo | E-mail registrado em log de auditoria em falha de login | `login-handler.ts` |
| O-1..O-6 | Observação | Itens de higiene — ver seção final | — |

---

# CRÍTICO

## C-1 — Reset de senha aceita qualquer código válido da plataforma inteira

**Arquivos:**
- [`src/lib/auth/index.ts:161-186`](src/lib/auth/index.ts#L161-L186)
- [`src/lib/api/auth/reset-password-handler.ts:9-42`](src/lib/api/auth/reset-password-handler.ts#L9-L42)
- [`src/lib/auth/index.ts:146-148`](src/lib/auth/index.ts#L146-L148)

**Descrição.** O handler de reset recebe apenas `{ code, newPassword }` — nenhum e-mail,
nenhum identificador de usuário:

```ts
// reset-password-handler.ts:9
const { code, newPassword } = await request.json() as { code: string; newPassword: string };
...
// reset-password-handler.ts:28
const result = await validateVerificationCode(db, code, "password_reset");
```

E `validateVerificationCode` busca o código **sem escopo de usuário nenhum**:

```ts
// auth/index.ts:167-176
const results = await db.select().from(verificationCodes).where(and(
  eq(verificationCodes.code, code),
  eq(verificationCodes.type, type),
  isNull(verificationCodes.usedAt),
  gt(verificationCodes.expiresAt, now),
)).limit(1);
```

O código é o único fator, tem **6 dígitos**, vale **15 minutos**, e é gerado com
`Math.random()` — não criptográfico:

```ts
// auth/index.ts:146-148
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
```

**Impacto.** Qualquer pessoa que adivinhe um código de reset ativo assume a conta a que
ele pertence — sem saber de quem é. O atacante não precisa mirar um alvo: dispara
`/api/auth/forgot-password` para vários e-mails conhecidos (ou espera o horário de pico),
inflando a quantidade de códigos válidos simultâneos, e então força bruta o espaço de 10⁶.
Com N códigos ativos, cada tentativa tem probabilidade N/10⁶ de acertar **algum**. O rate
limit de 5/15min é por IP, contornável com rotação. Não há invalidação dos códigos
anteriores quando um novo é pedido, então o pool só cresce. Resultado: tomada de conta de
lojista (acesso a pedidos, financeiro, config de gateway) e, se cair num `role: "admin"`,
da plataforma.

**Correção sugerida.** Exigir o e-mail no corpo da requisição e filtrar
`verificationCodes.userId` pelo usuário resolvido a partir dele. Trocar `generateCode()`
por `crypto.getRandomValues`, aumentar para 8+ dígitos ou usar um token opaco de 32 bytes
enviado como link. Invalidar códigos anteriores do mesmo usuário ao emitir um novo, e
contar tentativas falhas por usuário (não só por IP).

---

## C-2 — Checkout público persiste subtotal, desconto e total enviados pelo navegador

**Arquivo:** [`src/lib/api/crud-handler.ts:719-872`](src/lib/api/crud-handler.ts#L719-L872)
**Rota:** `POST /api/orders/create` — pública ([`api-handler.ts:167`](src/lib/api-handler.ts#L167))

**Descrição.** O pedido é gravado exatamente com os valores que vieram do cliente. Não há
nenhuma releitura de preço do banco:

```ts
// crud-handler.ts:842-845
subtotal:          body.subtotal,
deliveryFee:       body.deliveryFee || "0",
discount:          body.discount || "0",
total:             body.total,
```

```ts
// crud-handler.ts:861-863
unitPrice:         item.unitPrice,
additionsTotal:    item.additionsTotal || "0",
total:             item.total,
```

O único uso do banco é a checagem de estoque (linha 777) e a resolução do cupom — o preço
nunca é consultado. Repare no contraste: `createMpCheckoutHandler`
([`payment-handler.ts:80-101`](src/lib/api/payment-handler.ts#L80-L101)) e
`createAppmaxCheckoutHandler` ([`appmax-handler.ts:522-544`](src/lib/api/appmax-handler.ts#L522-L544))
**fazem** essa revalidação. O caminho principal de pedido, não.

**Impacto.** Um `POST` direto com `total: "0.01"` cria um pedido legítimo, com estoque
baixado, notificação de WhatsApp disparada para o lojista e cupom incrementado. Nos fluxos
com pagamento na entrega ou WhatsApp (que são o padrão da plataforma), não existe gateway
para reconciliar o valor — o prejuízo é direto e silencioso.

**Correção sugerida.** Replicar a lógica de `verifiedItems` dos handlers de gateway: buscar
`products.price` por `inArray`, recalcular `unitPrice`, `total` por item, `subtotal`, e
derivar `total = subtotal + deliveryFee − discount` no servidor, ignorando os campos
correspondentes do corpo. Rejeitar a requisição se o total recalculado divergir do enviado
(ajuda a detectar tentativa, além de bloquear).

---

## C-3 — Callback da Appmax grava credenciais na loja indicada pela query string

**Arquivo:** [`src/lib/api/appmax-handler.ts:304-367`](src/lib/api/appmax-handler.ts#L304-L367)
**Rota:** `GET /api/payments/appmax-callback` — pública ([`api-handler.ts:191`](src/lib/api-handler.ts#L191))

**Descrição.** O `storeId` de destino vem da query string, sem autenticação e sem
validação de `state`:

```ts
// appmax-handler.ts:308-309
const hash = url.searchParams.get("hash") || url.searchParams.get("code");
const storeIdFromQuery = url.searchParams.get("external_key") || url.searchParams.get("state");
```

```ts
// appmax-handler.ts:347
const storeId = storeIdFromQuery || cred.external_key;
```

```ts
// appmax-handler.ts:353-360
await db.update(stores).set({
  appmaxClientId:     await encrypt(cred.client_id, encryptionKey),
  appmaxClientSecret: await encrypt(cred.client_secret, encryptionKey),
  ...
}).where(eq(stores.id, storeId));
```

O `external_key` enviado na ida (linha 168) é o `storeId` do próprio lojista — ou seja, é
um identificador que o atacante conhece dos alvos (ele aparece na URL da vitrine pública e
em várias respostas de API). Não há assinatura, nonce ou vínculo entre o `hash` e a loja.

**Impacto.** O atacante inicia a instalação do app na **própria** conta Appmax, obtém um
`hash` válido, e chama manualmente
`GET /api/payments/appmax-callback?hash=<seu_hash>&external_key=<storeId_da_vítima>`.
As credenciais Appmax da loja da vítima são sobrescritas pelas do atacante. A partir daí,
**todo pagamento feito na vitrine da vítima é liquidado na conta do atacante** — sem que
nada quebre visualmente. Roubo de receita direto e difícil de detectar.

**Correção sugerida.** Gerar um `state` aleatório em `startAppmaxConnectHandler`, persistir
`(state → storeId)` com TTL curto, e no callback resolver o `storeId` **exclusivamente**
por esse `state`, descartando `external_key`/query. Verificar também que a loja resolvida
ainda não tem integração ativa, ou exigir reautenticação do owner antes de sobrescrever.

---

## C-4 — Webhook da Appmax confia no evento e não confirma o pagamento no gateway

**Arquivo:** [`src/lib/api/appmax-handler.ts:705-805`](src/lib/api/appmax-handler.ts#L705-L805)
**Rota:** `POST /api/payments/appmax-webhook` — pública ([`api-handler.ts:174`](src/lib/api-handler.ts#L174))

**Descrição.** O processamento marca o pedido como pago com base **apenas** no nome do
evento vindo no corpo:

```ts
// appmax-handler.ts:710-712
const event = payload?.event ?? "unknown";
const appmaxOrderId = extractAppmaxOrderId(payload);
const mapping = APPMAX_EVENT_MAP[event];
```

```ts
// appmax-handler.ts:747-751
await db.update(orders).set({
  paymentStatus: mapping.paymentStatus,   // "paid"
  status:        mapping.orderStatus,     // "confirmed"
  updatedAt: new Date(),
}).where(eq(orders.id, order.id));
```

Não há: (a) chamada de volta à API da Appmax para confirmar o status real; (b) conferência
do valor pago contra `orders.total`; (c) idempotência por `transaction_id`/`event_id`;
(d) guarda de ordem — um `order_pix_created` (pending) que chegue atrasado rebaixa um
pedido já pago. A autenticação é uma **única chave estática compartilhada por toda a
plataforma** (`WEBHOOK_API_KEY`), aceita inclusive via query string (ver M-5).

Compare com o fluxo de assinaturas ([`subscription-handler.ts:308`](src/lib/api/subscription-handler.ts#L308)
e [`:414`](src/lib/api/subscription-handler.ts#L414)), que valida HMAC do MP **e** refaz o
`GET /v1/payments/{id}` antes de aplicar. O webhook de pedidos da Appmax não faz nenhum dos dois.

**Impacto.** Quem obtiver a `WEBHOOK_API_KEY` (ela circula em URL, ver M-5) marca qualquer
pedido como pago enviando `{"event":"order_approved","data":{"order":{"id":"<id>"}}}`.
Como o `appmaxOrderId` é um inteiro sequencial da Appmax, é enumerável. Também dá para
reproduzir (replay) uma notificação legítima capturada, sem limite. Mercadoria liberada
sem pagamento.

**Correção sugerida.** Após identificar o pedido, buscar o status real via API da Appmax
com o token do merchant e só então aplicar a transição. Comparar o valor pago com
`orders.total`. Registrar `(appmaxOrderId, event, transactionId)` numa tabela de
idempotência com constraint única. Impedir transições regressivas a partir de `paid`.

---

## C-5 — Owner pode anexar um usuário existente à sua loja e trocar a senha global dele

**Arquivo:** [`src/lib/api/user-handler.ts:100-128`](src/lib/api/user-handler.ts#L100-L128) e [`:267-321`](src/lib/api/user-handler.ts#L267-L321)

**Descrição.** Duas decisões isoladas se combinam num caminho de escalada.

Primeiro, ao "criar" um membro com um e-mail que já existe na plataforma, o usuário é
**silenciosamente vinculado à loja do solicitante** — sem convite, sem confirmação, sem
notificação:

```ts
// user-handler.ts:122-128
await db.insert(storeUsers).values({
  storeId: storeAccess.storeId,
  userId:  existingByEmail.id,
  role:    storeRole,
});
return json({ success: true, userId: existingByEmail.id });
```

Depois, a troca de senha administrativa verifica apenas se o alvo é membro da loja, e então
atualiza a senha **na tabela global `users`**:

```ts
// user-handler.ts:295-311
const [member] = await db.select({ role: storeUsers.role }).from(storeUsers)
  .where(and(eq(storeUsers.storeId, storeAccess.storeId), eq(storeUsers.userId, body.userId)))...
if (member.role === "owner" && body.userId !== storeAccess.userId) { /* bloqueia */ }
```
```ts
// user-handler.ts:315-318
await db.update(users)
  .set({ passwordHash, updatedAt: new Date() })
  .where(eq(users.id, body.userId));
```

A guarda de `role === "owner"` só olha o papel **dentro da loja do atacante** — papel que o
próprio atacante acabou de atribuir no passo anterior (ex.: `"vendedor"`).

**Impacto.** Um lojista qualquer (owner da loja A) informa o e-mail do dono da loja B em
`/api/store-users/create`, recebe `success` e o `userId` da vítima, e em seguida chama
`/api/store-users/change-password` definindo a senha que quiser. A senha da vítima é
trocada globalmente. O atacante entra com essas credenciais e passa a operar a loja B —
incluindo configuração de gateway, exportação de dados e financeiro. Quebra total do
isolamento multi-tenant, explorável por qualquer cliente pagante da plataforma.

**Correção sugerida.** Substituir o vínculo automático por um fluxo de convite com aceite
do usuário (token por e-mail). Restringir `adminChangeUserPasswordHandler` a usuários cuja
**única** vinculação seja a loja do solicitante, ou eliminar a troca direta em favor de um
envio de link de redefinição para o e-mail do próprio usuário. Notificar por e-mail toda
alteração de senha e toda nova vinculação de loja.

---

# ALTO

## A-1 — Rota pública da loja devolve credenciais Appmax, CNPJ e dados de cobrança

**Arquivo:** [`src/lib/api/store-handler.ts:44-47`](src/lib/api/store-handler.ts#L44-L47)
**Rota:** `GET /api/store/get?slug=...` — pública ([`api-handler.ts:181`](src/lib/api-handler.ts#L181))

A projeção remove cinco campos e devolve **todo o resto** da linha de `stores`:

```ts
// store-handler.ts:44-47
// SECURITY: nunca expõe campos sensíveis de pagamento/billing.
const { mpAccessToken: _mpToken, plan: _plan, planStatus: _planStatus,
        planExpiresAt: _planExpiry, mpSubscriptionId: _subId, ...safe } = store;
return safe;
```

Conferindo contra o schema ([`schema.ts:18-96`](src/lib/db/schema.ts#L18-L96)), continuam saindo:
`appmaxClientId`, `appmaxClientSecret`, `appmaxAccessToken` (cifrados, mas expostos),
`appmaxExternalId`, `mpPublicKey`, `cnpj`, `ownerName`, `email`, `phone`, `wppConfig`
(inclui `ownerPhone`), `mpPaymentId`, `amountPaid`, `paymentStatus`, `paymentMethod`,
`pdvEnabled`, `address` completo.

**Impacto.** O ciphertext das credenciais de gateway de todas as lojas fica disponível
anonimamente — qualquer vazamento futuro da `ENCRYPTION_KEY` (que deriva a chave por
SHA-256 simples, sem KDF; ver O-3) converte-se imediatamente em comprometimento de todos os
gateways. Além disso expõe CNPJ, telefone e e-mail do lojista (dados cadastrais/LGPD), o
`appmaxExternalId` necessário para C-3, e a situação financeira da loja perante a Armazix.
A resposta ainda é cacheada por 10 min no Redis e 5 min na borda (linhas 49 e 63).

**Correção sugerida.** Inverter a lógica: montar um objeto explícito só com os campos que a
vitrine precisa (allowlist), em vez de remover por exclusão. Quebrar o cache existente após
o deploy.

---

## A-2 — Checkout Mercado Pago aceita `storeId` arbitrário de qualquer usuário autenticado

**Arquivo:** [`src/lib/api/payment-handler.ts:22-63`](src/lib/api/payment-handler.ts#L22-L63)
**Rota:** `POST /api/payments/mp-checkout` — protegida ([`api-handler.ts:226`](src/lib/api-handler.ts#L226))

A função sequer recebe o contexto de autenticação — o roteador passa `auth` como segundo
argumento, mas a assinatura ignora:

```ts
// payment-handler.ts:22
export async function createMpCheckoutHandler(request: Request): Promise<Response> {
```
```ts
// payment-handler.ts:59-63
const store = await db.query.stores.findFirst({
  where: eq(stores.id, body.storeId),
});
```

Todo o resto do handler opera sobre `body.storeId`: numeração do pedido (linha 111),
inserção (linha 116) e baixa de estoque (linhas 151-158).

**Impacto.** Qualquer lojista autenticado cria pedidos e **baixa estoque** na loja de
qualquer concorrente, apenas trocando o `storeId` do corpo. Também consome a numeração
sequencial de pedidos do alvo e gera preferências de pagamento no Mercado Pago da vítima.
É o padrão de IDOR que o resto do código já corrigiu — este handler ficou de fora.

**Correção sugerida.** Aceitar `auth` e resolver o `storeId` com
`requireStoreAccess(auth)`, como fazem os demais handlers protegidos. Se a rota também
precisa atender checkout anônimo da vitrine, movê-la para as rotas públicas e tratá-la como
`createAppmaxCheckoutHandler` — mas aí ela precisa das mesmas defesas de C-2/M-7.

---

## A-3 — Webhook do Mercado Pago valida um header que o MP não envia

**Arquivo:** [`src/lib/api/payment-handler.ts:214-226`](src/lib/api/payment-handler.ts#L214-L226)

```ts
// payment-handler.ts:222
const validation = validateWebhookApiKey(request, webhookSecret);
if (!validation.valid) {
  console.error("Webhook validation failed:", validation.error);
  return new Response("Unauthorized", { status: 401 });
}
```

`validateWebhookApiKey` lê exclusivamente o header `x-api-key`
([`webhook-validator.ts:75-76`](src/lib/webhook-validator.ts#L75-L76)). O Mercado Pago
assina com `x-signature`/`x-request-id`, e a `notification_url` registrada é
`${origin}/api/payments/mp-webhook` sem nenhum parâmetro
([`payment-handler.ts:181`](src/lib/api/payment-handler.ts#L181)).

Existe uma implementação HMAC correta em
[`webhook-validator.ts:29-65`](src/lib/webhook-validator.ts#L29-L65) — usada só pelas
assinaturas, nunca pelos pedidos.

**Impacto.** Duplo. Funcionalmente, **todo webhook de pedido do MP é rejeitado com 401** —
pedidos pagos por Mercado Pago provavelmente nunca saem de `paymentStatus: "pending"`.
Do lado da segurança, se alguém "corrigir" isso configurando a URL com a chave, cai-se num
segredo estático compartilhado em vez da assinatura HMAC real.

Há ainda uma falha latente em `verifyAndUpdatePayment`
([`payment-handler.ts:300-359`](src/lib/api/payment-handler.ts#L300-L359)): ele busca o
pagamento no MP mas **não confere** se o `external_reference` do pagamento corresponde ao
`orderId` sendo atualizado, nem se o valor bate com `orders.total`. Um pagamento aprovado de
R$ 1 pode quitar um pedido de R$ 1.000.

**Correção sugerida.** Trocar por `validateMercadoPagoSignature` com `MP_WEBHOOK_SECRET`
(mesmo padrão já usado em `subscription-handler.ts`). Em `verifyAndUpdatePayment`, validar
`pmt.external_reference === orderId` e `pmt.transaction_amount >= order.total` antes de
marcar como pago.

---

## A-4 — Qualquer um consulta nome e endereços de um cliente informando o telefone

**Arquivo:** [`src/lib/api/crud-handler.ts:1587-1651`](src/lib/api/crud-handler.ts#L1587-L1651)
**Rota:** `GET /api/customer/check?storeId=X&phone=Y` — pública ([`api-handler.ts:187`](src/lib/api-handler.ts#L187))

Sem autenticação, sem token, sem prova de posse do número. O comentário do código diz que
"evita CPF, email, avatarUrl", mas devolve a lista completa de endereços:

```ts
// crud-handler.ts:1632-1647
const customerAddresses = await db.select({
  id: addresses.id, label: addresses.label, street: addresses.street,
  number: addresses.number, complement: addresses.complement,
  neighborhood: addresses.neighborhood, city: addresses.city,
  state: addresses.state, zip: addresses.zip, isDefault: addresses.isDefault,
}).from(addresses).where(eq(addresses.customerId, customer.id))
```

O `storeId` também é público (aparece na vitrine). O rate limit aplicável é o genérico
`api`: 60 req/min por IP ([`api-handler.ts:338`](src/lib/api-handler.ts#L338),
[`rate-limit.ts:20`](src/lib/middleware/rate-limit.ts#L20)).

**Impacto.** Dado um telefone, obtém-se o nome e o **endereço residencial completo** da
pessoa. Serve tanto para consulta dirigida (stalking, engenharia social, "sei onde você
mora") quanto para varredura: 86 mil consultas/dia por IP permitem mapear a base de
clientes de uma loja a partir de faixas de numeração. Exposição de dado pessoal sensível
sob a LGPD, com a agravante de ser endereço físico.

**Correção sugerida.** Não devolver endereço nesse endpoint — apenas `exists: true/false`
e, no máximo, o primeiro nome mascarado. O preenchimento completo só depois do OTP, via
`/api/customer/profile` (que já exige Bearer). Adicionar rate limit dedicado e agressivo
por IP **e** por telefone consultado.

---

## A-5 — OTP do cliente: sem limite de tentativas e gerado com `Math.random()`

**Arquivos:**
- [`src/lib/api/customer-handler.ts:217-245`](src/lib/api/customer-handler.ts#L217-L245) (emissão)
- [`src/lib/api/customer-handler.ts:249-310`](src/lib/api/customer-handler.ts#L249-L310) (verificação)
- [`src/lib/api-handler.ts:312-322`](src/lib/api-handler.ts#L312-L322) (mapa de rate limit)

```ts
// customer-handler.ts:227
const code = String(Math.floor(100000 + Math.random() * 900000));
```

`/api/customer/auth/request-code` e `/api/customer/auth/verify-code` **não constam** em
`rateLimitConfigs`, então herdam `api` — 60/min por IP. Não existe contador de tentativas
por telefone, nem invalidação do OTP após N erros: `consumeOtp` simplesmente devolve
`false` e o código continua válido pelos 5 minutos.

**Impacto.** 300 tentativas por janela de OTP, por IP, sem qualquer bloqueio — e nada impede
distribuir entre IPs. Acertando, o atacante recebe um JWT de **30 dias**
([`auth/index.ts:190-201`](src/lib/auth/index.ts#L190-L201)) com acesso ao histórico de
pedidos e endereços do cliente. `Math.random()` ainda reduz a entropia real abaixo dos 10⁶
nominais. Na emissão, a ausência de limite por telefone também permite spam de WhatsApp
(custo por mensagem e risco de bloqueio da instância).

**Correção sugerida.** `crypto.getRandomValues` para o código. Rate limit dedicado:
`request-code` por telefone (ex.: 3/hora) e `verify-code` por telefone (ex.: 5 tentativas,
depois invalida o OTP e exige novo envio). Registrar as falhas no audit log.

---

## A-6 — Dependências com vulnerabilidades conhecidas

**Arquivo:** [`package.json`](package.json)
**Comando:** `npm audit --omit=dev` → **19 vulnerabilidades (1 crítica, 10 altas, 6 moderadas, 2 baixas)**

| Pacote | Severidade | Correção |
|---|---|---|
| `seroval` | **Crítica** | `npm audit fix` |
| `undici` | Alta (7 CVEs — bypass de validação TLS, injeção de header, envenenamento de fila de resposta) | `npm audit fix` |
| `vite`, `wrangler`, `miniflare`, `@cloudflare/vite-plugin` | Alta | `npm audit fix` |
| `ws` | Alta (vazamento de memória não inicializada, DoS) | `npm audit fix` |
| `postcss`, `js-yaml`, `sharp` | Alta | `npm audit fix` |
| `xlsx` | Alta (prototype pollution + ReDoS) | **sem correção disponível** |

**Impacto.** `undici` é o cliente HTTP usado nas chamadas aos gateways — as falhas de
validação de TLS e envenenamento de fila de resposta são particularmente ruins nesse
caminho. `xlsx` não tem patch: se ele processa arquivo enviado por usuário, é RCE-adjacente
via prototype pollution.

**Correção sugerida.** Rodar `npm audit fix` (a maioria resolve sem major). Para `xlsx`,
migrar para `exceljs` ou confinar o uso a dados gerados internamente, nunca a upload de
terceiros.

---

# MÉDIO

## M-1 — Estoque é baixado antes de o pagamento ser confirmado

**Arquivos:** [`payment-handler.ts:151-158`](src/lib/api/payment-handler.ts#L151-L158), [`appmax-handler.ts:583-589`](src/lib/api/appmax-handler.ts#L583-L589)

```ts
// payment-handler.ts:151-158
for (const item of body.items) {
  if (item.productId) {
    await db.update(products)
      .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
      .where(eq(products.id, item.productId));
  }
}
```

A dedução acontece na criação da preferência/cobrança, antes de qualquer confirmação. Se o
cliente abandona o checkout ou o pagamento é recusado, o estoque **não é devolvido** — não
há compensação em nenhum caminho de erro nem no webhook de recusa.

**Impacto.** Esgotamento de estoque por abandono normal de carrinho, e negação de serviço
deliberada: basta iniciar checkouts repetidos sem pagar para zerar o estoque da loja.
Note que em `payment-handler.ts:151` o laço itera `body.items` (não `verifiedItems`), então
a quantidade usada é a bruta do cliente.

**Correção sugerida.** Reservar em vez de deduzir (coluna `reserved` com TTL), ou só baixar
quando o webhook confirmar `paid`. Se mantiver a dedução antecipada, implementar devolução
nos eventos de recusa/expiração/cancelamento.

---

## M-2 — `createTenantDb()` ignora o `storeId` — o nome sugere um isolamento que não existe

**Arquivo:** [`src/lib/db/index.ts:42-49`](src/lib/db/index.ts#L42-L49)

```ts
export async function createTenantDb(databaseUrl: string, _storeId: string) {
  return createDb(databaseUrl);
}
export async function createTenantDbTransactional(databaseUrl: string, _storeId: string) {
  return createDbTransactional(databaseUrl);
}
```

Nenhum `SET app.current_store_id`, nenhuma RLS no Postgres, nenhum wrapper de query. É um
alias com um parâmetro descartado.

**Impacto.** Não é uma vulnerabilidade por si, mas é o multiplicador de risco de todas as
outras: dezenas de handlers chamam `createTenantDb(dbUrl, storeId)` e ficam parecendo
seguros por construção, quando na verdade a única barreira é lembrar do
`.where(eq(x.storeId, storeId))` em cada query. Um esquecimento vira vazamento
cross-tenant silencioso — foi exatamente o que aconteceu em M-10.

**Correção sugerida.** Ou implementar de fato (RLS no Neon com `SET LOCAL`), ou renomear
para `createDb` e remover o parâmetro, para que o código pare de sugerir uma garantia
inexistente. A segunda opção é honesta e barata; a primeira é a defesa real.

---

## M-3 — SSRF / varredura de portas pelo teste de impressora

**Arquivo:** [`src/lib/api/print-handler.ts:52-120`](src/lib/api/print-handler.ts#L52-L120)
**Rota:** `POST /api/printers/test-raw` — exige apenas `requireStoreAccess` (qualquer membro da loja)

```ts
// print-handler.ts:55-58
const ip = t.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/);
if (ip)   return { host: ip[1],   port: parseInt(ip[2]   ?? "9100", 10) };
const host = t.match(/^([\w-]+(?:\.[\w-]+)+)(?::(\d+))?$/);
if (host) return { host: host[1], port: parseInt(host[2] ?? "9100", 10) };
```

Aceita qualquer IPv4 (incluindo `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`,
`169.254.169.254`) e qualquer hostname, com **porta arbitrária**. A resposta devolve o
resultado como oráculo:

```ts
// print-handler.ts:117
return new Response(JSON.stringify({ preview, escposB64: b64, sent, error: sendError }), ...)
```

`sent: true` = porta aberta; `error: "Timeout de conexão"` = filtrada; erro de socket =
fechada.

**Impacto.** Qualquer funcionário de qualquer loja usa o Worker como scanner: mapeia hosts
e portas internos e externos a partir da infraestrutura da Cloudflare, com atribuição
apontando para a Armazix. Também escreve bytes controlados (payload ESC/POS) no socket
destino, o que permite tocar protocolos texto simples.

**Correção sugerida.** Bloquear faixas privadas, loopback e link-local após resolução DNS.
Restringir a porta a uma allowlist (9100, 515, 631). Padronizar a mensagem de erro para não
distinguir os casos. Considerar exigir `requireStoreOwner` para essa operação.

---

## M-4 — Rota de diagnóstico temporária ativa em produção

**Arquivos:** [`appmax-handler.ts:189-285`](src/lib/api/appmax-handler.ts#L189-L285), [`api-handler.ts:271`](src/lib/api-handler.ts#L271)

Marcada no próprio código como "TEMPORÁRIO — REMOVER depois". Dispara seis requisições
sequenciais à Appmax e devolve as respostas cruas, incluindo uma variante **sem
`Authorization`**:

```ts
// appmax-handler.ts:278
results.push({ label: v.label, status: res.status, body: text });
```

Também há vazamento de erro bruto do gateway em `startAppmaxConnectHandler`
([`appmax-handler.ts:178`](src/lib/api/appmax-handler.ts#L178)), com o comentário
justificando por ser rota de owner.

**Impacto.** Expõe estrutura interna, comportamento e mensagens de erro da integração para
qualquer owner. Cada chamada gera 6 requisições ao gateway — vetor de abuso/custo e
possível bloqueio por rate limit do lado da Appmax.

**Correção sugerida.** Remover o handler e a entrada de rota.

---

## M-5 — Segredo do webhook Appmax trafega na query string

**Arquivos:** [`webhook-validator.ts:99-132`](src/lib/webhook-validator.ts#L99-L132), [`appmax-handler.ts:770-776`](src/lib/api/appmax-handler.ts#L770-L776)

```ts
// appmax-handler.ts:775
return validateWebhookQueryKey(request, secret).valid || validateWebhookApiKey(request, secret).valid;
```

A URL registrada é `https://.../webhook?key=<WEBHOOK_API_KEY>`. URLs completas são gravadas
em logs de acesso, em observabilidade (o `wrangler.jsonc` liga logs com amostragem 100%),
no painel da Appmax e em qualquer proxy no caminho. O mesmo segredo é compartilhado com o
webhook do Mercado Pago ([`payment-handler.ts:216`](src/lib/api/payment-handler.ts#L216)) —
comprometer um compromete os dois.

**Impacto.** Aumenta muito a superfície de vazamento da chave que é o **único** controle de
acesso do webhook que marca pedidos como pagos (ver C-4).

**Correção sugerida.** Preferir header ou HMAC do corpo. Se a Appmax realmente não permitir,
usar um segredo dedicado (não compartilhado com o MP), rotacioná-lo periodicamente, e
garantir que a query string seja removida antes de qualquer log. E, principalmente,
resolver C-4 — assim a chave deixa de ser o único controle.

---

## M-6 — Cupom não é revalidado na criação do pedido

**Arquivo:** [`src/lib/api/crud-handler.ts:817-829`](src/lib/api/crud-handler.ts#L817-L829)

```ts
const [coupon] = await db.select({ id: coupons.id }).from(coupons)
  .where(and(
    eq(coupons.storeId, body.storeId),
    eq(coupons.code, body.couponCode.toUpperCase()),
    eq(coupons.active, true),
  )).limit(1);
```

Confere apenas `active`. Não valida `expiresAt`, `minOrderValue`, nem limite de usos — todos
verificados em `validatePublicCouponHandler`
([`crud-handler.ts:1558-1565`](src/lib/api/crud-handler.ts#L1558-L1565)), mas essa é apenas
a rota de *preview*. O valor do desconto vem do corpo (`body.discount`, linha 844) e nunca é
comparado com o que o cupom define. `usedCount` é incrementado em background sem checar teto
(linha 967).

**Impacto.** Cupom expirado continua funcionando no pedido real; qualquer desconto pode ser
declarado independentemente da regra do cupom; campanhas com limite de uso podem ser
estouradas. Combinado com C-2, é o mesmo problema por outra porta.

**Correção sugerida.** Extrair a validação de `validatePublicCouponHandler` para uma função
compartilhada e chamá-la em `createOrderHandler`, calculando o desconto no servidor.
Incrementar `usedCount` de forma condicional (`WHERE usedCount < maxUses`) na mesma
transação do pedido.

---

## M-7 — `quantity` nunca é validada

**Arquivos:** [`crud-handler.ts:854-866`](src/lib/api/crud-handler.ts#L854-L866), [`payment-handler.ts:97-105`](src/lib/api/payment-handler.ts#L97-L105), [`appmax-handler.ts:536-544`](src/lib/api/appmax-handler.ts#L536-L544), [`pdv-handler.ts:369-379`](src/lib/api/pdv-handler.ts#L369-L379)

Nenhum caminho verifica que `quantity` é um inteiro positivo. Nos handlers de gateway ela
alimenta diretamente o cálculo:

```ts
// payment-handler.ts:100
return { ...item, unitPrice: dbPrice, total: (parseFloat(dbPrice) * item.quantity).toFixed(2) };
```

E também a operação de estoque (`stock - ${item.quantity}`), onde um valor negativo
**aumenta** o estoque.

**Impacto.** Quantidade negativa gera itens de total negativo, derrubando o total do pedido
mesmo com preço lido do banco — o que contorna a proteção de preço dos handlers de gateway.
Também permite inflar estoque arbitrariamente. Valores enormes causam overflow de `numeric`
e erro 500.

**Correção sugerida.** Validar com Zod (`z.number().int().positive().max(...)`) na entrada
de todos os handlers de pedido — há um `src/lib/validation/schemas.ts` no projeto que já
poderia centralizar isso.

---

## M-8 — Race condition no número sequencial do pedido

**Arquivos:** [`crud-handler.ts:809-813`](src/lib/api/crud-handler.ts#L809-L813), [`payment-handler.ts:108-113`](src/lib/api/payment-handler.ts#L108-L113), [`appmax-handler.ts:546-549`](src/lib/api/appmax-handler.ts#L546-L549), [`pdv-handler.ts:341-345`](src/lib/api/pdv-handler.ts#L341-L345)

```ts
const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(${orders.number}), 0)` })
  .from(orders).where(eq(orders.storeId, body.storeId));
const nextNumber = (Number(maxOrder?.max) || 0) + 1;
```

Leitura e escrita separadas, sem lock. No PDV o `MAX` é calculado **fora** da transação
(linha 341, transação abre na 350). O schema tem apenas um índice comum em `number`, sem
constraint única em `(storeId, number)`
([`schema.ts`, bloco `orders`](src/lib/db/schema.ts)).

**Impacto.** Pedidos simultâneos recebem o mesmo número. Como não há constraint, o banco
aceita silenciosamente — gerando pedidos duplicados na visão do lojista, impressões
trocadas, e conciliação financeira inconsistente. Em horário de pico de delivery isso é
esperado, não hipotético.

**Correção sugerida.** Sequence por loja no Postgres, ou `INSERT ... SELECT COALESCE(MAX)+1`
atômico, mais uma `uniqueIndex` em `(storeId, number)` como rede de segurança.

---

## M-9 — Health-check público da Appmax enumera lojas e escreve no banco

**Arquivo:** [`src/lib/api/appmax-handler.ts:401-440`](src/lib/api/appmax-handler.ts#L401-L440)
**Rota:** `GET /api/payments/appmax-health` — pública ([`api-handler.ts:192`](src/lib/api-handler.ts#L192))

Sem autenticação. Responde `404 not_found` para loja inexistente e `200` com o
`external_id` para loja existente — oráculo de enumeração. Pior, o caminho de sucesso
**grava**:

```ts
// appmax-handler.ts:434
const externalId = store.appmaxExternalId ?? await ensureAppmaxExternalId(db, externalKey);
```

`ensureAppmaxExternalId` faz `UPDATE stores SET appmax_external_id = ...` (linha 296). Além
disso, a query string inteira é logada (linha 412).

**Impacto.** Enumeração de `storeId` válidos e obtenção do `appmaxExternalId` — insumo para
C-3. Escrita não autenticada no banco disparada por requisição anônima. O log da query
string agrava M-5 se a chave passar por ali.

**Correção sugerida.** Validar a origem da chamada (assinatura ou chave dedicada da Appmax).
Nunca gerar o `external_id` nesse endpoint — só lê-lo, gerando exclusivamente no fluxo de
`connect` autenticado. Responder de forma uniforme para loja existente e inexistente.

---

## M-10 — Adições de produto legíveis sem filtro de loja

**Arquivo:** [`src/lib/api/crud-handler.ts:146-158`](src/lib/api/crud-handler.ts#L146-L158)

```ts
const productId = url.searchParams.get("productId");
const fetchAdditions = url.searchParams.get("additions") === "true";
if (productId && fetchAdditions) {
  const additionRows = await db.select().from(productAdditions)
    .where(eq(productAdditions.productId, productId))
    .orderBy(productAdditions.position);
  return new Response(JSON.stringify({ additions: additionRows }), ...);
}
```

Esse ramo executa **antes** da checagem `scope !== "public"` (linha 164) e não filtra por
`storeId`, apesar de o `storeId` ser exigido logo acima (linha 140) e simplesmente ignorado
aqui. Também retorna `select()` completo, sem projeção.

**Impacto.** Vazamento cross-tenant: conhecendo um `productId` de outra loja, obtém-se as
adições e seus preços — exatamente o tipo de furo que M-2 torna fácil de introduzir.
Baixo valor do dado, mas é quebra de isolamento confirmada.

**Correção sugerida.** Adicionar `innerJoin` com `products` filtrando
`products.storeId = storeId`, e mover esse ramo para depois da validação de escopo.

---

## M-11 — Imagens aceitas sem validação de tipo, tamanho ou esquema

**Arquivos:** [`banners-handler.ts:32-53`](src/lib/api/banners-handler.ts#L32-L53), [`crud-handler.ts:62-64`](src/lib/api/crud-handler.ts#L62-L64) e `:110-111`

```ts
// banners-handler.ts:32-34
const imageUrls = (body.imageUrls as unknown[])
  .filter((u) => typeof u === "string" && u.length > 0)
  .slice(0, MAX_BANNERS) as string[];
```

O único critério é "string não vazia". As imagens são convertidas em data URL base64 no
cliente (`readAsDataURL` em [`ImageUploadCrop.tsx:13-16`](src/components/armazix/ImageUploadCrop.tsx#L13-L16),
[`-modal-produto.tsx:69-71`](src/routes/admin/-modal-produto.tsx#L69-L71)) e gravadas em
colunas `text`. Não há verificação de MIME real, limite de bytes, nem restrição de esquema
(`javascript:`, `data:text/html` passam). Produtos não têm sequer limite de quantidade de
imagens.

**Impacto.** Crescimento descontrolado do banco e das respostas da vitrine (a mesma linha
vai para o cache Redis e para o SSR) — degradação de performance e custo. Uma URL com
esquema inesperado que chegue a um contexto de navegação, e não a um `<img>`, vira vetor de
XSS. Path traversal e execução de arquivo não se aplicam (não há filesystem envolvido).

**Correção sugerida.** Validar o prefixo (`data:image/(png|jpeg|webp);base64,` ou `https://`),
impor teto de bytes por imagem e por requisição, e limitar a quantidade por produto. A médio
prazo, migrar para R2/object storage com URL assinada em vez de base64 no banco.

---

## M-12 — Rate limits de `payments` e `sensitive` existem mas nunca são aplicados

**Arquivos:** [`rate-limit.ts:13-27`](src/lib/middleware/rate-limit.ts#L13-L27), [`api-handler.ts:312-322`](src/lib/api-handler.ts#L312-L322)

```ts
// rate-limit.ts:22-24
payments:  { windowMs: 60 * 60 * 1000,  max: 10 },
sensitive: { windowMs: 15 * 60 * 1000,  max: 20 },
```

`rateLimitConfigs` mapeia somente rotas de auth e os quatro webhooks. Nenhuma rota está
associada a `payments` ou `sensitive` — os perfis são código morto.

**Impacto.** `/api/payments/appmax-checkout` (público, com `cardToken`) e
`/api/payments/mp-checkout` caem no limite genérico de 60/min por IP. É folgado demais para
o cenário de *card testing*, que era justamente a intenção declarada do perfil `payments`.
Endpoints sensíveis (`mp-token`, `payment-config`, `change-password`) também ficam sem o
limite mais estrito.

**Correção sugerida.** Mapear as rotas correspondentes em `rateLimitConfigs`.

---

## M-13 — Preço confiado do cliente no PDV

**Arquivo:** [`src/lib/api/pdv-handler.ts:360-363`](src/lib/api/pdv-handler.ts#L360-L363)

```ts
subtotal:      body.subtotal,
deliveryFee:   "0",
discount:      body.discount || "0",
total:         body.total,
```

Mesmo padrão de C-2, mas em rota autenticada de operador.

**Impacto.** Não é exploração externa, é controle interno: um operador com acesso ao PDV
pode registrar a venda por um valor e cobrar outro do cliente, com o caixa fechando certo.
O lançamento financeiro e os totais da sessão (linhas 410-438) herdam o valor manipulado,
então a auditoria não detecta.

**Correção sugerida.** Recalcular a partir de `products.price` dentro da transação, tratando
descontos como um campo explícito e auditado (com limite por perfil de permissão).

---

# BAIXO

## B-1 — CSP permite `unsafe-inline` e `unsafe-eval`

**Arquivos:** [`server.ts:14-25`](src/server.ts#L14-L25), [`security-headers.ts:7-20`](src/lib/middleware/security-headers.ts#L7-L20)

```ts
"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for React
```

Com ambos habilitados, a CSP deixa de ser defesa contra XSS. Há ainda duas CSPs distintas —
a de `server.ts` sobrescreve a de `security-headers.ts` nas rotas de API
([`server.ts:193`](src/server.ts#L193)) — e a de `server.ts` não inclui os domínios da
Appmax em `connect-src`, o que pode quebrar a tokenização de cartão no navegador.

**Correção sugerida.** Adotar nonce ou hash para os scripts inline do SSR e remover
`unsafe-eval` (React em produção não precisa). Unificar numa única definição de CSP e
incluir os domínios Appmax necessários.

---

## B-2 — Payload completo do webhook, com PII, gravado no audit log

**Arquivo:** [`src/lib/api/appmax-handler.ts:720-767`](src/lib/api/appmax-handler.ts#L720-L767)

```ts
details: { payload },
```

Ocorre nos três caminhos (pedido não encontrado, evento não mapeado, sucesso). O payload da
Appmax carrega dados do cliente — nome, e-mail, telefone e `document_number` (CPF). Como a
tabela `audit_logs` é append-only por trigger, esses dados **não podem ser apagados** sem
alterar o trigger, o que conflita com o direito de eliminação da LGPD.

**Correção sugerida.** Gravar apenas os campos necessários (`event`, `order.id`, `status`) ou
aplicar máscara antes de persistir.

---

## B-3 — CPF de toda a equipe visível para qualquer membro da loja

**Arquivo:** [`src/lib/api/user-handler.ts:35-52`](src/lib/api/user-handler.ts#L35-L52)

```ts
cpf: users.cpf,
```

O handler exige apenas `requireStoreAccess` — um operador ou vendedor vê o CPF, telefone e
e-mail de todos os colegas, incluindo o do proprietário.

**Correção sugerida.** Retornar CPF apenas para `owner`/`admin`, ou mascarado
(`***.456.789-**`) para os demais perfis.

---

## B-4 — Rate limit falha em aberto e descarta os headers gerados

**Arquivos:** [`rate-limit.ts:47-64`](src/lib/middleware/rate-limit.ts#L47-L64), [`api-handler.ts:339-343`](src/lib/api-handler.ts#L339-L343)

Se o Redis estiver fora, cai no `Map` em memória — que no Cloudflare Workers é **por
isolate**. Com dezenas de isolates ativos, o limite efetivo de login vira 5 × N em vez de 5.
Além disso, `rateLimit()` monta `headers` com `X-RateLimit-*`, mas `handleApiRequest` só usa
`allowed` e `retryAfter` — os headers nunca chegam ao cliente nas respostas bem-sucedidas.

**Correção sugerida.** Para as rotas de auth, considerar falhar fechado quando o Redis
estiver indisponível. Propagar os headers de rate limit na resposta.

---

## B-5 — E-mail registrado no audit log em falha de login

**Arquivo:** [`src/lib/api/auth/login-handler.ts:25-31`](src/lib/api/auth/login-handler.ts#L25-L31)

```ts
details: { email },
```

Grava o e-mail digitado quando o usuário não existe. Como é entrada livre, um atacante pode
poluir a tabela com conteúdo arbitrário, e e-mails de terceiros acabam persistidos
indefinidamente numa tabela imutável.

**Correção sugerida.** Registrar apenas um hash do e-mail, ou só o domínio.

---

# OBSERVAÇÕES

**O-1 — Histórico do git está limpo.** Varredura completa (`git log --all -p`) por tokens
Mercado Pago (`APP_USR-`, `TEST-`), connection strings do Neon, chaves Resend (`re_`) e JWTs
não encontrou nenhum segredo real. O `.env` local não é rastreado. O `.env.example` **está**
rastreado apesar de constar no `.gitignore` (foi adicionado antes da regra), mas contém
apenas placeholders — sem risco.

**O-2 — Injeção de SQL: nenhuma ocorrência.** Todo acesso usa Drizzle com template literals
parametrizados. `sql.raw` não aparece em lugar nenhum. As interpolações em `sql\`\`` são
parâmetros ligados, não concatenação. Nada a corrigir.

**O-3 — Derivação da chave de criptografia.** [`crypto.ts:7-21`](src/lib/crypto.ts#L7-L21)
deriva a chave AES com um SHA-256 simples da `ENCRYPTION_KEY`, sem KDF nem salt. Funciona,
mas não protege contra força bruta se a chave configurada tiver baixa entropia. AES-256-GCM,
IV de 12 bytes aleatório por operação e o formato IV+ciphertext estão corretos. Considerar
HKDF ou PBKDF2 na derivação.

**O-4 — Nenhum dado de cartão trafega ou é persistido.** Confirmado: só `cardToken`
(tokenização do lado da Appmax, [`appmax-handler.ts:475`](src/lib/api/appmax-handler.ts#L475))
e `mpPublicKey`. Não há PAN, CVV ou validade em nenhum lugar do schema, dos handlers ou dos
logs. Conforme com PCI-DSS SAQ-A nesse aspecto.

**O-5 — CORS não configurado.** Nenhum header `Access-Control-Allow-*` em lugar nenhum —
a política padrão de mesma origem se aplica. Não há wildcard em endpoint autenticado. Nada
a corrigir, mas vale saber que integrações externas via navegador não funcionarão sem
mudança explícita.

**O-6 — Higiene de código.** (a) `Expect-CT` ([`server.ts:39`](src/server.ts#L39)) está
obsoleto desde 2021 e é ignorado pelos navegadores. (b) `X-Powered-By: ""`
([`server.ts:41`](src/server.ts#L41)) nunca é aplicado, porque a linha 62 filtra valores
vazios — inofensivo, mas o header também não estava sendo enviado antes. (c)
`getRequestBodyStoreId` ([`api-handler.ts:324-328`](src/lib/api-handler.ts#L324-L328)) e
`getStoreIdFromRequest` ([`middleware/auth.ts:160-163`](src/lib/middleware/auth.ts#L160-L163))
são funções mortas que só retornam `null`. (d) `mock-login` está corretamente travado por
`NODE_ENV !== "development"` e falha fechado.

**O-7 — Pontos positivos.** Vale registrar o que está bem feito: hash de senha com PBKDF2-SHA-256
de 100k iterações e comparação em tempo constante; política de senha razoável; JWT com
`storeId` embutido e nunca lido do cliente; separação entre JWT de admin e de cliente com
verificação de `role`; CSRF double-submit com `SameSite=Strict`; webhooks de assinatura com
HMAC real e guarda de idempotência ([`subscription-handler.ts:362-366`](src/lib/api/subscription-handler.ts#L362-L366));
audit log imutável por trigger; e a maioria dos handlers já resolve o tenant por
`requireStoreAccess(auth)`. A base está sólida — os achados críticos são pontos específicos
que escaparam do padrão, não uma falha estrutural generalizada.

---

# Resumo executivo — prioridade de correção

| Prioridade | Achado | Por quê primeiro |
|---|---|---|
| **1º** | **C-5** — escalada cross-tenant via convite + troca de senha | Tomada de conta de qualquer lojista por qualquer cliente pagante. Explorável hoje, sem pré-requisito nenhum, com dois requests. |
| **2º** | **C-1** — reset de senha global | Tomada de conta remota e não autenticada. Exige força bruta, mas o espaço é pequeno e o alvo é a plataforma inteira. |
| **3º** | **C-3 + C-4** — sequestro de credenciais e webhook Appmax sem verificação | Desvio de receita e liberação de mercadoria sem pagamento. Corrigir juntos: são o mesmo fluxo. |
| **4º** | **C-2** — preço do pedido vindo do cliente | Prejuízo financeiro direto e trivial de explorar (`total: "0.01"`). A correção já existe pronta nos handlers de gateway — é replicar. |
| **5º** | **A-1** — vitrine pública expondo credenciais e CNPJ | Alimenta C-3, expõe ciphertext de todos os gateways e viola LGPD. Correção pequena: trocar exclusão por allowlist. |

**Rápidos e de alto retorno** (fazer junto com os cinco acima): remover a rota `appmax-diagnose`
(**M-4**, uma linha), mapear os rate limits de `payments`/`sensitive` (**M-12**, cinco linhas),
e rodar `npm audit fix` (**A-6**).

**Sobre A-3:** vale verificar em produção se os pedidos pagos via Mercado Pago estão de fato
saindo de `pending`. Se não estiverem, o webhook está 100% quebrado desde sempre e isso é um
problema de negócio ativo, não só de segurança.
