# CURRENT_STATE_AUDIT — RepCo C.I.E.
**Data:** 28/07/2026 · **Branch:** `repco-cie` · **Escopo:** auditoria read-only, sem alterar produção.

## 1. Stack
- **Front:** React 18 + TypeScript + Vite + TailwindCSS. Router **custom** em `src/App.tsx` (não usa react-router-dom apesar de instalado).
- **Back/infra:** **Supabase** — Postgres, Auth, Storage, RLS. **Edge Functions** (Deno).
- **Deploy:** Vercel (auto-deploy no `push` em `main`). `vercel.json` usa `routes` (estáticos antes do catchall SPA).
- **SQL em produção:** via RPCs `exec_migration` (DDL/DML) e `exec_select` (SELECT).

## 2. Navegação admin (confirmada pelo proprietário 28/07/2026)
`Dashboard · Pedidos · Produtos · Clientes · Transportadoras · RepCo · Studio · Inteligência · Mensagens · Inventário · Configurações · Ajuda`
- **Studio** = Marketing Studio (engenharia reversa + campanhas + publicação).
- **Inteligência** = camada de inteligência do RepCo (hoje visão comercial). É o encaixe natural do C.I.E.

## 3. Módulos existentes
| Módulo | Estado |
|---|---|
| Loja B2C (`/`) | Parcial (assinatura v1 feita; falta e-mail de confirmação, busca, etc.) |
| Admin (`/admin`) | Operacional |
| RepCo (`/repco`) | Sólido: pedidos, comissões, rotas, promotores, mapa ao vivo |
| **Studio** | Upload→Whisper→Claude→campanha→publicar (IG); importador IG + snapshots de seguidores |
| Assinatura B2C | v1 (cobrança 1º ciclo); falta recorrência |
| Lotes/Inventário | Cadeia de custos verde→torra→embalagem |

## 4. Banco de dados
- **97 tabelas** no schema `public`. RLS ligada (auditado 13/07/2026, 45/45 tabelas core).
- Funções de segurança: `public.is_admin()`, `public.my_rep_id()`.
- Tabelas Studio: `studio_videos`, `studio_transcriptions`, `studio_analyses`, `studio_campaigns` (+mídia/publish), `studio_social_connections`, `studio_brand_profiles`, `studio_profile_snapshots` (novo — seguidores/posts no tempo).
- Extensões ativas: `pg_cron`, `pg_net`, `pgcrypto`, `supabase_vault`, `uuid-ossp`, `pg_stat_statements`. **Sem `pgvector`.**

## 5. Pipeline de IA (já em produção)
- **Whisper** (`whisper-1`) transcreve vídeo em `process-studio-video`.
- **Claude** (`claude-sonnet-5`, tratando bloco `thinking`) analisa → JSON estruturado.
- **Visão** (Claude) para fotos (base64) no mesmo edge.
- **Perfil de marca persistente** (`studio_brand_profiles`) injetado no system prompt (adapta tudo à Saporino).

## 6. Edge Functions
`process-studio-video`, `studio-import-instagram`, `studio-ig-thumb`, `publish-instagram`, `publish-scheduled`, `publish-tiktok`, `refresh-instagram-token`, `tiktok-oauth`, `apify-places`, `ecommerce-scrape`, `vtex-scrape`, `cepea-cafe`, `create-payment`, `mercadopago-webhook`, `send-password-reset`, `sync-tracking`, `promoter-signup`, `repco-delete-client`, `scraper-reminder`, `chat-upload`.

## 7. Scheduler (pg_cron — 6 jobs)
`studio-publish-scheduled` (5min), `studio-refresh-ig-token` (30min), `cepea-cafe-daily`, `mark-inactive-reps`, `scraper-reminder-15d`, `sync-tracking-every-6h`.

## 8. Storage
Buckets: `studio-videos` (mídia Studio + campanhas), `invoices`, `lot-documents` (privado), `products`.

## 9. Auth & papéis
Supabase Auth. RBAC "um console, abas por papel" (`is_admin`, `my_rep_id`, promotor, director). Separação de identidade rep/admin.

## 10. Integrações sociais
- **Instagram:** conectado (token `IGAA…` = Instagram Login, `graph.instagram.com`), publica + auto-refresh de token.
- **TikTok:** OAuth + publish construídos; conexão **pendente** de aprovação/sandbox.
- **YouTube:** não integrado.
- **Apify:** raspagem de IG (posts, seguidores) via token existente.

## 11. Lacunas relevantes (resumo — ver GAP_ANALYSIS)
Sem fila real, sem observabilidade/log estruturado, sem banco vetorial, sem testes no app, sem redação de PII, multi-tenant não isolado (só `company_id`), sem taxonomia/Evidence Graph/Market Memory, sem análise de comentários.

## 12. O que NÃO tocar (preservar)
Todo o RepCo operacional, Studio, publicação, crons, RLS existente. Qualquer evolução do C.I.E. deve ser **aditiva** e atrás de feature flag.
