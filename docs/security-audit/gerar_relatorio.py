# -*- coding: utf-8 -*-
"""
Gerador do Relatório de Auditoria de Segurança — Armazix.

Regenerar depois de uma nova auditoria:
    docs/security-audit/.venv/Scripts/python.exe docs/security-audit/gerar_relatorio.py

Saída: docs/security-audit/relatorio-auditoria-seguranca.pdf
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Image, KeepTogether, PageBreak, HRFlowable, NextPageTemplate, FrameBreak,
)
from reportlab.pdfgen import canvas as pdfcanvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PDF = os.path.join(HERE, "relatorio-auditoria-seguranca.pdf")
ASSETS = os.path.join(HERE, "_assets")
os.makedirs(ASSETS, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────
# Paleta
# ─────────────────────────────────────────────────────────────────────────
COR_CRITICA = "#B91C1C"
COR_ALTA = "#EA580C"
COR_MEDIA = "#D97706"
COR_BAIXA = "#2563EB"
COR_FORTE = "#059669"
COR_INK = "#111827"
COR_MUTED = "#6B7280"
COR_BORDER = "#E5E7EB"
COR_BG_SOFT = "#F8FAFC"
COR_NAVY = "#0F172A"
COR_ACCENT = "#0EA5E9"

SEVERITY_COLOR = {
    "Crítica": COR_CRITICA,
    "Alta": COR_ALTA,
    "Média": COR_MEDIA,
    "Baixa": COR_BAIXA,
    "Informativa": COR_FORTE,
}

# ─────────────────────────────────────────────────────────────────────────
# Dados da auditoria
# ─────────────────────────────────────────────────────────────────────────

STACK = {
    "linguagem": "TypeScript",
    "runtime": "Cloudflare Workers (edge), compilado com Vite",
    "framework": "TanStack Start (React 19) + TanStack Router — SSR/SPA híbrido",
    "orm": "Drizzle ORM sobre PostgreSQL (Neon, driver serverless HTTP + WebSocket Pool)",
    "auth": "JWT próprio (jose, HS256) + cookie HttpOnly/Secure/SameSite=Strict; senha via PBKDF2-SHA-256 (bcryptjs como fallback legado)",
    "frontend": "React + Tailwind CSS + Radix UI, mesma base TanStack Start do backend (rotas de arquivo)",
    "deploy": "Cloudflare Workers via Wrangler (wrangler.jsonc) — sem Docker/Helm/Terraform em produção; docker-compose.dev.yml só para Redis local de desenvolvimento",
    "cache": "Upstash Redis (REST, opcional — fail-safe para o banco se ausente)",
    "pagamento": "Mercado Pago (checkout de assinatura da plataforma + checkout de pedidos por loja)",
}

METODOLOGIA = [
    ("Banco sem tranca (isolamento de tenant)",
     "Não é Supabase/RLS-first: o projeto usa Postgres via Drizzle com DOIS mecanismos "
     "coexistindo — filtro manual eq(storeId) em cada query (padrão dominante) e Row "
     "Level Security real do Postgres via role restrita armazix_tenant + "
     "set_config('app.current_store_id', …) dentro de transações explícitas (padrão "
     "usado nos fluxos mais críticos: criação de pedido, mudança de status, fechamento "
     "de encomenda no PDV, aplicação de resultado de pagamento). Auditado verificando "
     "se toda query de listagem/agregação/relatório inclui o filtro por storeId "
     "derivado do JWT."),
    ("Permissão definida no navegador",
     "Cruzamento manual entre os gates de UI do painel admin (checagens de role/"
     "permissão em componentes e rotas) e o handler de backend correspondente, "
     "verificando se este último reexecuta uma checagem equivalente (requireStoreAccess "
     "vs. requireStoreOwner vs. nenhuma checagem de papel)."),
    ("IDOR",
     "Todos os 35 arquivos de handler em src/lib/api (167 funções exportadas, "
     "mapeadas 1:1 às ~150 rotas registradas em src/lib/api-handler.ts) foram "
     "percorridos, com atenção a toda operação que recebe um ID por path, query ou "
     "corpo e o usa numa cláusula WHERE, SELECT, UPDATE ou DELETE."),
    ("Chaves expostas",
     "Grep por padrões de segredo (chaves/tokens/senhas hardcoded, prefixos "
     "conhecidos de provedores) em todo o código-fonte, arquivos de config "
     "(wrangler.jsonc, .env.example, docker-compose.dev.yml) e em todo o histórico "
     "git (git log -p -S) — não só o HEAD atual."),
    ("Inputs sem tratamento (XSS)",
     "Grep por dangerouslySetInnerHTML/innerHTML/eval/new Function no frontend, "
     "inspeção de todo href/src dinâmico, e leitura de todos os templates de HTML "
     "gerados no backend (e-mails transacionais) em busca de interpolação de dado "
     "de usuário sem escape."),
]

STRENGTHS = [
    ("IDOR — padrão \"verificar-antes-de-agir\" consistente",
     "src/lib/api/crud-handler.ts (produtos, categorias, pedidos, cupons, clientes) e "
     "praticamente todos os outros handlers de escrita confirmam posse do registro "
     "(and(eq(id), eq(storeId))) antes de UPDATE/DELETE, com comentário \"// IDOR Fix\" "
     "explícito em cada ponto. Nenhuma exceção real encontrada em ~20 handlers lidos "
     "linha a linha."),
    ("storeId nunca sai do corpo/query em rota protegida",
     "src/lib/api-handler.ts:421-425 — getRequestBodyStoreId() sempre retorna null, "
     "com comentário reforçando que o storeId vem só do JWT. requireStoreAccess() "
     "(src/lib/auth/require-store-access.ts) é a única fonte de verdade e sempre "
     "confere a tabela storeUsers no banco."),
    ("Webhooks de pagamento nunca confiam no corpo recebido",
     "src/lib/api/payment-handler.ts (mp-webhook) e src/lib/api/subscription-handler.ts "
     "(pix/assinatura) sempre buscam o pagamento real na API do Mercado Pago com o "
     "token da própria loja, cross-checam storeId, moeda e valor pago ≥ devido, e são "
     "idempotentes (não reprocessam o mesmo payment id, não fazem downgrade de "
     "\"paid\")."),
    ("Escrita em identidade global de usuário multi-loja",
     "src/lib/api/user-handler.ts — checkMember()/exclusive bloqueia um dono de loja "
     "de alterar senha/dados globais de um funcionário que também atua em outra loja, "
     "cobrindo um caso de tenant-isolation que a maioria dos produtos SaaS nem "
     "considera."),
    ("Senhas e sessão",
     "PBKDF2-SHA-256 (100k iterações) com fallback bcrypt só para hashes legados, "
     "comparação em tempo constante, política de senha forte, sessionVersion "
     "incrementado a cada troca de senha/desativação (derruba sessões já emitidas "
     "na hora, não só bloqueia login novo)."),
    ("Segredos de aplicação",
     "requireJwtSecret() e toda leitura de ENCRYPTION_KEY falham explicitamente "
     "(erro 500 visível) se a variável não estiver configurada — nenhum fallback "
     "default silencioso encontrado em nenhum dos dois."),
    ("Nenhum segredo real no código-fonte ou no histórico git",
     ".env nunca foi commitado (confirmado via git log --all); .env.example só tem "
     "placeholders (senha, seu_token_upstash_aqui, etc.); wrangler.jsonc não grava "
     "nenhum valor sensível, só documenta quais secrets configurar via "
     "wrangler secret put."),
    ("Convites de equipe",
     "src/lib/api/store-invite-handler.ts — token hasheado antes de gravar/comparar "
     "no banco (nunca em texto puro), de uso único (acceptedAt) e expira em 7 dias."),
    ("mock-login isolado de produção",
     "src/lib/api/auth/mock-login-handler.ts retorna 404 quando NODE_ENV !== "
     "\"development\"; NODE_ENV é fixado \"production\" em wrangler.jsonc (vars), "
     "um valor de deploy, não algo que uma requisição possa influenciar."),
    ("XSS — nenhuma superfície viva encontrada",
     "Nenhuma lib de markdown no projeto. Os 2 únicos dangerouslySetInnerHTML do "
     "repositório são: (a) components/ui/chart.tsx — componente shadcn não importado "
     "em lugar nenhum do app (código morto); (b) __root.tsx — script de tema 100% "
     "estático, sem interpolação de dado de usuário. Todo href dinâmico voltado a "
     "WhatsApp/Maps usa esquema fixo https:// com dado normalizado (só dígitos no "
     "telefone)."),
    ("Gestão de perfis de acesso",
     "src/lib/api/permissions-handler.ts usa requireStoreOwner (não só "
     "requireStoreAccess) nas 4 rotas, e faz allowlist explícita das chaves de "
     "permissão aceitas — o corpo da requisição nunca grava uma chave desconhecida."),
]

# ─────────────────────────────────────────────────────────────────────────
# Achados
# ─────────────────────────────────────────────────────────────────────────
# categoria usada só para agrupamento visual na tabela detalhada.
FINDINGS = [
    {
        "id": "F1",
        "titulo": "SSRF autenticado no teste de impressora de rede",
        "categoria": "Achado adicional (fora das 5 categorias — rede/SSRF)",
        "severidade": "Alta",
        "arquivo": "src/lib/api/print-handler.ts",
        "linhas": "65–120 (núcleo: 104–107)",
        "trecho": (
            "export async function printRawTestHandler(request, auth) {\n"
            "  try { await requireStoreAccess(auth); } catch (error) { … }\n"
            "  const body = await request.json(); // { path, columns?, type?, layout? }\n"
            "  …\n"
            "  const net = parseNetworkPath(body.path.trim());\n"
            "  if (net) {\n"
            "    await sendViaTcp(net.host, net.port, escpos); // conecta em QUALQUER host:porta\n"
            "  }"
        ),
        "descricao": (
            "POST /api/printers/test-raw aceita qualquer usuário autenticado com acesso "
            "a QUALQUER loja (requireStoreAccess não distingue papel — um \"operador\" "
            "serve). body.path é validado só quanto ao formato (IPv4 ou hostname com "
            "ponto) — não quanto ao destino: não há bloqueio de IPs privados/loopback/"
            "link-local nem allowlist de hosts. O servidor então abre uma conexão TCP "
            "bruta (via net.createConnection, habilitado pelo compatibility_flags "
            "nodejs_compat do Worker) para esse host:porta e escreve os bytes de um "
            "cupom ESC/POS de amostra."
        ),
        "porque_exploravel": (
            "Um usuário autenticado com qualquer papel na loja (o menor privilégio já "
            "serve) pode fazer o backend do Armazix abrir conexões TCP para endereços "
            "arbitrários — inclusive faixas internas (10.0.0.0/8, 169.254.169.254, "
            "etc.) — e observar no campo `error`/`sent` da resposta se a conexão "
            "conectou, deu timeout (5s) ou foi recusada. Isso é um oráculo clássico de "
            "SSRF/port-scan: dá para varrer a rede que o Worker enxerga, uma porta por "
            "chamada, até 60 vezes por minuto (tier de rate limit \"api\" padrão, já "
            "que esta rota não tem uma entrada específica em rateLimitConfigs). O mesmo "
            "primitivo é alcançável em dois passos por printers.ts: criar uma "
            "impressora com path arbitrário (createPrinterHandler não valida o campo "
            "path) e depois chamar /api/printers/print-test ou /api/printers/print-"
            "order com send:true."
        ),
        "condicoes": (
            "Requer apenas uma sessão autenticada com acesso a alguma loja (qualquer "
            "papel — não precisa ser dono/admin). Não depende de nenhuma feature flag; "
            "o compatibility_flags nodejs_compat que habilita net.createConnection já "
            "está ativo em wrangler.jsonc."
        ),
        "impacto": (
            "Reconhecimento/varredura da rede interna acessível ao Worker; potencial "
            "abuso como relay para sondar ou incomodar hosts de terceiros usando a "
            "infraestrutura da Armazix como origem. Não expõe dados de outras lojas "
            "diretamente (o payload ESC/POS é fixo, não é o corpo da requisição), mas é "
            "uma primitiva de rede real com múltiplos objetivos de abuso."
        ),
        "recomendacao": (
            "Validar body.path/printer.path contra uma allowlist de faixas de IP "
            "privadas conhecidas do parque de impressoras (ex.: só RFC1918 "
            "192.168.0.0/16, 10.0.0.0/8 range documentado pela loja) OU, no mínimo, "
            "bloquear explicitamente loopback (127.0.0.0/8), link-local "
            "(169.254.0.0/16 — inclui o metadata endpoint de várias clouds), "
            "multicast e faixas reservadas antes de chamar sendViaTcp. Adicionar "
            "rate-limit dedicado (tier restritivo) para as 3 rotas de impressão em "
            "rateLimitConfigs."
        ),
    },
    {
        "id": "F2",
        "titulo": "Gate de permissão dos Relatórios é decorativo — sem checagem equivalente no backend",
        "categoria": "1. Permissão definida no navegador",
        "severidade": "Média",
        "arquivo": "src/routes/admin/relatorios.tsx · src/lib/api/reports-handler.ts",
        "linhas": "relatorios.tsx:88, 60, 64, 73 · reports-handler.ts (todos os 8 handlers)",
        "trecho": (
            "// relatorios.tsx:88\n"
            "function usePermissaoUsuario(): Permissao { return \"admin\"; }\n\n"
            "// relatorios.tsx:73 — catálogo declara a intenção…\n"
            "{ id: \"aud-002\", nome: \"Logs de Alterações Críticas\", …, "
            "permissao: [\"admin\"] }\n\n"
            "// reports-handler.ts — …mas o backend nunca checa\n"
            "async function resolveStoreId(auth) {\n"
            "  return { storeId: (await requireStoreAccess(auth)).storeId };\n"
            "  // sem checagem de papel/permissão nenhuma\n"
            "}"
        ),
        "descricao": (
            "O catálogo de relatórios declara explicitamente quais papéis podem ver "
            "cada relatório (permissao: [\"admin\"] para Logs de Alterações Críticas; "
            "[\"admin\",\"gerente\"] para Lucro Bruto e Líquido; [\"admin\",\"gerente\","
            "\"financeiro\"] para Fluxo de Caixa), mas usePermissaoUsuario() — a função "
            "que deveria ler o papel real do usuário logado — está implementada como um "
            "stub que sempre devolve \"admin\". O filtro de UI nunca esconde nada. E os "
            "8 handlers reais em reports-handler.ts (estoque-baixo, clientes-top, "
            "produtos-lucrativos, vendas-periodo, fluxo-caixa, lucro-bruto-liquido, "
            "logs-criticos, categorias-financeiro) só chamam requireStoreAccess — que "
            "aceita qualquer papel de storeUsers —, nunca uma checagem de papel/"
            "permissão equivalente à declarada no catálogo."
        ),
        "porque_exploravel": (
            "Qualquer funcionário autenticado da loja — inclusive o papel mais baixo "
            "(\"operador\") — pode chamar GET /api/reports/logs-criticos ou GET "
            "/api/reports/fluxo-caixa diretamente (sem passar pela tela) e receber "
            "fluxo de caixa, margens de lucro e o log de auditoria de ações críticas "
            "(estornos, exclusões, ajustes de estoque) de toda a equipe — dado que o "
            "próprio produto já modela como restrito a admin/gerente/financeiro."
        ),
        "condicoes": (
            "Basta ter uma conta de qualquer papel na loja (vendedor, operador, etc.); "
            "não precisa de nenhuma configuração especial. É isolamento entre papéis "
            "dentro da MESMA loja — não é um vazamento entre lojas diferentes."
        ),
        "impacto": (
            "Exposição de dados financeiros sensíveis (fluxo de caixa, lucro líquido) "
            "e do log de auditoria de ações críticas para funcionários que o dono da "
            "loja não pretendia que tivessem esse acesso."
        ),
        "recomendacao": (
            "Implementar usePermissaoUsuario() para ler o storeRole real (já disponível "
            "via /api/store-users/list ou embutível no JWT) em vez do stub fixo, E "
            "adicionar a mesma checagem de papel dentro de cada handler em "
            "reports-handler.ts (reaproveitando o sistema de roleProfiles/"
            "ALL_PERMISSION_KEYS que já existe em permissions-handler.ts para outras "
            "áreas do produto) — a checagem de UI sozinha nunca é suficiente."
        ),
    },
    {
        "id": "F3",
        "titulo": "HTML injection em e-mails transacionais (convite de equipe)",
        "categoria": "5. Inputs sem tratamento (XSS)",
        "severidade": "Média",
        "arquivo": "src/lib/auth/email.ts · src/lib/api/store-invite-handler.ts · src/lib/api/store-handler.ts",
        "linhas": "email.ts:108 (template) · store-invite-handler.ts:82 · store-handler.ts:294",
        "trecho": (
            "// email.ts:108 — interpolação direta em HTML, sem escape\n"
            "<p>Olá, <strong>${name}</strong>! A loja <strong>${storeName}</strong> "
            "convidou você…</p>\n\n"
            "// store-invite-handler.ts:82 — nome do convite só tem trim(), "
            "sem sanitizeString()\n"
            "const name = body.name?.trim();\n\n"
            "// store-handler.ts:294 — nome da loja gravado sem sanitização\n"
            ".set({ name: body.name, … })"
        ),
        "descricao": (
            "verificationTemplate/teamInviteTemplate/passwordResetTemplate (email.ts) "
            "constroem o HTML do e-mail via template literal, interpolando name/"
            "storeName sem nenhum escape de caracteres HTML. No fluxo de cadastro "
            "(register-handler.ts) o nome passa por sanitizeString() (remove &lt; e &gt;) "
            "antes de chegar ao e-mail, mas dois outros caminhos que alimentam o MESMO "
            "template não passam por sanitização nenhuma: (1) o campo \"nome\" do "
            "convite em inviteStoreUserHandler só recebe .trim(); (2) o nome da loja "
            "pode ser alterado a qualquer momento em Configurações "
            "(updateStoreHandler) gravando body.name direto no banco, sem "
            "sanitização."
        ),
        "porque_exploravel": (
            "Um dono/admin de loja (autenticado, requireStoreOwner) pode: (a) definir "
            "o nome da própria loja como HTML/CSS malicioso via /api/store/update, e/ou "
            "(b) convidar um \"novo funcionário\" via /api/store-users/invite com "
            "name=\"&lt;img src=x onerror=…&gt;\" ou uma estrutura HTML que sobrescreve o "
            "botão \"Aceitar convite\" por um link de phishing. Em ambos os casos, um "
            "e-mail real, enviado pelo domínio armazix.com.br via Resend, chega para "
            "um TERCEIRO — o convidado, que pode nem ter conta ainda — com esse HTML "
            "não escapado embutido."
        ),
        "condicoes": (
            "Requer uma conta de dono/admin de alguma loja (não é anônimo), mas a "
            "vítima é um terceiro que não precisa ter conta nem qualquer relação prévia "
            "com quem envia o convite."
        ),
        "impacto": (
            "Phishing/defacement dentro de um e-mail legítimo enviado pelo domínio da "
            "própria Armazix — o vetor mais crítico de execução de script depende do "
            "cliente de e-mail do destinatário (a maioria bloqueia &lt;script&gt;/onerror "
            "em 2026), mas a estrutura HTML/CSS do e-mail pode ser reescrita para "
            "convencer o destinatário a clicar num link diferente do botão real."
        ),
        "recomendacao": (
            "Fazer HTML-escape (&amp;, &lt;, &gt;, \", ') de todo valor interpolado nos três "
            "templates de email.ts antes de embuti-lo — não depender de sanitização "
            "feita no ponto de entrada, já que há mais de um caminho até o mesmo "
            "template. Aplicar sanitizeString() (ou um escapador de HTML dedicado) em "
            "inviteStoreUserHandler e em updateStoreHandler também."
        ),
    },
    {
        "id": "F4",
        "titulo": "Cobertura de RLS real inconsistente — a maioria dos handlers depende só do filtro manual",
        "categoria": "1. Banco sem tranca (isolamento de tenant) — observação arquitetural",
        "severidade": "Média",
        "arquivo": "src/lib/db/index.ts · src/lib/api/pdv-handler.ts",
        "linhas": "db/index.ts:43–52 (createUnscopedDb) · pdv-handler.ts:492–495 (comentário do próprio time)",
        "trecho": (
            "// db/index.ts:43-49\n"
            "// Conexão HTTP simples, SEM isolamento de tenant no nível do banco — a "
            "única\n"
            "// proteção é a cláusula `eq(tabela.storeId, storeId)` que cada handler "
            "escreve\n"
            "// manualmente. […]\n"
            "export async function createUnscopedDb(databaseUrl, _storeId?) {\n"
            "  return createDb(databaseUrl);\n"
            "}"
        ),
        "descricao": (
            "O projeto tem RLS real do Postgres implementada e funcionando "
            "(drizzle/0030_rls_activate.sql, role armazix_tenant sem BYPASSRLS, "
            "createTenantDbTransactional + setTenantContext) — mas ela só é usada em "
            "um punhado de fluxos de escrita de alto risco (criar pedido, mudar status "
            "de pedido, encerrar encomenda no PDV, aplicar resultado de pagamento). "
            "TODO o restante do backend (a esmagadora maioria das ~150 rotas — "
            "produtos, categorias, clientes, cupons, balanços, sessões de caixa, "
            "impressoras, setores, planos de pagamento, etc.) usa createDb/"
            "createUnscopedDb, que não aplica RLS nenhuma — a única proteção é a "
            "cláusula eq(storeId) que cada desenvolvedor precisa lembrar de escrever "
            "em cada query, para sempre."
        ),
        "porque_exploravel": (
            "Não é uma falha ativa confirmada: percorri manualmente ~20 handlers de "
            "escrita/leitura neste ciclo de auditoria e TODOS incluem o filtro por "
            "storeId corretamente. O risco é estrutural: o filtro manual falha "
            "aberto — um WHERE esquecido em uma query nova (ou numa refatoração "
            "futura) vaza dado entre lojas silenciosamente, sem nenhuma rede de "
            "segurança no nível do banco para barrar. RLS real falha fechado — mesmo "
            "que o desenvolvedor esqueça o filtro, o Postgres nega a linha por conta "
            "própria."
        ),
        "condicoes": (
            "Não é explorável hoje da forma que foi auditada (nenhum filtro ausente "
            "encontrado). É um risco latente que se materializa na PRÓXIMA query "
            "escrita sem o cuidado que o padrão atual exige em toda linha."
        ),
        "impacto": (
            "Nenhum no estado atual verificado. Risco é sobre manutenção futura: "
            "cada novo handler de listagem/relatório é, por padrão, um candidato a "
            "vazamento entre lojas até que alguém releia manualmente o WHERE."
        ),
        "recomendacao": (
            "Expandir o uso de createTenantDbTransactional (RLS real) para as rotas "
            "de leitura/escrita de maior sensibilidade (financeiro, clientes, "
            "relatórios) de forma incremental, priorizando as adicionadas mais "
            "recentemente (reports-handler.ts, por exemplo, é 100% createUnscopedDb). "
            "Onde a migração para RLS não for viável a curto prazo, considerar um "
            "helper de query que injete eq(storeId) automaticamente em vez de exigir "
            "que cada handler repita a cláusula manualmente."
        ),
    },
    {
        "id": "F5",
        "titulo": "Oráculo de enumeração de PII por telefone no checkout (mitigado, residual)",
        "categoria": "3. IDOR / exposição de dado (relacionado)",
        "severidade": "Baixa",
        "arquivo": "src/lib/api/crud-handler.ts",
        "linhas": "checkCustomerByPhoneHandler (GET /api/customer/check, público)",
        "trecho": (
            "export async function checkCustomerByPhoneHandler(request) {\n"
            "  // sem auth — rota pública\n"
            "  const storeId = url.searchParams.get(\"storeId\");\n"
            "  const rawPhone = url.searchParams.get(\"phone\");\n"
            "  … retorna { exists, customer: { id, name, phone }, addresses } se achar"
        ),
        "descricao": (
            "Endpoint público (sem autenticação) que, dado um storeId e um telefone, "
            "confirma se existe um cliente com aquele telefone na loja e devolve nome "
            "+ telefone + endereços de entrega. É um oráculo de PII por design — "
            "existe para pré-preencher o checkout quando o cliente já é conhecido da "
            "loja."
        ),
        "porque_exploravel": (
            "Já é uma decisão de produto deliberada e documentada no próprio código "
            "(comentário explícito reconhecendo o trade-off) e JÁ MITIGADA: a rota está "
            "no tier de rate limit \"sensitive\" (api-handler.ts, "
            "rateLimitConfigs) — o mesmo tier usado para check-email, criado "
            "especificamente para \"evitar varredura em massa de PII sem exigir "
            "credencial\". A projeção de campos também já exclui CPF/e-mail/"
            "avatarUrl, devolvendo só o mínimo necessário para o checkout."
        ),
        "condicoes": (
            "Um atacante paciente, com muitos números de telefone candidatos e "
            "disposto a operar dentro do limite de taxa (ou rotacionar IPs), ainda "
            "consegue confirmar lentamente quais números são clientes de uma loja "
            "específica."
        ),
        "impacto": (
            "Baixo — confirma só existência de cadastro + nome + endereço para quem já "
            "sabe o número de telefone exato; não expõe senha, CPF ou dado financeiro."
        ),
        "recomendacao": (
            "Nenhuma ação obrigatória — registrar como risco residual aceito. Se o "
            "volume de tráfego crescer, considerar CAPTCHA ou um limite por-IP mais "
            "agressivo especificamente nesta rota, ou exigir também os 4 últimos "
            "dígitos do CEP como segundo fator de correspondência."
        ),
    },
]

RECOMMENDATIONS = [
    ("P1", "Bloquear SSRF no fluxo de teste de impressora",
     "Restringir sendViaTcp() a faixas de IP privadas/allowlist conhecida e recusar "
     "loopback/link-local/multicast; aplicar o mesmo filtro na gravação de "
     "printers.path. Adicionar rate-limit dedicado às 3 rotas de impressão.",
     "F1"),
    ("P1", "Fechar o gate de permissão dos Relatórios de ponta a ponta",
     "Implementar usePermissaoUsuario() com o papel real do usuário e replicar a "
     "mesma checagem dentro de cada handler de reports-handler.ts.",
     "F2"),
    ("P2", "Escapar HTML em todos os templates de e-mail",
     "Adicionar uma função de escape central e aplicá-la a name/storeName/roleLabel "
     "em email.ts; sanitizar também na entrada (inviteStoreUserHandler, "
     "updateStoreHandler).",
     "F3"),
    ("P2", "Expandir cobertura de RLS real para além do checkout",
     "Migrar incrementalmente os handlers de maior sensibilidade (financeiro, "
     "clientes, relatórios) para createTenantDbTransactional, começando por "
     "reports-handler.ts.",
     "F4"),
    ("P3", "Registrar o oráculo de PII por telefone como risco aceito",
     "Documentar formalmente a decisão; revisitar com CAPTCHA/2º fator só se o "
     "volume de tráfego justificar.",
     "F5"),
]

# ─────────────────────────────────────────────────────────────────────────
# GitHub Issues (Markdown)
# ─────────────────────────────────────────────────────────────────────────
ISSUES_MD = [
r"""# [Segurança] SSRF autenticado no teste de impressora de rede (test-raw / print-test / print-order)

**Labels sugeridas:** `security`, `alta`

## Descrição do problema
`POST /api/printers/test-raw` aceita `body.path` (IP ou hostname) de qualquer
usuário autenticado com acesso a alguma loja — inclusive o papel mais baixo — e
abre uma conexão TCP bruta para esse destino via `net.createConnection`
(habilitado pelo `compatibility_flags: ["nodejs_compat"]` do Worker), sem
nenhum bloqueio de IPs privados/loopback/link-local. O mesmo primitivo é
alcançável em dois passos por `POST /api/printers/create` (o campo `path` não
é validado) seguido de `print-test`/`print-order` com `send:true`.

## Por que é explorável
A resposta devolve se a conexão teve sucesso, deu timeout (5s) ou foi
recusada — um oráculo clássico de SSRF/port-scan da rede que o Worker
enxerga, disponível a até 60 chamadas/minuto (tier de rate limit padrão
"api", já que a rota não tem entrada dedicada em `rateLimitConfigs`).

## Evidência
`src/lib/api/print-handler.ts:104-107`
```ts
const net = parseNetworkPath(body.path.trim());
if (net) {
  await sendViaTcp(net.host, net.port, escpos); // conecta em QUALQUER host:porta
}
```
`src/lib/api/printers.ts:92,153` — `path` gravado sem validação de destino.

## Impacto
Reconhecimento/varredura de rede interna acessível ao Worker; uso da
infraestrutura da Armazix como relay para sondar hosts de terceiros.

## Sugestão de correção
Validar `body.path`/`printer.path` contra uma allowlist de faixas privadas
conhecidas do parque de impressoras, ou no mínimo bloquear explicitamente
loopback (127.0.0.0/8), link-local (169.254.0.0/16), multicast e faixas
reservadas antes de `sendViaTcp`. Adicionar rate-limit dedicado e restritivo
às 3 rotas de impressão (`test-raw`, `print-test`, `print-order`).

## Critérios de aceite
- [ ] `sendViaTcp`/`parseNetworkPath` rejeitam explicitamente 127.0.0.0/8, 169.254.0.0/16, faixas multicast/reservadas
- [ ] `createPrinterHandler`/`updatePrinterHandler` aplicam a mesma validação de destino ao gravar `path`
- [ ] Teste automatizado cobre a rejeição de um IP de loopback e de um link-local
- [ ] `rateLimitConfigs` ganha uma entrada restritiva para `/api/printers/test-raw`, `/api/printers/print-test` e `/api/printers/print-order`
""",
r"""# [Segurança] Gate de permissão dos Relatórios é decorativo — sem checagem equivalente no backend

**Labels sugeridas:** `security`, `média`

## Descrição do problema
`usePermissaoUsuario()` em `relatorios.tsx` sempre retorna `"admin"`, então o
filtro de UI que deveria esconder relatórios sensíveis (`aud-002` "Logs de
Alterações Críticas" → `permissao: ["admin"]`; `fin-005` "Lucro Bruto e
Líquido" → `["admin","gerente"]`; `fin-001` "Fluxo de Caixa" →
`["admin","gerente","financeiro"]`) nunca esconde nada de ninguém. Os 8
handlers reais em `reports-handler.ts` só chamam `requireStoreAccess`
(qualquer papel da loja), sem nenhuma checagem de papel/permissão.

## Por que é explorável
Qualquer funcionário autenticado da loja — inclusive "operador" — pode
chamar `GET /api/reports/logs-criticos` ou `/api/reports/fluxo-caixa`
diretamente e receber dado que o próprio catálogo já modela como restrito.

## Evidência
`src/routes/admin/relatorios.tsx:88`
```ts
function usePermissaoUsuario(): Permissao { return "admin"; }
```
`src/lib/api/reports-handler.ts` (todos os 8 handlers) — só
`requireStoreAccess(auth)`, nenhuma checagem de papel.

## Impacto
Exposição de fluxo de caixa, margens de lucro e log de auditoria de ações
críticas para papéis que o dono da loja não pretendia autorizar.

## Sugestão de correção
Implementar `usePermissaoUsuario()` lendo o `storeRole` real do usuário
logado, e replicar a mesma checagem de papel dentro de cada handler de
`reports-handler.ts`, reaproveitando o sistema de `roleProfiles`/
`ALL_PERMISSION_KEYS` já usado em `permissions-handler.ts`.

## Critérios de aceite
- [ ] `usePermissaoUsuario()` retorna o papel real do usuário autenticado, não um valor fixo
- [ ] Cada handler de `reports-handler.ts` rejeita (403) um papel fora da lista `permissao` declarada no catálogo para aquele relatório
- [ ] Teste automatizado cobre um usuário "operador" recebendo 403 em `/api/reports/logs-criticos` e `/api/reports/fluxo-caixa`
""",
r"""# [Segurança] HTML injection em e-mails transacionais (convite de equipe / nome da loja)

**Labels sugeridas:** `security`, `média`

## Descrição do problema
Os templates de e-mail em `src/lib/auth/email.ts` interpolam `name`/
`storeName` direto em HTML via template literal, sem escape. O nome do
convite (`inviteStoreUserHandler`) só recebe `.trim()`, sem
`sanitizeString()`; o nome da loja pode ser trocado a qualquer momento via
`updateStoreHandler` também sem sanitização — apesar do fluxo de cadastro
original passar por `sanitizeString()`.

## Por que é explorável
Um dono/admin de loja (autenticado) pode definir o nome da loja e/ou o nome
de um convite como HTML/CSS malicioso. O e-mail resultante, enviado pelo
domínio real armazix.com.br via Resend, chega para um terceiro (o
convidado, que pode nem ter conta) com esse HTML não escapado embutido.

## Evidência
`src/lib/auth/email.ts:108`
```ts
<p>Olá, <strong>${name}</strong>! A loja <strong>${storeName}</strong> convidou você…</p>
```
`src/lib/api/store-invite-handler.ts:82`
```ts
const name = body.name?.trim(); // sem sanitizeString()
```
`src/lib/api/store-handler.ts:294`
```ts
.set({ name: body.name, … }) // nome da loja gravado sem sanitização
```

## Impacto
Phishing/defacement dentro de um e-mail legítimo da própria Armazix —
sobrescrever a estrutura do e-mail (ex: o botão "Aceitar convite") para
apontar para um link diferente do real.

## Sugestão de correção
Adicionar uma função de HTML-escape central em `email.ts` e aplicá-la a todo
valor interpolado nos 3 templates, além de sanitizar na entrada
(`inviteStoreUserHandler`, `updateStoreHandler`) com `sanitizeString()` ou
equivalente.

## Critérios de aceite
- [ ] `email.ts` escapa `&`, `<`, `>`, `"`, `'` em todo valor interpolado nos 3 templates
- [ ] `inviteStoreUserHandler` sanitiza `body.name` antes de gravar/enviar
- [ ] `updateStoreHandler` sanitiza `body.name` antes de gravar em `stores.name`
- [ ] Teste automatizado cobre um nome contendo `<img onerror>` chegando escapado no HTML final do e-mail
""",
r"""# [Segurança] Cobertura de RLS real inconsistente — maioria dos handlers depende só do filtro manual por storeId

**Labels sugeridas:** `security`, `média`, `débito-técnico`

## Descrição do problema
O projeto tem RLS real do Postgres funcionando (`drizzle/0030_rls_activate.sql`,
role `armazix_tenant` sem BYPASSRLS, `createTenantDbTransactional` +
`setTenantContext`), mas só é usada em poucos fluxos de escrita de alto risco
(criar pedido, mudar status, encerrar encomenda no PDV, aplicar pagamento).
Todo o resto do backend usa `createDb`/`createUnscopedDb`, sem RLS — a única
proteção é a cláusula `eq(storeId)` que cada query precisa incluir
manualmente, para sempre.

## Por que é relevante
Não é uma falha ativa confirmada nesta auditoria — os ~20 handlers lidos
linha a linha incluem o filtro corretamente. O risco é estrutural: o filtro
manual falha **aberto** (um WHERE esquecido numa query nova vaza dado entre
lojas silenciosamente); RLS real falha **fechado** (o Postgres nega a linha
mesmo que o desenvolvedor esqueça o filtro).

## Evidência
`src/lib/db/index.ts:43-49`
```
// Conexão HTTP simples, SEM isolamento de tenant no nível do banco — a única
// proteção é a cláusula `eq(tabela.storeId, storeId)` que cada handler escreve
// manualmente.
```
`src/lib/api/pdv-handler.ts:492-495` — comentário do próprio time confirmando
que só o handler mais novo do arquivo usa RLS real; o resto usa BYPASSRLS.

## Impacto
Nenhum confirmado no estado atual. Risco latente sobre manutenção futura —
cada handler novo de listagem/relatório nasce sem rede de segurança no
banco.

## Sugestão de correção
Migrar incrementalmente os handlers de maior sensibilidade (financeiro,
clientes, relatórios — a começar por `reports-handler.ts`, que é 100%
`createUnscopedDb`) para `createTenantDbTransactional`. Onde não for viável
a curto prazo, avaliar um helper de query que injete `eq(storeId)`
automaticamente.

## Critérios de aceite
- [ ] `reports-handler.ts` migrado para `createTenantDbTransactional` + `setTenantContext`
- [ ] Lista de handlers ainda em `createUnscopedDb` documentada e priorizada
- [ ] Decisão registrada (ADR ou comentário) sobre o padrão-alvo para novos handlers
""",
]

# ─────────────────────────────────────────────────────────────────────────
# Fontes
# ─────────────────────────────────────────────────────────────────────────
def register_fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    candidates = {
        "Body": [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\calibri.ttf", r"C:\Windows\Fonts\arial.ttf"],
        "Body-Bold": [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\calibrib.ttf", r"C:\Windows\Fonts\arialbd.ttf"],
        "Display": [r"C:\Windows\Fonts\segoeuisl.ttf", r"C:\Windows\Fonts\calibril.ttf", r"C:\Windows\Fonts\arial.ttf"],
        "Display-Bold": [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\calibrib.ttf", r"C:\Windows\Fonts\arialbd.ttf"],
        "Mono": [r"C:\Windows\Fonts\consola.ttf", r"C:\Windows\Fonts\cour.ttf"],
    }
    resolved = {}
    for name, paths in candidates.items():
        for p in paths:
            if os.path.exists(p):
                pdfmetrics.registerFont(TTFont(name, p))
                resolved[name] = p
                break
    return resolved

FONT_MAP = register_fonts()
F_BODY = "Body" if "Body" in FONT_MAP else "Helvetica"
F_BODY_B = "Body-Bold" if "Body-Bold" in FONT_MAP else "Helvetica-Bold"
F_DISPLAY = "Display" if "Display" in FONT_MAP else "Helvetica"
F_DISPLAY_B = "Display-Bold" if "Display-Bold" in FONT_MAP else "Helvetica-Bold"
F_MONO = "Mono" if "Mono" in FONT_MAP else "Courier"

# matplotlib: usa a mesma família se possível
try:
    if "Body" in FONT_MAP:
        fm.fontManager.addfont(FONT_MAP["Body"])
        plt.rcParams["font.family"] = fm.FontProperties(fname=FONT_MAP["Body"]).get_name()
except Exception:
    pass

# ─────────────────────────────────────────────────────────────────────────
# Gráficos
# ─────────────────────────────────────────────────────────────────────────
def chart_donut_severity():
    counts = {}
    for f in FINDINGS:
        counts[f["severidade"]] = counts.get(f["severidade"], 0) + 1
    order = ["Crítica", "Alta", "Média", "Baixa", "Informativa"]
    labels = [k for k in order if k in counts]
    values = [counts[k] for k in labels]
    colors_ = [SEVERITY_COLOR[k] for k in labels]

    fig, ax = plt.subplots(figsize=(4.6, 4.0), dpi=200)
    wedges, _ = ax.pie(
        values, colors=colors_, startangle=90, counterclock=False,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2.5),
    )
    ax.text(0, 0.08, str(sum(values)), ha="center", va="center", fontsize=30, fontweight="bold", color=COR_INK)
    ax.text(0, -0.20, "achados", ha="center", va="center", fontsize=11, color=COR_MUTED)
    ax.set_aspect("equal")

    legend_labels = [f"{l}  ({counts[l]})" for l in labels]
    ax.legend(
        wedges, legend_labels, loc="upper center", bbox_to_anchor=(0.5, -0.02),
        ncol=1, frameon=False, fontsize=10.5, labelcolor=COR_INK,
        handlelength=1.1, handleheight=1.1, borderaxespad=0,
    )
    fig.subplots_adjust(top=0.98, bottom=0.30)
    path = os.path.join(ASSETS, "donut_severidade.png")
    fig.savefig(path, transparent=True, bbox_inches="tight", pad_inches=0.08)
    plt.close(fig)
    return path


def chart_bar_categoria():
    cat_short = {
        "Achado adicional (fora das 5 categorias — rede/SSRF)": "SSRF (extra)",
        "1. Permissão definida no navegador": "Permissão\nno navegador",
        "5. Inputs sem tratamento (XSS)": "XSS",
        "1. Banco sem tranca (isolamento de tenant) — observação arquitetural": "Banco sem\ntranca",
        "3. IDOR / exposição de dado (relacionado)": "IDOR /\nexposição",
    }
    counts = {}
    sev_by_cat = {}
    for f in FINDINGS:
        c = cat_short.get(f["categoria"], f["categoria"])
        counts[c] = counts.get(c, 0) + 1
        sev_by_cat.setdefault(c, f["severidade"])

    labels = list(counts.keys())
    values = [counts[l] for l in labels]
    bar_colors = [SEVERITY_COLOR[sev_by_cat[l]] for l in labels]

    fig, ax = plt.subplots(figsize=(7.0, 3.6), dpi=200)
    bars = ax.barh(labels, values, color=bar_colors, height=0.58, zorder=3)
    ax.invert_yaxis()
    for b, v in zip(bars, values):
        ax.text(b.get_width() + 0.04, b.get_y() + b.get_height() / 2, str(v),
                 va="center", ha="left", fontsize=11, fontweight="bold", color=COR_INK)

    ax.set_xlim(0, max(values) + 1)
    ax.set_xticks(range(0, max(values) + 2))
    ax.tick_params(axis="y", labelsize=10.5, colors=COR_INK, length=0)
    ax.tick_params(axis="x", labelsize=9.5, colors=COR_MUTED)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(COR_BORDER)
    ax.grid(axis="x", color=COR_BORDER, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
    fig.tight_layout(pad=0.6)
    path = os.path.join(ASSETS, "barras_categoria.png")
    fig.savefig(path, transparent=True, bbox_inches="tight", pad_inches=0.08)
    plt.close(fig)
    return path


DONUT_PATH = chart_donut_severity()
BAR_PATH = chart_bar_categoria()

# ─────────────────────────────────────────────────────────────────────────
# Estilos
# ─────────────────────────────────────────────────────────────────────────
styles = {}
styles["CoverTitle"] = ParagraphStyle("CoverTitle", fontName=F_DISPLAY_B, fontSize=30, leading=35,
                                       textColor=colors.white, alignment=TA_LEFT, spaceAfter=0)
styles["CoverSub"] = ParagraphStyle("CoverSub", fontName=F_BODY, fontSize=13, leading=18,
                                     textColor=colors.HexColor("#CBD5E1"), alignment=TA_LEFT)
styles["CoverMeta"] = ParagraphStyle("CoverMeta", fontName=F_BODY, fontSize=10, leading=15,
                                      textColor=colors.HexColor("#94A3B8"), alignment=TA_LEFT)
styles["H1"] = ParagraphStyle("H1", fontName=F_DISPLAY_B, fontSize=18, leading=22,
                               textColor=colors.HexColor(COR_NAVY), spaceBefore=4, spaceAfter=10)
styles["H2"] = ParagraphStyle("H2", fontName=F_DISPLAY_B, fontSize=13, leading=17,
                               textColor=colors.HexColor(COR_NAVY), spaceBefore=14, spaceAfter=6)
styles["H3"] = ParagraphStyle("H3", fontName=F_BODY_B, fontSize=10.6, leading=14,
                               textColor=colors.HexColor(COR_INK), spaceBefore=8, spaceAfter=3)
styles["Body"] = ParagraphStyle("Body", fontName=F_BODY, fontSize=9.3, leading=13.6,
                                 textColor=colors.HexColor(COR_INK), alignment=TA_JUSTIFY, spaceAfter=6)
styles["BodySmall"] = ParagraphStyle("BodySmall", fontName=F_BODY, fontSize=8.6, leading=12.4,
                                      textColor=colors.HexColor(COR_MUTED), alignment=TA_JUSTIFY, spaceAfter=4)
styles["Bullet"] = ParagraphStyle("Bullet", parent=styles["Body"], leftIndent=12, bulletIndent=2, spaceAfter=5)
styles["Mono"] = ParagraphStyle("Mono", fontName=F_MONO, fontSize=7.6, leading=10.8,
                                 textColor=colors.HexColor("#E2E8F0"), alignment=TA_LEFT)
styles["MonoDark"] = ParagraphStyle("MonoDark", fontName=F_MONO, fontSize=7.9, leading=11.2,
                                     textColor=colors.HexColor("#1E293B"), alignment=TA_LEFT)
styles["Caption"] = ParagraphStyle("Caption", fontName=F_BODY, fontSize=8.2, leading=11,
                                    textColor=colors.HexColor(COR_MUTED), alignment=TA_CENTER)
styles["TocItem"] = ParagraphStyle("TocItem", fontName=F_BODY_B, fontSize=10.5, leading=15,
                                    textColor=colors.HexColor(COR_INK))
styles["KpiNum"] = ParagraphStyle("KpiNum", fontName=F_DISPLAY_B, fontSize=22, leading=24,
                                   alignment=TA_CENTER)
styles["KpiLabel"] = ParagraphStyle("KpiLabel", fontName=F_BODY, fontSize=8, leading=10,
                                     alignment=TA_CENTER, textColor=colors.HexColor(COR_MUTED))
styles["IssueTitle"] = ParagraphStyle("IssueTitle", fontName=F_MONO, fontSize=9.5, leading=13,
                                       textColor=colors.HexColor("#F8FAFC"), spaceAfter=2)


def P(text, style="Body"):
    return Paragraph(text, styles[style])


def sev_chip(sev):
    color = SEVERITY_COLOR.get(sev, COR_MUTED)
    t = Table([[P(f"<font color='white'><b>{sev.upper()}</b></font>", "BodySmall")]], colWidths=[2.3 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(color)),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t


# ─────────────────────────────────────────────────────────────────────────
# Page templates (cabeçalho/rodapé)
# ─────────────────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 2 * cm
REPORT_NAME = "Relatório de Auditoria de Segurança — Armazix"


def draw_header_footer(c: pdfcanvas.Canvas, doc, page_kind="content"):
    c.saveState()
    if page_kind != "cover":
        c.setStrokeColor(colors.HexColor(COR_BORDER))
        c.setLineWidth(0.6)
        c.line(MARGIN, PAGE_H - 1.35 * cm, PAGE_W - MARGIN, PAGE_H - 1.35 * cm)
        c.setFont(F_BODY, 8)
        c.setFillColor(colors.HexColor(COR_MUTED))
        c.drawString(MARGIN, PAGE_H - 1.15 * cm, REPORT_NAME)
        c.drawRightString(PAGE_W - MARGIN, PAGE_H - 1.15 * cm, "Confidencial — uso interno")

        c.setLineWidth(0.6)
        c.line(MARGIN, 1.35 * cm, PAGE_W - MARGIN, 1.35 * cm)
        c.setFont(F_BODY, 8)
        c.drawString(MARGIN, 1.0 * cm, "Armazix · Auditoria de Segurança")
        c.drawRightString(PAGE_W - MARGIN, 1.0 * cm, f"Página {doc.page}")
    c.restoreState()


class ReportDoc(BaseDocTemplate):
    def __init__(self, filename, **kw):
        BaseDocTemplate.__init__(self, filename, pagesize=A4, **kw)
        frame_cover = Frame(0, 0, PAGE_W, PAGE_H, id="cover", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        frame_content = Frame(
            MARGIN, 1.55 * cm, PAGE_W - 2 * MARGIN, PAGE_H - 3.25 * cm, id="content",
            leftPadding=0, rightPadding=0, topPadding=6, bottomPadding=0,
        )

        self.addPageTemplates([
            PageTemplate(id="Cover", frames=[frame_cover], onPage=on_first_page),
            PageTemplate(id="Content", frames=[frame_content], onPage=lambda c, d: draw_header_footer(c, d, "content")),
        ])


# ─────────────────────────────────────────────────────────────────────────
# Montagem do conteúdo
# ─────────────────────────────────────────────────────────────────────────
story = []

# ── Capa ──────────────────────────────────────────────────────────────────
def build_cover():
    elements = []
    # canvas de fundo é desenhado via onPage extra abaixo (ver draw_cover_bg)
    elements.append(Spacer(1, 6.6 * cm))
    elements.append(Table([[P("AUDITORIA DE SEGURANÇA", "CoverMeta")]], colWidths=[16 * cm],
                           style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 2.2 * cm)])))
    elements.append(Spacer(1, 0.3 * cm))
    title_tbl = Table([[P("Relatório de Auditoria<br/>de Segurança", "CoverTitle")]], colWidths=[16 * cm],
                       style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 2.2 * cm)]))
    elements.append(title_tbl)
    elements.append(Spacer(1, 0.25 * cm))
    sub_tbl = Table([[P("Armazix — plataforma de e-commerce e PDV multi-tenant", "CoverSub")]], colWidths=[16 * cm],
                     style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 2.2 * cm)]))
    elements.append(sub_tbl)
    elements.append(Spacer(1, 1.4 * cm))

    meta_rows = [
        ["Data", "28 de agosto de 2026"],
        ["Escopo", "Repositório principal Armazix (backend Cloudflare Workers + frontend TanStack Start)"],
        ["Metodologia", "5 categorias mapeadas à stack detectada — ver nota metodológica"],
        ["Achados", f"{len(FINDINGS)} verificados no código real"],
    ]
    meta_tbl = Table(
        [["", P(f"<font color='#7DD3FC'><b>{k}</b></font>", "CoverMeta"), P(f"<font color='#E2E8F0'>{v}</font>", "CoverMeta")] for k, v in meta_rows],
        colWidths=[2.2 * cm, 2.9 * cm, 10.9 * cm],
    )
    meta_tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (1, 0), (1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(meta_tbl)
    return elements


story += build_cover()
story.append(NextPageTemplate("Content"))
story.append(PageBreak())

# ── Nota metodológica ───────────────────────────────────────────────────
story.append(P("Nota metodológica", "H1"))
story.append(P(
    "As cinco categorias solicitadas foram mapeadas para a stack real detectada neste "
    "repositório antes do início da auditoria. A stack identificada:", "Body"))

stack_rows = [
    ["Linguagem", STACK["linguagem"]],
    ["Runtime", STACK["runtime"]],
    ["Framework", STACK["framework"]],
    ["ORM / Banco", STACK["orm"]],
    ["Autenticação", STACK["auth"]],
    ["Frontend", STACK["frontend"]],
    ["Deploy", STACK["deploy"]],
    ["Cache", STACK["cache"]],
    ["Pagamentos", STACK["pagamento"]],
]
stack_tbl = Table([[P(f"<b>{k}</b>", "BodySmall"), P(v, "BodySmall")] for k, v in stack_rows],
                   colWidths=[3.6 * cm, 13.3 * cm])
stack_tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(COR_BG_SOFT)),
    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(COR_BORDER)),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor(COR_BORDER)),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story.append(stack_tbl)
story.append(Spacer(1, 10))
story.append(P("Como cada categoria foi mapeada e verificada:", "H3"))
for titulo, desc in METODOLOGIA:
    story.append(P(f"<b>{titulo}.</b> {desc}", "Bullet"))

story.append(PageBreak())

# ── Resumo executivo ────────────────────────────────────────────────────
story.append(P("Resumo executivo", "H1"))

sev_counts = {}
for f in FINDINGS:
    sev_counts[f["severidade"]] = sev_counts.get(f["severidade"], 0) + 1

kpi_defs = [
    ("Crítica", sev_counts.get("Crítica", 0), COR_CRITICA),
    ("Alta", sev_counts.get("Alta", 0), COR_ALTA),
    ("Média", sev_counts.get("Média", 0), COR_MEDIA),
    ("Baixa", sev_counts.get("Baixa", 0), COR_BAIXA),
]
kpi_cells = []
for label, n, color in kpi_defs:
    cell = Table([[P(f"<font color='{color}'>{n}</font>", "KpiNum")], [P(label, "KpiLabel")]], colWidths=[3.9 * cm])
    cell.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(color)),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(COR_BG_SOFT)),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))
    kpi_cells.append(cell)
kpi_row = Table([kpi_cells], colWidths=[4.1 * cm] * 4, spaceAfter=14)
kpi_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
story.append(kpi_row)
story.append(Spacer(1, 8))

story.append(P(
    "A auditoria percorreu sistematicamente os 35 arquivos de handler do backend "
    "(167 funções exportadas) e o frontend administrativo em busca de falhas nas 5 "
    "categorias solicitadas. O resultado é um sistema com uma postura de segurança "
    "consistentemente madura — isolamento de tenant, prevenção de IDOR e validação de "
    "webhook de pagamento em nível acima da média — com <b>2 falhas concretas e "
    "acionáveis</b> (gate de permissão dos Relatórios e HTML injection em e-mail de "
    "convite), <b>1 falha de alta severidade fora do escopo original</b> (SSRF no "
    "teste de impressora, reportada por completude), e <b>2 observações "
    "arquiteturais/residuais</b> de menor urgência.",
    "Body"))
story.append(Spacer(1, 6))

charts_tbl = Table(
    [[Image(DONUT_PATH, width=7.6 * cm, height=6.6 * cm), Image(BAR_PATH, width=8.6 * cm, height=4.6 * cm)]],
    colWidths=[7.8 * cm, 8.8 * cm],
)
charts_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
story.append(charts_tbl)
story.append(Table([[P("Achados por severidade", "Caption"), P("Achados por categoria", "Caption")]],
                    colWidths=[7.8 * cm, 8.8 * cm]))

story.append(PageBreak())

# ── Pontos fortes / fracos ──────────────────────────────────────────────
story.append(P("Pontos fortes verificados", "H1"))
story.append(P(
    "O que segue foi lido linha a linha no código real (não inferido) e confirma "
    "proteção efetiva — evidência de cobertura da auditoria, não apenas ausência de "
    "achados.", "BodySmall"))
for titulo, desc in STRENGTHS:
    row = Table([[P("●", "H3"), [P(f"<b>{titulo}</b>", "Body"), P(desc, "BodySmall")]]],
                colWidths=[0.7 * cm, 15.8 * cm])
    row.setStyle(TableStyle([
        ("TEXTCOLOR", (0, 0), (0, 0), colors.HexColor(COR_FORTE)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(row)

story.append(PageBreak())
story.append(P("Pontos fracos — riscos centrais", "H1"))
story.append(P(
    "Ordenados por severidade. Detalhamento completo (arquivo, linha, trecho de "
    "código, condições de exploração) na seção seguinte.", "BodySmall"))
for f in FINDINGS:
    row = Table([[sev_chip(f["severidade"]), P(f"<b>{f['id']} — {f['titulo']}</b><br/>{f['arquivo']}", "BodySmall")]],
                colWidths=[2.5 * cm, 14 * cm])
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(row)

story.append(PageBreak())

# ── Achados detalhados ──────────────────────────────────────────────────
story.append(P("Achados detalhados", "H1"))

for f in FINDINGS:
    block = []
    header = Table([[P(f"<b>{f['id']}</b> — {f['titulo']}", "H3")], [sev_chip(f["severidade"])]],
                    colWidths=[16.4 * cm])
    block.append(P(f"<b>{f['id']} — {f['titulo']}</b>", "H2"))
    block.append(sev_chip(f["severidade"]))
    block.append(Spacer(1, 4))

    meta_tbl = Table([
        [P("<b>Categoria</b>", "BodySmall"), P(f["categoria"], "BodySmall")],
        [P("<b>Arquivo</b>", "BodySmall"), P(f["arquivo"], "BodySmall")],
        [P("<b>Linha(s)</b>", "BodySmall"), P(f["linhas"], "BodySmall")],
    ], colWidths=[2.6 * cm, 14.3 * cm])
    meta_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(COR_BG_SOFT)),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(COR_BORDER)),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(COR_BORDER)),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    block.append(meta_tbl)
    block.append(Spacer(1, 5))

    code_lines = f["trecho"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").split("\n")
    code_html = "<br/>".join(code_lines)
    code_tbl = Table([[Paragraph(code_html, styles["Mono"])]], colWidths=[16.4 * cm])
    code_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(COR_NAVY)),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [5, 5, 5, 5]),
    ]))
    block.append(code_tbl)
    block.append(Spacer(1, 6))

    block.append(P("<b>Descrição</b>", "H3"))
    block.append(P(f["descricao"], "Body"))
    block.append(P("<b>Por que é explorável</b>", "H3"))
    block.append(P(f["porque_exploravel"], "Body"))
    block.append(P("<b>Condições de exploração</b>", "H3"))
    block.append(P(f["condicoes"], "Body"))
    block.append(P("<b>Impacto</b>", "H3"))
    block.append(P(f["impacto"], "Body"))
    block.append(P("<b>Recomendação</b>", "H3"))
    block.append(P(f["recomendacao"], "Body"))
    block.append(Spacer(1, 4))
    block.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor(COR_BORDER)))
    block.append(Spacer(1, 10))

    story.append(KeepTogether(block[:6]))
    for extra in block[6:]:
        story.append(extra)

story.append(PageBreak())

# ── Tabela consolidada ──────────────────────────────────────────────────
story.append(P("Tabela consolidada de achados", "H1"))
table_data = [[P("<b>Severidade</b>", "BodySmall"), P("<b>Arquivo:linha</b>", "BodySmall"), P("<b>Descrição</b>", "BodySmall")]]
for f in FINDINGS:
    table_data.append([
        sev_chip(f["severidade"]),
        P(f"{f['arquivo'].split(chr(0x20))[0].split(chr(0xB7))[0].strip()}<br/>{f['linhas']}", "BodySmall"),
        P(f"<b>{f['id']}.</b> {f['titulo']}", "BodySmall"),
    ])
cons_tbl = Table(table_data, colWidths=[2.6 * cm, 5.0 * cm, 8.8 * cm], repeatRows=1)
cons_tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COR_NAVY)),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(COR_BORDER)),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(COR_BORDER)),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(COR_BG_SOFT)]),
]))
story.append(cons_tbl)

story.append(PageBreak())

# ── Recomendações priorizadas ───────────────────────────────────────────
story.append(P("Recomendações priorizadas", "H1"))
prio_color = {"P1": COR_CRITICA, "P2": COR_MEDIA, "P3": COR_BAIXA}
for prio, titulo, desc, ref in RECOMMENDATIONS:
    chip = Table([[P(f"<font color='white'><b>{prio}</b></font>", "BodySmall")]], colWidths=[1.3 * cm])
    chip.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(prio_color[prio])),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROUNDEDCORNERS", [5, 5, 5, 5]),
    ]))
    row = Table([[chip, [P(f"<b>{titulo}</b>  <font color='{COR_MUTED}'>({ref})</font>", "Body"), P(desc, "BodySmall")]]],
                colWidths=[1.6 * cm, 14.9 * cm])
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    story.append(row)

story.append(PageBreak())

# ── Issues para o GitHub ────────────────────────────────────────────────
story.append(P("Issues para o GitHub", "H1"))
story.append(P(
    "Uma issue em Markdown por achado acionável (F1–F4), pronta para copiar e colar. "
    "F5 foi registrado como risco aceito na seção de recomendações e não gera issue "
    "própria.", "BodySmall"))
story.append(Spacer(1, 6))

for i, md in enumerate(ISSUES_MD, start=1):
    story.append(P(f"--- ISSUE {i} ---", "H3"))
    lines = md.strip("\n").split("\n")
    esc_lines = [l.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") for l in lines]
    html = "<br/>".join(esc_lines)
    box = Table([[Paragraph(html, styles["MonoDark"])]], colWidths=[16.4 * cm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(COR_BORDER)),
        ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(box)
    story.append(P(f"--- FIM ISSUE {i} ---", "H3"))
    story.append(Spacer(1, 12))

# ─────────────────────────────────────────────────────────────────────────
# Capa customizada: fundo navy + faixa de acento (desenhado por cima do template)
# ─────────────────────────────────────────────────────────────────────────
def on_first_page(c: pdfcanvas.Canvas, doc):
    if doc.page == 1:
        c.saveState()
        c.setFillColor(colors.HexColor(COR_NAVY))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        c.setFillColor(colors.HexColor(COR_ACCENT))
        c.rect(0, PAGE_H - 0.35 * cm, PAGE_W, 0.35 * cm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#1E3A5F"))
        c.circle(PAGE_W - 2 * cm, PAGE_H - 3 * cm, 5.4 * cm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor(COR_NAVY))
        c.setFillAlpha(0.55)
        c.circle(PAGE_W - 1 * cm, PAGE_H - 2 * cm, 5.4 * cm, fill=1, stroke=0)
        c.setFillAlpha(1)
        c.setFont(F_DISPLAY_B, 11)
        c.setFillColor(colors.white)
        c.drawString(2.2 * cm, PAGE_H - 2.2 * cm, "ARMAZIX")
        c.setStrokeColor(colors.HexColor(COR_ACCENT))
        c.setLineWidth(2.4)
        c.line(2.2 * cm, 1.7 * cm, 2.2 * cm, PAGE_H - 6.3 * cm)
        c.restoreState()
    draw_header_footer(c, doc, "cover" if doc.page == 1 else "content")


doc = ReportDoc(OUT_PDF, title=REPORT_NAME, author="Auditoria de Segurança")
doc.build(story)
print(f"OK: {OUT_PDF}")
