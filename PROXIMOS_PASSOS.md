# VetAnesthesia — Próximos Passos

## Sprint 0 — Anti-perda de dados (PRIORIDADE MÁXIMA)

> **Caso real (Giovana, 24/04/2026, ficha #70 Alemão/Resgatado):** ficha criada às 15:53 BRT,
> nunca mais atualizada no servidor. `created_at == updated_at` ao milissegundo. Dados de
> indução, manutenção, vitais, intercorrências, pós-operatório — todos perdidos. Causa raiz
> mais provável: bug em `frontend/public/sw.js:95` descartando PUTs com 4xx (token expirado /
> validação) silenciosamente da fila offline.
>
> **Princípio inegociável:** uma vez digitado, o dado nunca pode sumir sem confirmação
> explícita da usuária. Sinal ruim, bug, browser crash, deploy quebrado — irrelevante. O dado
> vive no celular dela em durabilidade-grau-medico até que o servidor confirme por round-trip
> que está salvo.

### S0.1 — Migrar drafts de localStorage para IndexedDB
- [ ] Criar `frontend/src/lib/draftStore.js` com API: `appendSnapshot(surgeryId|localId, data)`,
      `listSnapshots(surgeryId)`, `latestSnapshot(surgeryId)`, `listAllPendingDrafts()`,
      `purgeOlderThan(snapshotId)`, `purgeSurgery(surgeryId)`
- [ ] Schema IndexedDB `vetanestesia_drafts` (DB) com 2 stores:
      `snapshots` (autoIncrement id, surgeryId|localId, savedAt, data, syncStatus, contentHash)
      `surgeries` (keyPath: surgeryId|localId — metadata: patientName, lastEditAt, syncStatus)
- [ ] Substituir `saveDraftToStorage` em `FichaForm.jsx` pelo novo store
- [ ] Migration de chaves antigas: ler `vetanestesia_draft_*` no boot, importar pro IndexedDB,
      manter localStorage por 30 dias como fallback de leitura

### S0.2 — Journal append-only com últimos N snapshots
- [ ] Em vez de sobrescrever, todo save cria um novo snapshot (autoIncrement)
- [ ] Manter últimos 30 snapshots por ficha; podar mais antigos só após confirmação de sync
- [ ] **Invariante anti-zero**: se novo snapshot tem menos campos preenchidos que o último
      snapshot sincronizado, marcar com flag `suspicious=true` e não usar como fonte de
      restore automático (só manual via UI)
- [ ] Hash de conteúdo (sha-1 dos campos) pra detectar saves redundantes e não inflar journal

### S0.3 — Persistência durável (sobrevive ao Safari iOS)
- [ ] Chamar `navigator.storage.persist()` no boot do app, mostrar consentimento se negado
- [ ] Logar `navigator.storage.estimate()` no header de debug (admin)
- [ ] Documentar: PWAs instaladas no iOS recebem persist automaticamente

### S0.4 — Cadência de save agressiva
- [ ] Save no debounce 1s após qualquer mudança (hoje 2s)
- [ ] Save extra em: `visibilitychange` (page hide), `pagehide`, `blur` na window,
      `online` event, perda de foco do form, abertura/fechamento de seção
- [ ] Heartbeat de 30s mesmo sem mudanças (re-marca timestamp, garante "está vivo")

### S0.5 — Sync engine robusta (substituir SW queue atual)
- [ ] Novo `frontend/src/lib/syncEngine.js` que processa fila do IndexedDB (não do SW)
- [ ] Cada snapshot do journal vira tarefa de sync; tenta PUT; ACK só com round-trip GET
      comparando hash dos campos enviados vs retornados
- [ ] Backoff exponencial: 1s, 5s, 30s, 2min, 10min (max), retry indefinido
- [ ] Tratamento de status:
      - `200/201` + GET confirma → marca snapshot `synced`
      - `200/201` + GET diverge → marca `synced_with_conflict`, surface no UI
      - `401/403` → dispara re-auth, NÃO descarta da fila
      - `400/422` → marca `validation_error`, surface no UI ("3 alterações precisam de revisão"),
        NÃO descarta
      - `423` (signed lock) → marca `locked`, NÃO descarta
      - `5xx` ou network error → backoff, retry indefinido
- [ ] Aposentar a fila do `sw.js` (manter SW só pra cache de assets/GET)

### S0.6 — Fix imediato do bug atual no Service Worker (mitigação)
- [ ] `sw.js:95` — trocar `response.ok || response.status < 500` por `response.ok` apenas
- [ ] Adicionar deduplicação: hash do `(url+body)` antes de enfileirar; idempotency key por item
- [ ] **Importante:** este fix é tampão até S0.5 substituir a SW queue

### S0.7 — UI de descoberta: "Rascunhos não sincronizados"
- [ ] Nova rota `/rascunhos` listando todos os drafts com `syncStatus != 'synced'`
- [ ] Cada item: nome do paciente, procedimento, última edição, status (pendente/erro/conflito),
      tamanho do journal (nº de snapshots), aparelho de origem (opcional)
- [ ] Ações por item:
      - **Tentar sincronizar agora** (force flush)
      - **Restaurar pra ficha existente** (se já tem surgeryId)
      - **Criar nova ficha a partir do rascunho**
      - **Ver histórico de snapshots** (timeline com diff)
      - **Descartar** (com confirmação explícita)
- [ ] Badge no menu/home: "⚠ 3 fichas pendentes de sincronização"

### S0.8 — Indicador permanente de sync no FichaForm
- [ ] Header da ficha mostra sempre 2 status:
      - **Local:** "✓ salvo no celular há 2s" / "⚠ não consegui salvar localmente" (raro)
      - **Servidor:** "↑ sincronizado há 12s" / "⏳ aguardando sinal — 5min sem sync" /
        "❌ erro: token expirado — toque pra entrar"
- [ ] Tap no indicador abre modal com detalhes (últimos 5 saves, retry manual)

### S0.9 — Round-trip de confirmação antes de apagar rascunho local
- [ ] Após PUT/POST 200, fazer GET da ficha
- [ ] Comparar campos enviados vs retornados (hash)
- [ ] Só marcar snapshot como `synced` se bate
- [ ] Se diverge: manter snapshot local, marcar `synced_with_conflict`, alertar usuária

### S0.10 — Política de purga de rascunhos
- [ ] Drafts `synced` de fichas com `status = 'completed'` ou `'cancelled'`: purgar após 7 dias
- [ ] Drafts de fichas `signed`: purgar após 7 dias do sign
- [ ] Drafts órfãos (sem surgeryId, sem edição há 30 dias): manter por padrão, oferecer purga manual

### S0.11 — Telemetria mínima de perda de dados
- [ ] Quando um snapshot fica >10min em `pending` ou >3 retries falhos: enviar evento ao
      servidor (endpoint `POST /api/telemetry/sync_stuck`) com user_id, surgery_id, status code
- [ ] Backend grava em tabela `sync_failures` pra a gente conseguir investigar antes da
      usuária reclamar

### S0.12 — Hardening do submit final (assinatura ↔ rascunho)
- [ ] Antes de assinar (`/signatures/sign`), forçar flush do journal e bloquear até `synced`
- [ ] Mostrar checklist pra usuária: "✓ Todos os dados sincronizados antes de assinar"
- [ ] Após sign confirmado, journal vira read-only (preservado por 7d, depois purgado)

---

## Sprint 1 — Segurança crítica
- [ ] Rotacionar Supabase service key e JWT secret
- [ ] Remover hardcoded secrets do código (usar env vars obrigatórias, falhar se ausente)
- [ ] Remover senha admin hardcoded em `backend/db/database.js:39`
- [ ] Configurar CORS com domínio específico (remover wildcard `*`)
- [ ] Fix SQL injection em `backend/routes/bottles.js:223` (parametrizar IN clause)

## Sprint 2 — Integridade de dados
- [ ] Adicionar phase `manutencao` no state inicial do FichaForm (legacy data loss)
- [x] ~~Fix Service Worker: 4xx não é sucesso~~ → tratado em S0.6 e S0.5
- [ ] Adicionar error handling nos `.catch(() => {})` silenciosos (Fichas.jsx, FichaForm.jsx, FichaDetail.jsx)
- [ ] Criar/verificar tabelas `controladoria` e `controladoria_config` no Supabase
- [ ] Fix field name mismatch: `presentation_type` vs `presentation` em FichaForm.jsx:216,253

## Sprint 3 — Infraestrutura
- [ ] Configurar HTTPS/SSL no nginx
- [ ] Adicionar security headers (X-Frame-Options, CSP, X-Content-Type-Options)
- [ ] Containers Docker como non-root user
- [ ] Rate limit no endpoint `/signatures/validate/:code` (brute force risk)
- [ ] Limite máximo de paginação em medicines (`Math.min(limit, 100)`)
- [ ] Fortalecer código de verificação de assinatura (mais de 4 dígitos random)

## Sprint 4 — Melhorias
- [ ] Unificar nginx configs (deploy/ vs frontend/)
- [ ] Padronizar env var naming (CORS_ORIGIN vs CORS_ORIGINS)
- [ ] Token refresh mais frequente + aviso ao usuário antes de expirar
- [ ] Audit logging para operações sensíveis (create, delete, payment)
- [ ] Helmet config mais restritiva
- [ ] Submit com rollback parcial (se fármaco #3 falha, reverter #1 e #2)

## Bugs reportados (pendentes de investigação)
- [x] ~~Intercorrências não salvando/aparecendo no PDF~~ (corrigido em commit 92aa592)
- [x] ~~Tempo de infusão não salvando~~ (corrigido em commit 92aa592)

## WIP não commitado (sessão atual)
- Backend: bloqueio de edição em fichas assinadas (HTTP 423) em surgeries.js
- Backend: endpoint `GET /surgeries/check-conflict` para detectar duplicatas
- Frontend: modal de conflito em FichaForm e botão "Editar" desabilitado em FichaDetail quando há assinatura

---
*Atualizado em 2026-04-25 após investigação do caso Giovana/Alemão. Sprint 0 inserido como prioridade absoluta.*
