# VetAnesthesia — Próximos Passos

## Sprint 1 — Segurança crítica
- [ ] Rotacionar Supabase service key e JWT secret
- [ ] Remover hardcoded secrets do código (usar env vars obrigatórias, falhar se ausente)
- [ ] Remover senha admin hardcoded em `backend/db/database.js:39`
- [ ] Configurar CORS com domínio específico (remover wildcard `*`)
- [ ] Fix SQL injection em `backend/routes/bottles.js:223` (parametrizar IN clause)

## Sprint 2 — Integridade de dados
- [ ] Adicionar phase `manutencao` no state inicial do FichaForm (legacy data loss)
- [ ] Fix Service Worker: 4xx não é sucesso (`sw.js:95`), adicionar deduplicação
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
- [ ] Intercorrências não salvando/aparecendo no PDF
- [ ] Tempo de infusão não salvando

---
*Gerado em 2026-04-13 pela auditoria de código*
