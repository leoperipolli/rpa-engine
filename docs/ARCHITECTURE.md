# Arquitetura do Sistema RPA

## Contexto

Ferramenta para automatizar interações em sistemas TMS de transportadoras (sem API pública)
via gravação de ações no browser. Extensão Chrome grava, editor visual refina, e a execução
é disparada via API (n8n) ou dashboard.

**Escopo:** MVP (v1) — uso interno, sem multi-tenancy.

---

## Decisões Consolidadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Execução | 1 código = 1 execução (Opção B) | n8n controla o loop, retry granular por código |
| Sessão do browser | Persistente (login 1x por worker) | Evita re-login a cada código, ~5x mais rápido |
| Worker por receita | Dedicado (1 worker = 1 sistema TMS logado) | Browser logado num sistema não serve para outro |
| Runner fase 1 | Local no Windows (dev) | Praticidade durante desenvolvimento |
| Runner fase 2 | VPS Linux junto com n8n | Produção, mesmo servidor |
| Prioridade n8n | Acima do dashboard | n8n é mais crítico que dashboard no MVP |

---

## Fluxo Principal

```
┌──────────────────────────────────────────────────────────────┐
│  n8n (Workflow A - Sistema TMS 1)                            │
│                                                              │
│  1. SELECT codigo FROM tabela WHERE status='pendente'        │
│     AND sistema='tms1'                                       │
│  2. Para cada código:                                        │
│     └── POST /api/executions                                 │
│         { recipe_id: "tms1-consulta", inputs: { codigo } }   │
│  3. GET /api/executions/:id (polling até concluir)           │
│  4. Usa resultado no próximo nó                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP (API Key)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (Fastify)                                           │
│                                                              │
│  Recebe request → valida → cria job na fila                  │
│  Retorna execution_id imediatamente (assíncrono)             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  FILA (BullMQ + Redis)                                 │  │
│  │                                                        │  │
│  │  Fila por receita: queue:tms1-consulta                 │  │
│  │                    queue:tms2-consulta                  │  │
│  │                    queue:tms3-consulta ...              │  │
│  │                                                        │  │
│  │  Cada fila tem seu próprio pool de workers              │  │
│  └──────────────────────┬─────────────────────────────────┘  │
└─────────────────────────│────────────────────────────────────┘
                          │ jobs
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  RUNNER WORKERS (Playwright)                                 │
│                                                              │
│  Worker TMS1 ── browser aberto, logado no sistema 1          │
│  Worker TMS2 ── browser aberto, logado no sistema 2          │
│  Worker TMS3 ── browser aberto, logado no sistema 3          │
│  Worker TMS4 ── browser aberto, logado no sistema 4          │
│  Worker TMS5 ── browser aberto, logado no sistema 5          │
│                                                              │
│  Cada worker:                                                │
│  1. Verifica sessão (session.check.selector existe?)         │
│  2. Se expirada → executa session.login_steps                │
│  3. Executa steps da receita (navega, preenche, extrai)      │
│  4. Retorna resultado JSON                                   │
│  5. Pega próximo job da fila (browser continua aberto)       │
└──────────────────────────────────────────────────────────────┘
```

---

## Recipe JSON (formato final)

A receita tem duas seções separadas: **session** (login) e **steps** (ação principal).
O worker só executa o login quando a sessão expirou.

```json
{
  "id": "uuid",
  "name": "Consulta rastreamento TMS1",
  "version": 1,

  "inputs": [
    { "name": "codigo", "type": "string", "label": "Código de rastreamento" }
  ],

  "session": {
    "check": {
      "selector": ".usuario-logado",
      "description": "Elemento que só aparece quando logado"
    },
    "login_steps": [
      { "id": "l1", "type": "navigate", "url": "https://portal.example.com" },
      { "id": "l2", "type": "fill",     "selector": "#user", "value": "{{secrets.usuario}}" },
      { "id": "l3", "type": "fill",     "selector": "#pass", "value": "{{secrets.senha}}" },
      { "id": "l4", "type": "click",    "selector": "#btn-login" },
      { "id": "l5", "type": "wait",     "selector": ".usuario-logado", "timeout": 10000 }
    ]
  },

  "steps": [
    { "id": "s1", "type": "navigate", "url": "https://portal.example.com/rastreamento" },
    { "id": "s2", "type": "fill",     "selector": "#codigo", "value": "{{inputs.codigo}}" },
    { "id": "s3", "type": "click",    "selector": "#btn-buscar" },
    { "id": "s4", "type": "wait",     "selector": ".resultado", "timeout": 10000 },
    { "id": "s5", "type": "extract",  "selector": ".resultado", "output": "rastreamento" }
  ],

  "outputs": ["rastreamento"]
}
```

**Secrets** ficam criptografados (AES-256-GCM) no banco, vinculados à receita.
A chave de criptografia fica em variável de ambiente, nunca no banco.

---

## Modelo de Dados

```sql
recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  session_config  JSONB,           -- check + login_steps
  steps           JSONB NOT NULL,  -- array de passos principais
  inputs_schema   JSONB,           -- definição dos inputs dinâmicos
  secrets         BYTEA,           -- credenciais criptografadas (AES-256-GCM)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       UUID NOT NULL REFERENCES recipes(id),
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | running | success | failed
  inputs          JSONB,           -- inputs passados nesta execução (ex: { codigo: "ABC" })
  result          JSONB,           -- dados extraídos (preenchido ao concluir)
  error           TEXT,            -- mensagem de erro se falhou
  duration_ms     INTEGER,         -- tempo de execução em ms
  created_at      TIMESTAMPTZ DEFAULT now(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ
);

-- Índices para queries frequentes
CREATE INDEX idx_executions_recipe_status ON executions(recipe_id, status);
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);
```

---

## API Endpoints

```
# Receitas
POST   /api/recipes              → cria receita (com session + steps + secrets)
GET    /api/recipes              → lista receitas
GET    /api/recipes/:id          → detalhes (sem secrets descriptografados)
PUT    /api/recipes/:id          → atualiza
DELETE /api/recipes/:id          → remove

# Execuções
POST   /api/executions           → dispara execução
  body: { recipe_id, inputs: { codigo: "XYZ" } }
  response: { id, status: "pending" }

GET    /api/executions/:id       → status + resultado (n8n faz polling aqui)
  response: { id, status, result, error, duration_ms }

GET    /api/executions           → histórico (paginado)
  query: ?recipe_id=&status=&page=&limit=

# Autenticação
POST   /api/auth/login           → JWT (para dashboard)
POST   /api/auth/api-keys        → gera API Key (para n8n)

# Analytics
GET    /api/analytics/summary    → total execuções, taxa sucesso, tempo médio
  query: ?recipe_id=&period=7d
```

**Autenticação:**
- n8n → API Key no header `X-API-Key`
- Dashboard → JWT com refresh token
- Runner → JWT de serviço (emitido na inicialização)

---

## Runner Workers (detalhe)

### Ciclo de vida do worker

```
Worker inicia
  │
  ├── 1. Carrega receita + descriptografa secrets
  ├── 2. Lança browser headless (Chromium)
  ├── 3. Executa login (session.login_steps)
  ├── 4. Entra no loop de jobs:
  │     │
  │     ├── Pega próximo job da fila BullMQ
  │     ├── Verifica sessão (session.check.selector)
  │     │   └── Se expirou → re-login
  │     ├── Executa steps da receita
  │     ├── Retorna resultado (success + JSON) ou erro
  │     └── Volta ao início do loop
  │
  └── 5. Se ocorrer erro fatal → reinicia browser + re-login
```

### Step types suportados (MVP)

| Step | Ação | Playwright |
|---|---|---|
| `navigate` | Abre URL | `page.goto(url)` |
| `click` | Clica em elemento | `page.click(selector)` |
| `fill` | Preenche campo | `page.fill(selector, value)` |
| `select` | Seleciona option | `page.selectOption(selector, value)` |
| `wait` | Aguarda elemento ou tempo | `page.waitForSelector` / `page.waitForTimeout` |
| `extract` | Extrai texto/HTML | `page.locator(selector).textContent()` |
| `screenshot` | Captura tela (debug) | `page.screenshot()` |
| `download` | Aguarda download | `page.waitForEvent('download')` |
| `upload` | Upload de arquivo | `page.setInputFiles(selector, path)` |

### Concorrência

```
5 sistemas TMS = 5 filas BullMQ = mínimo 5 workers (1 por sistema)

Para mais velocidade: múltiplos workers por sistema
  Ex: 3 workers para TMS1 = 3 browsers logados = 3 códigos simultâneos

Env vars:
  WORKER_TMS1_CONCURRENCY=1
  WORKER_TMS2_CONCURRENCY=1
  ...
```

---

## Estimativa de Performance

| Cenário | Tempo/código | 2.000 códigos | 10.000 códigos |
|---|---|---|---|
| 1 worker, sessão persistente | ~5s | ~2.8h | ~14h |
| 3 workers por sistema | ~5s | ~55min | ~4.6h |
| 5 workers por sistema | ~5s | ~33min | ~2.8h |
| 10 workers por sistema | ~5s | ~17min | ~1.4h |

RAM por worker: ~150-300MB. Com 5 workers (1 por sistema): ~1-1.5GB total.

---

## Stack Tecnológica

| Componente | Tecnologia | Motivo |
|---|---|---|
| Monorepo | pnpm workspaces | Compartilha pacote `types` entre todos |
| Backend | Node.js + Fastify + TypeScript | Rápido, tipado, ecossistema amplo |
| Banco | PostgreSQL | Robusto, JSONB nativo |
| Fila | Redis + BullMQ | Job queue madura, retry, concorrência |
| Runner | Node.js + Playwright | Melhor lib de automação, cross-platform |
| Dashboard | Next.js + Tailwind | Familiaridade, fullstack |
| Extension | TypeScript + Manifest V3 | Padrão atual do Chrome |
| Tipos | Zod + TypeScript | Validação runtime + type safety |

---

## Estrutura do Monorepo

```
rpa/
├── packages/
│   ├── types/            ← Recipe, Step, Execution (Zod schemas + TS types)
│   ├── backend/          ← Fastify API + BullMQ producer
│   ├── runner/           ← Playwright workers + BullMQ consumer
│   ├── dashboard/        ← Next.js
│   └── extension/        ← Chrome Extension MV3
├── docs/
│   ├── ARCHITECTURE.md   ← este arquivo
│   └── ROADMAP.md        ← status e próximos passos
├── docker-compose.yml    ← PostgreSQL + Redis (dev local)
├── package.json          ← pnpm workspaces
└── .env.example
```

---

## Segurança

| Aspecto | Solução |
|---|---|
| API externa (n8n) | API Key no header `X-API-Key` |
| Dashboard | JWT com refresh token |
| Credenciais dos TMS | AES-256-GCM, chave em env var, nunca no banco em texto |
| Dados em trânsito | HTTPS em produção |
| Runner ↔ Backend | JWT de serviço |
| Secrets nos logs | Nunca logados, mascarados em qualquer output |

---

## Ordem de Desenvolvimento

### Fase 1 — Core (semana 1)
1. `packages/types` — schemas Zod: Recipe, Step, Execution
2. `docker-compose.yml` — PostgreSQL + Redis local
3. `packages/backend` — API mínima: CRUD recipes + POST/GET executions + BullMQ producer
4. `packages/runner` — worker Playwright: consome fila, executa steps, sessão persistente
5. **Teste E2E:** receita JSON escrita à mão → POST /executions → runner executa → GET /executions/:id retorna resultado

### Fase 2 — Integração n8n
6. Configurar n8n workflow: query banco → loop → POST /executions → polling → próximo nó
7. Testar fluxo completo com um sistema TMS real

### Fase 3 — Interface
8. `packages/extension` — gravação de ações → gera Recipe JSON com session separado
9. `packages/dashboard` — tela para gerenciar receitas, disparar e ver resultado

### Fase 4 — Polimento
10. Analytics (taxa de sucesso, tempo médio)
11. Exportação Excel dos dados extraídos
12. Tratamento de erros avançado
