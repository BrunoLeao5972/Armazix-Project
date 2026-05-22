# Armazix

Plataforma SaaS multi-tenant para gestão de lojas, delivery e e-commerce. Cada comerciante cria e gerencia sua própria loja, com painel administrativo completo, vitrine pública e integração de pagamentos via Mercado Pago.

**Deploy:** https://armazix.brunoleao5972.workers.dev

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Técnico](#stack-técnico)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados](#banco-de-dados)
- [API](#api)
- [Autenticação e Segurança](#autenticação-e-segurança)
- [Planos e Pagamentos](#planos-e-pagamentos)
- [Módulos do Painel Admin](#módulos-do-painel-admin)
- [Vitrine Pública](#vitrine-pública)
- [Fluxo de Registro](#fluxo-de-registro)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Comandos](#comandos)
- [Deploy](#deploy)

---

## Visão Geral

O Armazix é um SaaS onde:
- Comerciantes se registram, criam sua loja e gerenciam tudo pelo painel `/admin`
- Clientes acessam a vitrine da loja em `/store/:slug` para navegar produtos e fazer pedidos
- Cada loja é completamente isolada (multi-tenancy por `storeId` validado via JWT)
- Pagamentos são processados pelo Mercado Pago (checkout, assinaturas, PIX)

---

## Stack Técnico

| Camada | Tecnologia |
|--------|-----------|
| **Framework** | TanStack Start (React SSR / Edge) |
| **Runtime** | Cloudflare Workers |
| **Banco de Dados** | PostgreSQL via Neon (serverless) |
| **ORM** | Drizzle ORM |
| **Autenticação** | JWT (`jose`) + Cookie HTTP-only (`armazix_token`) |
| **Pagamentos** | Mercado Pago (checkout, assinaturas, PIX) |
| **UI** | React 19 + TailwindCSS v4 + shadcn/ui + Radix UI |
| **Animações** | Framer Motion |
| **Ícones** | Lucide React |
| **Gráficos** | Recharts |
| **E-mail** | Resend |
| **Validação** | Zod |
| **Forms** | React Hook Form |
| **Testes** | Vitest |
| **Build** | Vite 7 |

---

## Estrutura do Projeto

```
src/
├── routes/                      # Páginas (TanStack Router - file-based)
│   ├── index.tsx                # Landing page (home)
│   ├── login.tsx                # Login
│   ├── register.tsx             # Registro de conta (6 passos)
│   ├── forgot-password.tsx      # Recuperação de senha
│   ├── reset-password.tsx       # Reset de senha
│   ├── verify-email.tsx         # Verificação de e-mail
│   ├── admin.tsx                # Layout do painel admin
│   ├── admin/
│   │   ├── dashboard.tsx        # Dashboard com métricas
│   │   ├── products.tsx         # Gestão de produtos
│   │   ├── categories.tsx       # Gestão de categorias
│   │   ├── orders.tsx           # Gestão de pedidos
│   │   ├── customers.tsx        # Gestão de clientes
│   │   ├── stock.tsx            # Controle de estoque
│   │   ├── financial.tsx        # Financeiro
│   │   ├── reports.tsx          # Relatórios
│   │   ├── coupons.tsx          # Cupons de desconto
│   │   ├── delivery.tsx         # Gestão de entregas
│   │   ├── pdv.tsx              # Ponto de Venda (PDV)
│   │   └── settings.tsx         # Configurações da loja
│   └── store/                   # Vitrine pública
│       └── [slug].tsx           # Página da loja por slug
│
├── components/
│   ├── ui/                      # shadcn/ui components
│   └── armazix/                 # Componentes da landing page
│       ├── Hero.tsx
│       ├── Navbar.tsx
│       ├── Pricing.tsx
│       ├── CTA.tsx
│       └── ...
│
├── lib/
│   ├── api-handler.ts           # Router de API (registro de rotas)
│   ├── api-client.ts            # Cliente HTTP do frontend
│   ├── db/
│   │   ├── schema.ts            # Schema completo do banco (Drizzle)
│   │   └── index.ts             # Conexão com Neon
│   ├── api/
│   │   ├── auth/                # Handlers de autenticação
│   │   ├── store-handler.ts     # Handler da loja / dashboard
│   │   ├── stock-handler.ts     # Handler de estoque, relatórios, etc.
│   │   ├── crud-handler.ts      # CRUD de produtos, pedidos, clientes
│   │   ├── payment-handler.ts   # Mercado Pago checkout e webhook
│   │   ├── subscription-handler.ts # Assinaturas e PIX
│   │   └── with-auth-handler.ts # Wrapper de autenticação para handlers
│   ├── auth/
│   │   └── require-store-access.ts # Validação de acesso ao tenant
│   ├── middleware/
│   │   ├── auth.ts              # Middleware de autenticação JWT
│   │   ├── csrf.ts              # Proteção CSRF
│   │   ├── rate-limit.ts        # Rate limiting por IP/rota
│   │   └── security-headers.ts  # Headers de segurança HTTP
│   ├── security/
│   │   └── tenant-guard.ts      # Detecção de tentativas de IDOR
│   ├── audit/
│   │   └── logger.ts            # Log de auditoria (LGPD)
│   └── validation/
│       └── schemas.ts           # Schemas Zod de validação
│
└── server.ts                    # Entry point do servidor SSR
```

---

## Banco de Dados

Schema PostgreSQL gerenciado com Drizzle ORM. Todas as tabelas de negócio possuem `store_id` para isolamento de tenant.

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema (merchants, admins) |
| `sessions` | Sessões ativas com token JWT |
| `verification_codes` | Códigos de verificação de e-mail / reset de senha |
| `stores` | Lojas criadas pelos merchants |
| `store_users` | Relação usuário ↔ loja com papel (owner, admin, cashier) |
| `categories` | Categorias de produtos por loja |
| `products` | Produtos com estoque, preço, imagem, adicionais |
| `product_additions` | Adicionais/complementos de produtos |
| `banners` | Banners da vitrine da loja |
| `coupons` | Cupons de desconto por loja |
| `customers` | Clientes de cada loja |
| `addresses` | Endereços dos clientes |
| `orders` | Pedidos (delivery ou retirada) |
| `order_items` | Itens de cada pedido (snapshot do produto) |
| `order_timeline` | Histórico de status de cada pedido |
| `favorites` | Produtos favoritos dos clientes |
| `reviews` | Avaliações de produtos |
| `audit_logs` | Logs de auditoria para segurança e LGPD |

### Planos da Loja (`stores.plan`)

| Plano | Valor | Descrição |
|-------|-------|-----------|
| `free` | R$ 0/mês | Funcionalidades básicas |
| `start` | R$ 47/mês | Crescimento |
| `pro` | R$ 97/mês | Profissional |
| `full` | R$ 197/mês | Completo |

---

## API

A API é um router centralizado em `src/lib/api-handler.ts`. Todas as rotas seguem o padrão `/api/...`.

### Rotas Públicas

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/register` | Cadastro de novo usuário |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/forgot-password` | Solicitar reset de senha |
| `POST` | `/api/auth/reset-password` | Confirmar reset de senha |
| `POST` | `/api/auth/verify-email` | Verificar e-mail |
| `POST` | `/api/auth/resend-verification` | Reenviar código de verificação |
| `GET` | `/api/auth/check-email` | Verificar se e-mail existe |
| `GET` | `/api/auth/refresh-csrf` | Obter novo token CSRF |
| `GET` | `/api/store/get` | Dados públicos de uma loja (por id ou slug) |
| `GET` | `/api/store/check-slug` | Verificar disponibilidade de slug |
| `GET` | `/api/validate-cep` | Consultar endereço por CEP (ViaCEP) |
| `GET` | `/api/products/list` | Listar produtos de uma loja (vitrine) |
| `GET` | `/api/categories/list` | Listar categorias de uma loja (vitrine) |
| `POST` | `/api/orders/create` | Criar pedido (checkout da vitrine) |
| `POST` | `/api/payments/mp-webhook` | Webhook do Mercado Pago |
| `POST` | `/api/subscriptions/mp-webhook` | Webhook de assinaturas |
| `POST` | `/api/subscriptions/pix-webhook` | Webhook PIX avulso |

### Rotas Protegidas (requerem JWT)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/store/user` | Loja do usuário autenticado |
| `GET` | `/api/dashboard/stats` | Métricas do dashboard |
| `GET` | `/api/dashboard/charts` | Dados dos gráficos |
| `GET` | `/api/stock/stats` | Estatísticas de estoque |
| `GET` | `/api/reports/stats` | Relatórios |
| `GET` | `/api/financial/stats` | Financeiro |
| `GET` | `/api/delivery/orders` | Pedidos de entrega |
| `GET` | `/api/orders/list` | Listar pedidos (admin) |
| `GET` | `/api/customers/list` | Listar clientes |
| `GET` | `/api/coupons/list` | Listar cupons |
| `GET` | `/api/store/business-hours` | Horários de funcionamento |
| `GET` | `/api/user/get` | Dados do usuário autenticado |
| `GET` | `/api/subscriptions/status` | Status da assinatura |
| `POST` | `/api/store/update` | Atualizar dados da loja |
| `POST` | `/api/store/update-address` | Atualizar endereço |
| `POST` | `/api/store/update-business-hours` | Atualizar horários |
| `POST` | `/api/store/update-slug` | Alterar slug da loja |
| `POST` | `/api/products/create` | Criar produto |
| `POST` | `/api/products/update` | Atualizar produto |
| `POST` | `/api/products/delete` | Deletar produto |
| `POST` | `/api/categories/create` | Criar categoria |
| `POST` | `/api/categories/delete` | Deletar categoria |
| `POST` | `/api/orders/update-status` | Atualizar status do pedido |
| `POST` | `/api/coupons/create` | Criar cupom |
| `POST` | `/api/customers/create` | Criar cliente |
| `POST` | `/api/user/update-data` | Atualizar nome/avatar |
| `POST` | `/api/user/update-password` | Alterar senha |
| `POST` | `/api/user/send-email-code` | Enviar código de troca de e-mail |
| `POST` | `/api/user/verify-email-change` | Confirmar troca de e-mail |
| `POST` | `/api/payments/mp-checkout` | Criar checkout Mercado Pago |
| `POST` | `/api/payments/mp-token` | Salvar token MP da loja |
| `POST` | `/api/subscriptions/create` | Criar assinatura de plano |
| `POST` | `/api/subscriptions/create-pix` | Criar pagamento PIX avulso |

---

## Autenticação e Segurança

### Fluxo de Autenticação

1. **Login** → senha verificada com `bcryptjs` → JWT assinado com `jose` → salvo em cookie HTTP-only `armazix_token`
2. **Cada request protegido** → middleware `requireAuth` lê e valida o JWT → extrai `{ userId, storeId, role }` do token
3. **Isolamento de tenant** → `requireStoreAccess(auth)` valida no banco se o usuário tem acesso à loja (`storeUsers`)
4. **Logout** → cookie é removido + sessão invalidada no banco

### Camadas de Segurança

| Mecanismo | Descrição |
|-----------|-----------|
| **JWT HTTP-only Cookie** | Token não acessível por JavaScript, expiração configurável |
| **CSRF Token** | Cookie duplo (`csrf_token`) validado em todas as rotas POST protegidas |
| **Rate Limiting** | Limite por IP por tipo de rota (auth: mais restrito, api: geral) |
| **Security Headers** | `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc. |
| **Zero Trust IDOR** | `storeId` **nunca** é lido de query params, body ou URL — sempre extraído do JWT |
| **Tenant Guard** | `tenant-guard.ts` detecta e bloqueia tentativas de IDOR em tempo real |
| **requireStoreAccess** | Validação no banco de dados que o usuário pertence à loja antes de qualquer operação |
| **Audit Logs** | Todas as ações sensíveis são registradas na tabela `audit_logs` (LGPD) |
| **bcryptjs** | Senhas armazenadas com hash bcrypt (nunca em texto claro) |
| **Webhook Validation** | Validação de assinatura HMAC nos webhooks do Mercado Pago |

### Modelo de Roles

| Role | Acesso |
|------|--------|
| `admin` | Acesso a todas as lojas do sistema |
| `merchant` | Acesso apenas às suas próprias lojas |
| `owner` | Papel dentro de uma loja específica |
| `cashier` | Papel com acesso restrito dentro de uma loja |

---

## Planos e Pagamentos

### Integração Mercado Pago

- **Checkout**: Criação de preferência de pagamento e redirecionamento para MP
- **Assinaturas**: Planos mensais recorrentes (`start`, `pro`, `full`)
- **PIX**: Pagamento avulso via QR Code
- **Webhooks**: Validados por HMAC — atualizam status do pedido/plano automaticamente

### Fluxo de Assinatura

```
Usuário seleciona plano → POST /api/subscriptions/create
→ MP cria preferência → retorna initPoint (URL de pagamento)
→ Usuário paga no MP
→ Webhook MP → POST /api/subscriptions/mp-webhook
→ Status da loja atualizado (stores.plan, stores.planStatus)
```

### Fluxo de Pedido

```
Cliente adiciona ao carrinho (vitrine) → POST /api/orders/create
→ Pedido criado com status "received"
→ Loja recebe notificação (dashboard)
→ Admin atualiza status: received → preparing → ready → delivering → delivered
→ POST /api/orders/update-status (protegido)
```

---

## Módulos do Painel Admin

Acessível em `/admin` após login autenticado.

| Módulo | Rota | Funcionalidade |
|--------|------|----------------|
| **Dashboard** | `/admin/dashboard` | Métricas de vendas, pedidos, receita, gráficos |
| **Produtos** | `/admin/products` | CRUD de produtos, categorias, estoque, imagens |
| **Pedidos** | `/admin/orders` | Listagem e atualização de status dos pedidos |
| **Clientes** | `/admin/customers` | Listagem e cadastro de clientes |
| **Estoque** | `/admin/stock` | Controle de estoque, alertas de baixo estoque |
| **Financeiro** | `/admin/financial` | Receitas, despesas, relatórios financeiros |
| **Relatórios** | `/admin/reports` | Relatórios analíticos detalhados |
| **Cupons** | `/admin/coupons` | Criação e gestão de cupons de desconto |
| **Entregas** | `/admin/delivery` | Gestão de pedidos de entrega em tempo real |
| **PDV** | `/admin/pdv` | Ponto de Venda presencial |
| **Configurações** | `/admin/settings` | Dados da loja, endereço, horários, plano, Mercado Pago |

---

## Vitrine Pública

Acessível em `/store/:slug` (sem autenticação).

**Funcionalidades:**
- Listagem de produtos por categoria
- Busca de produtos
- Carrinho de compras
- Checkout com escolha de entrega/retirada
- Integração com Mercado Pago (pagamento online)
- Suporte a cupons de desconto
- Favoritos e avaliações
- Banners promocionais customizáveis

---

## Fluxo de Registro

O registro é feito em **6 passos** em `/register`:

| Passo | Nome | Campos |
|-------|------|--------|
| 1 | Identificação | Nome completo, e-mail, telefone, senha |
| 2 | Sua Loja | Nome da loja, telefone da loja, cor primária |
| 3 | Dados Fiscais | CNPJ |
| 4 | Endereço | CEP (auto-complete), rua, número, complemento, bairro, cidade, estado |
| 5 | Plano | Seleção de plano (Grátis / Start / Pro / Full) + redirecionamento para pagamento |
| 6 | Pronto! | Conta criada, redirecionamento para o painel |

---

## Variáveis de Ambiente

Configure no painel do Cloudflare Workers ou em `.dev.vars` para desenvolvimento local.

```env
# Banco de Dados
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# JWT
JWT_SECRET=chave-secreta-jwt-minimo-32-caracteres

# Criptografia
ENCRYPTION_KEY=chave-aes-256-hex

# Resend (e-mail transacional)
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=noreply@armazix.com.br

# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxx
MP_WEBHOOK_SECRET=chave-hmac-webhook

# Cloudflare
NODE_ENV=production
```

---

## Comandos

```bash
# Desenvolvimento local
bun run dev         # ou: npm run dev

# Build para produção
npm run build

# Deploy para Cloudflare Workers
npm run deploy

# Banco de dados
npm run db:generate   # Gerar migrações
npm run db:migrate    # Aplicar migrações
npm run db:push       # Push direto (dev)
npm run db:studio     # Interface visual do banco

# Testes
npm run test                # Todos os testes
npm run test:security       # Testes de segurança (IDOR, autenticação)

# Qualidade de código
npm run lint
npm run format
```

---

## Deploy

O projeto é implantado como um **Cloudflare Worker** (edge computing).

```bash
# Instalar Wrangler
npm install -g wrangler

# Autenticar no Cloudflare
wrangler login

# Deploy
npm run deploy
```

**URL de produção:** `https://armazix.brunoleao5972.workers.dev`

**Configuração** em `wrangler.toml`:
- Worker name: `armazix`
- Variáveis de ambiente via painel Cloudflare ou `wrangler secret put`

---

## Arquitetura Resumida

```
Browser
  │
  ├─► GET /admin/* ──► TanStack Start SSR ──► React (Client)
  │
  ├─► GET /store/:slug ──► TanStack Start SSR ──► React (Client)
  │
  └─► /api/* ──► handleApiRequest()
                    │
                    ├─ Rate Limiting
                    ├─ CSRF Validation (POST protegidas)
                    ├─ JWT Authentication → auth.storeId
                    ├─ requireStoreAccess() → DB check
                    └─ Handler específico → PostgreSQL (Neon)
```

---

## Licença

Projeto privado — todos os direitos reservados.
