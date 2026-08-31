# REPCO DISCOVERY INTELLIGENCE MVP — Implementation Report
**Data:** 31/08/2026 · **Task:** INTEL-1 · **Escopo:** subaba "Descobrir" na Prospecção RepCo (Google Places reuso + WhatsApp grupos públicos nova camada) · **Status:** ✅ **construído, deployado e pronto** — falta só o **run Apify ao vivo** (billing Apify + sessão admin), que **você** fará.

## 0. Resumo executivo
- MVP **completo e verificado** em tudo que não depende de um run pago ao vivo: migrations aplicadas, edge function deployada e gated, UI renderizando, typecheck/build limpos, CORS corrigido.
- **Bloqueador do run ao vivo:** a conta Apify conectada retornou **"Too many outstanding invoices"** (faturas em aberto). Como você disse, **vai quitar e rodar depois** — o MVP fica a **um clique** ("Buscar oportunidades").
- **Nada de novo CRM.** Reutiliza `prospect_runs`, pools/leads, padrão da `apify-places`, e a biblioteca de keywords migrada. Grupo/comunidade **não vira lead** — só após aprovação humana quando o tipo permitir.

## 1. Arquitetura final
```
Admin → RepCo → Prospecção
  ├── Listas / Importar   (existente, intacto)
  ├── Atribuir pools      (existente, intacto)
  └── Descobrir           (NOVO — DiscoveryPanel)
        │  campanha + keywords(chips/grupos) + região + fontes
        ▼
   discoveryClient.startRun ──► edge: discovery-run (action=start)
        │                          │ gate is_admin() · APIFY_TOKEN só no env
        │                          ▼ adapter por source → dispara actor Apify
        │                        prospect_runs (estendido: source_type/provider/actor_id/...)
        ▼ poll (action=status) ◄───┘
   discoveryClient.importResults
        │ normaliza → dedup(canonical_url|external_id) → score(0-100) → grava
        ▼
   discovery_results (TIPADO: PUBLIC_WHATSAPP_GROUP | BUSINESS | ...)
        │ status new→reviewing→approved/dismissed/duplicate/stale
        ▼ [APROVAR] humano → (BUSINESS) pode ir p/ prospect_leads (reuso) ; (GRUPO) fica COMMUNITY
```

## 2. Migrations (aplicadas em produção via exec_migration)
- `supabase/migrations/20260831120000_discovery_intelligence.sql`
  - **`discovery_keywords`** (term, group_name, segment, sources[], active, company_id) — biblioteca editável.
  - **`discovery_campaigns`** (name, country, region_state/city, sources[], keywords[]).
  - **`discovery_results`** (source, **result_type**, title, description, public_url, keyword, country/state/city, external_id, **canonical_url**, member_count, provider, actor_id, **raw_payload**, **score**, **score_factors**, **status**, converted_prospect_lead_id, discovered_at, last_checked_at). Índices únicos de dedupe: `(company_id, canonical_url)` e `(company_id, provider, external_id)`.
  - **`prospect_runs` estendido** (aditivo): `source_type, provider, actor_id, actor_version, result_count, campaign_id, country, cost_actual_usd`.
  - RLS **admin-only** nas 3 tabelas novas (`is_admin()`).
- `supabase/migrations/20260831120500_discovery_keywords_seed.sql`
  - **187 keywords** semeadas: **46** dos 6 grupos WhatsApp (REPRESENTANTES 8 · AFILIADOS 9 · CAFÉ 9 · VAREJO 8 · FOOD SERVICE 6 · REGIONAL 6) + **141** migrados do `prospectKeywords.ts` (119 `google_places` + 22 `web`/fora-do-mapa) preservando **categorias, segmentos e canal**.

## 3. Arquivos alterados/criados
| Arquivo | O quê |
|---|---|
| `supabase/functions/discovery-run/index.ts` | **NOVO** edge (account/start/status; adapters por actor; gate admin; token só no env) — **deployada** |
| `src/lib/discoveryClient.ts` | **NOVO** start/poll/normalize/dedupe/score/import + CRUD |
| `src/components/admin/DiscoveryPanel.tsx` | **NOVO** UI da subaba Descobrir |
| `src/components/admin/ProspectionAdmin.tsx` | **ESTENDIDO** 3ª aba "Descobrir" (sem regressão) |
| 2 migrations | schema + seed |

## 4. Actor (auditado pela API Apify)
- **`lofomachines/whatsapp-group-search`** — "WhatsApp Group Link Search".
  - **Disponível**, não-deprecated (atualizado 03/08/2026), 221 usuários. Categorias: Social Media / Lead Generation.
  - **Somente links públicos** de grupos (invite_url) — **não entra no WhatsApp**, não lê mensagens, não coleta membros. ✅ conforme regra de privacidade.
  - **BR suportado** (enum `country` inclui BR).
- Prontos no adapter (ligar quando quiser): `memo23/whatsapp-channel-search` (canais) e, como fallback, `scrapier/whatsapp-group-links-scraper`.
- Baseline BUSINESS: `compass/crawler-google-places` (o mesmo já usado na Prospecção) — prova que a nova camada trata BUSINESS **e** comunidade.

## 5. Input usado (adapter whatsapp_group)
```json
{ "keywords": ["representantes comerciais café", "vendedores de café", "distribuidores de café"],
  "country": "BR", "maxGroups": 10 }
```
> Campanha de teste pronta na UI: **"WHATSAPP — CAFÉ & VENDAS SP — TESTE"**. Basta abrir os grupos (botões) para preencher as keywords.

## 6. Output normalizado (mapeamento)
| Campo do actor | → discovery_results |
|---|---|
| `name` | `title` |
| `description` | `description` |
| `invite_url` | `public_url` + `canonical_url` (`wa:<invite_code>`) |
| `invite_code` | `external_id` |
| `keyword`/`search_term` | `keyword` |
| `country` | `country` |
| (todo o item) | `raw_payload` (jsonb) |
| — | `result_type` = `PUBLIC_WHATSAPP_GROUP` |
> O actor **não** retorna nº de membros → `member_count` = null (não inventamos).

## 7. Dedupe
- **Canonical URL** de WhatsApp = `wa:<invite_code>` (ou o código extraído de `chat.whatsapp.com/<code>`), não o nome.
- Business = `gp:<placeId>` (ou URL sem query/fragment).
- Dedup em 3 camadas: dentro do lote → contra o banco (query `canonical_url`) → índice único no Postgres.

## 8. Score determinístico (0–100, com fatores gravados)
`keyword_match(20) + niche(20) + region(15) + has_description(15) + public_size(10) + has_url(10) + completeness(10)` → guardado em `score_factors`. Faixas: **Alta ≥70 · Média 40–69 · Baixa <40**. Sem LLM.

## 9. Aprovação
- Resultado nasce `new`. Ações na tabela: **Abrir link · Aprovar · Descartar**. `approved`/`dismissed` gravados na hora.
- **Grupo/comunidade permanece COMMUNITY/DISCOVERY** — não vira lead. BUSINESS aprovado pode, num passo seguinte, ir para `prospect_leads` (reuso do pipeline) — gatilho de conversão fica como próximo incremento.

## 10. Orçamento / custo Apify (auditado)
| Item | Valor |
|---|---|
| Prospecção (Google Places) | **$1,50 total** · $0,40 no mês · 429 places |
| Auto-limite no código (Places) | ~1000 places/mês (≈$2) |
| Studio / Price Intel | Apify **não rastreado em DB** (só console Apify) |
| Custo do teste WhatsApp | **~$0,05/run + $0,015/resultado**; free tier limita a **20/run** → **teto ~$0,35/run** |
| Saldo/faturas da conta | **BLOQUEADA — "outstanding invoices"** (resolver no painel Apify) |
> O run agora grava `cost_actual_usd` real (do `usageTotalUsd` da run) no histórico.

## 11. Resultados do teste
- **Actor validado por schema/metadata** (disponível, BR, público, custo baixo).
- **Run ao vivo NÃO executado** — a conta Apify está com faturas em aberto e eu **não tenho sessão de admin** (não insiro senha). Conforme seu pedido, **você quita e roda**. No 1º run real o report se completa com output/custo/dedupe/score reais.

## 12. Verificações feitas (o que está CERTO)
- ✅ `typecheck` + `build` limpos.
- ✅ Migrations aplicadas (3 tabelas + `prospect_runs` estendido + 187 keywords).
- ✅ Edge function **deployada** e **gated** (403 sem admin) — reachable.
- ✅ **CORS corrigido** (`x-client-info`) — bug pego no harness de render e resolvido/redeployado.
- ✅ Painel **renderiza** (campanha, chips, grupos, região, 3 fontes, buscar, resultados, histórico, métricas, banner de billing).
- ✅ Sem regressão nas abas Listas/Pools.

## 13. Riscos
- **Billing Apify** (bloqueador do run — na sua conta).
- **Qualidade dos resultados do actor** só se comprova no 1º run real (nomes de grupo podem ser amplos; o score + aprovação humana filtram).
- **LGPD:** só links públicos; discovery ≠ consentimento de contato. Proibido entrar em grupo/raspar membros/mensagens/spam (respeitado — o actor só descobre links).
- **Conversão BUSINESS→lead** ainda é manual (próximo incremento).

## 14. Próximos passos
1. **Você:** quitar Apify → abrir Admin → RepCo → Prospecção → **Descobrir** → carregar grupos (ex.: CAFÉ/REPRESENTANTES) → **Buscar oportunidades** (comece com máx. 10).
2. Validar output real → ajustar score/normalização se necessário.
3. Ligar **canais** (`memo23`) e, se houver ganho, o fallback `scrapier`.
4. Botão **"Enviar BUSINESS aprovado → prospect_leads"** (reuso do pipeline).
5. Aba **"Minhas palavras-chave"** com taxa de aproveitamento por keyword (funil keyword→descoberta→aprovado).

---

## 15. Discovery Intelligence HUB — multi-source (foundation)
Ajuste de **foundation** (não expansão de escopo): a subaba nasce como **hub multi-fonte**, não WhatsApp-específica.

**Fontes — estado:**
| Fonte | result_type | Estado |
|---|---|---|
| Google Places (`compass/crawler-google-places`) | BUSINESS | ✅ **já existia** (reusada como baseline/prova de compatibilidade) |
| WhatsApp grupos (`lofomachines/whatsapp-group-search`) | PUBLIC_WHATSAPP_GROUP | ✅ **integrada** (adapter + normalizer; run pendente de billing) |
| WhatsApp canais (`memo23/whatsapp-channel-search`) | PUBLIC_WHATSAPP_CHANNEL | 🟡 **preparada** (adapter no registry; ligar após validar) |
| Base CNPJ (`prospects_b2b`, 758k) | BUSINESS | 🟡 **preparada** (fonte interna grátis; adapter futuro) |
| TikTok / Instagram / creators / afiliados / Web | CREATOR/AFFILIATE/INFLUENCER/PUBLIC_SOCIAL_* | ⚪ **futuras** (só entram com actor validado — sem checkbox fake) |

**Como um novo Actor entra SEM refazer UI/banco:** (1) adiciona um adapter na edge `discovery-run` (source→actor→input); (2) um `case` em `normalizeItem`; (3) uma entrada em `DISCOVERY_SOURCES`. `discovery_results` e a UI **não mudam de forma** — a diferenciação é por `result_type/source/provider/actor/campaign/keyword/score`. A UI já filtra por tipo/fonte/status e lista o registry em **"Fontes & Agentes (infra)"**.

**Como Creator Intelligence reutiliza esta foundation depois:** `discovery_results` já tem `follower_count/engagement_rate/niche/confidence` + `raw_payload` (proveniência) + score/status. Um `CreatorNormalizer` (TikTok/Instagram) grava `result_type=CREATOR/AFFILIATE` nas **mesmas colunas** — sem migration. Creator/Affiliate **nunca** viram `prospect_leads`; após aprovação humana, alimentam programas próprios (Creator/Affiliate), que são **camadas futuras separadas**.

## 16. ARCHITECTURE CHALLENGE — veredito
**Sem blocker.** Nenhuma decisão da INTEL-1 impede ou encarece Partner Network / Creator Intelligence / Affiliate / Commission Engine / multi-channel attribution:
- `discovery_results ≠ prospect_leads` + `result_type` aberto → creator/affiliate/rep como **tipos próprios** (não leads). ✅
- Registry/adapters → novas fontes sem refazer UI/banco. ✅
- Custo por `source/actor/run/campaign` já registrado → comparação futura de custo-por-resultado/lead/creator. ✅
- **Commission/attribution ficam FORA do Discovery** (correto): Discovery é topo do funil. Venda→atribuição→comissão→payout são um **futuro REPCO COMMISSION ENGINE** separado — a foundation não os bloqueia nem os antecipa. ✅
- `converted_prospect_lead_id` cobre o caminho BUSINESS→lead; conversões de parceiro (creator→programa) adicionam suas próprias referências depois (aditivo). ✅

**Não implementado (por design, conforme pedido):** Commission Engine, Partner Portal, pagamentos, tracking de afiliados, integração TikTok, Creator Program, Ai.Bot autônomo, aba "Agents". A UI operacional continua **RepCo → Prospecção → Descobrir**; agentes/actors ficam **atrás** da interface (visão "Fontes & Agentes" = administração da infra).
