# Armazix PDV Desktop

Frente de caixa offline-first para Windows (Electron + React + TypeScript +
Tailwind), com banco local em RxDB (IndexedDB via Dexie) e sincronização
automática com a API Cloud do Armazix.

## Como rodar

```bash
cd pdv-desktop
npm install
npm run dev
```

Por padrão o app aponta pra `https://armazix.com.br`. Para apontar pra um
backend local (`npm run deploy:dev` no projeto raiz), crie um `.env`:

```
VITE_API_BASE_URL=http://localhost:8787
```

## Build do instalador (.exe)

```bash
npm run dist:win
```

Gera um instalador NSIS one-click em `release/`. Antes do primeiro release
de verdade, troque `build/icon.ico` pelo ícone final da marca (o
electron-builder usa o ícone padrão do Electron até lá).

## Estrutura

```
src/
  main/        processo principal do Electron (janela, ciclo de vida do app)
  preload/     ponte segura entre main e renderer (contextBridge)
  renderer/    o app React em si
    src/
      db/          schemas RxDB + criação do banco local (Dexie/IndexedDB)
      services/    api.ts (cliente HTTP), auth.service.ts (login online/
                   offline), network.service.ts (sensor online/offline +
                   heartbeat), sync.service.ts (download de catálogo +
                   fila de sincronização de vendas), caixa.service.ts
      hooks/       useAuth, useCart, useOnlineStatus
      screens/     LoginScreen, PdvScreen
      components/pdv/  Header, SearchBar, CategoryTabs, ProductGrid,
                   ProductCard, Cart, CartItem, OpenRegisterModal
```

## Como a sincronização funciona

1. **Catálogo (download):** `syncCatalog()` puxa `/api/products/list-admin`
   e `/api/categories/list-admin` e grava no RxDB local. Roda no login
   online e no botão de sincronizar manual.
2. **Vendas (upload):** toda venda entra primeiro em `orders` (local, com
   `synced: false`) e em `sync_queue` (o "envelope" pronto pra reenviar).
   Quando a conexão volta, `drainQueue()` reenvia cada item pendente pra
   `/api/pdv/finalizar-venda` e marca `synced: true`. Um item que falhar não
   trava os outros — fica em `status: "failed"` com o erro salvo, e a
   próxima janela de conexão tenta de novo.

## O que ainda falta antes de produção

- **Ícone e identidade visual final** — a tela de login usa uma ilustração
  placeholder (SVG abstrato) no lugar da arte de marca.
- **Reconciliação de sessão de caixa aberta offline em duas máquinas** —
  hoje o app reaproveita a última sessão de caixa aberta em cache; abrir
  caixa de verdade (criar a sessão no servidor) exige estar online. Duas
  máquinas nunca abrem a mesma sessão ao mesmo tempo por engano porque cada
  uma só reaproveita a sessão que ELA MESMA abriu ou já viu.
- **Auto-update** — não configurado; cada versão nova exige reinstalar o
  `.exe` manualmente por enquanto.
- **Testes automatizados** — nenhum ainda neste pacote.
