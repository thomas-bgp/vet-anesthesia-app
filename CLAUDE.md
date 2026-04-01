# VetAnesthesia - Instruções do Projeto

## Deploy (Coolify)

### Fluxo completo: commit + push + deploy

```bash
# 1. Commit
cd C:/Projects/vet-anesthesia-app
git add <arquivos>
git commit -m "feat: descrição da mudança"

# 2. Push
git push origin master

# 3. Deploy no Coolify (via Playwright)
node C:/Projects/vet-deploy.js
```

### IDs do Coolify

| Campo | Valor |
|-------|-------|
| Projeto | `umabhgw0pcai58l8p6rz9nlq` |
| Environment | `f1dutt2jx560mfit3n70iwai` |
| Application | `eai9xnrj7wy9hqjxnvgkldbx` |
| URL do app | Vet Anesthesia > production > vet-anesthesia (localhost) |
| Deploy page | `http://187.77.238.125:8000/project/umabhgw0pcai58l8p6rz9nlq/environment/f1dutt2jx560mfit3n70iwai/application/eai9xnrj7wy9hqjxnvgkldbx` |

### Script de deploy: `C:/Projects/vet-deploy.js`

Faz login no Coolify, navega até o app Vet Anesthesia e clica Deploy automaticamente.

## Stack

- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4
- **Backend**: Node.js 20 + Express 4 + SQLite (better-sqlite3)
- **Auth**: JWT 30d com auto-refresh
- **Infra**: Docker single-container (nginx + node), Coolify

## Estrutura

```
backend/
  db/database.js     ← Schema + migrations (ALTER TABLE pattern)
  routes/            ← API routes (auth, surgeries, medicines, stock, etc.)
  middleware/        ← JWT auth, validation
frontend/
  src/pages/         ← Páginas (FichaForm, FichaDetail, Fichas, Estoque, etc.)
  src/components/    ← Componentes compartilhados (EmergencyModal)
  src/context/       ← AuthContext
  public/sw.js       ← Service Worker com offline queue
```

## Convenções

- Commits em português, prefixo `feat:` / `fix:` / `refactor:`
- Mobile-first, tema teal, min-h-[44px] em botões touch
- Schema evolui via `addSurgeryCol()` em database.js (sem migrations formais)
- Fármacos organizados por fase: mpa, inducao, manutencao, infusao, transoperatorio, pos_operatorio
