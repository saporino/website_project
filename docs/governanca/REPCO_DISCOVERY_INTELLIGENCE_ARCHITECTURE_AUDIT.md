# REPCO DISCOVERY INTELLIGENCE — Architecture Audit
**Data:** 31/08/2026 · **Tipo:** auditoria read-only + proposta de encaixe (NÃO implementa nada) · **Escopo:** evoluir a Prospecção RepCo com camada de descoberta (Apify + futuros providers).

## 0. Veredito rápido
- **Classificação:** ✅ **IMPORTANTE / NÃO BLOQUEANTE** (confirmo sua avaliação). Não interrompe o Site Sprint nem a fila 009+.
- **O lugar é o certo:** ✅ **subaba dentro de RepCo → Prospecção** ("Descobrir"). Não criar aba principal nova no Admin. A estrutura de abas já existe e encaixa exatamente.
- **Não é greenfield:** a Prospecção RepCo **já é um sistema real e usado** — **7 runs Apify → 228 leads em 3 pools**. Discovery Intelligence é **evolução**, não sistema novo.
- **A decisão arquitetural central:** hoje **todo resultado do Apify vira LEAD** (`prospect_leads`). Discovery precisa de uma camada de **resultados TIPADOS** onde *nem tudo é lead* (um grupo de WhatsApp ≠ lead). **Essa é a única peça de dados genuinamente nova.** O resto se reutiliza.

---

## 1. Auditoria — o que já existe (e o que fazer com cada peça)

### 1.1 Interface (Admin → RepCo → Prospecção)
| Componente | Papel hoje | Veredito |
|---|---|---|
| `ProspectionAdmin.tsx` | Container com abas **`listas` / `pools`** + botão **"Buscar leads no mapa (Apify)"** | **ESTENDER** — adicionar 3ª aba `descobrir` (troca trivial: `type Tab = 'listas'\|'pools'\|'descobrir'`) |
| `ProspectionManager.tsx` | Aba "Listas / Importar" (tabela de listas/pools, importar CSV/XLSX) | **REUTILIZAR** (destino de resultados aprovados) |
| `PoolAssignment.tsx` | Aba "Atribuir pools" (distribui pool → representante) | **REUTILIZAR** (atribuição pós-aprovação) |
| `RepCoCoverageMap.tsx` + `ApifyRunModal.tsx` | O botão "Buscar leads no mapa" navega p/ `/repco/inteligencia/cobertura`; o modal dispara o run Apify (keyword+região) | **REUTILIZAR/CONSOLIDAR** — é o embrião da tela "Descobrir" (keyword+região+run). NÃO substituir. |

### 1.2 Dados (tabelas)
| Tabela | Linhas | Conteúdo | Veredito |
|---|---|---|---|
| `prospect_runs` | 7 | **Run/orçamento/custo**: `keywords[]`, uf/municipio/bairro/category, `max_places`, `cost_estimate_usd`, `apify_run_id`, `apify_dataset_id`, `status` (queued/running/done/failed/no_credit), `places_returned`, `leads_created`, `leads_duplicated`, `company_id`, `representative_id` | **ESTENDER** — já é o "Discovery Run". Falta: `provider`, `source_type`, `actor_id/version`, `dataset_id` genérico, `result_count`, ligação a `keyword_id`. |
| `prospect_lists` | 3 | **Pools**: name, segment, `source_type`, `source_name`, `status`, `assigned_representative_id`, contadores (total/pending/converted/rejected/duplicate/invalid), `company_id` | **REUTILIZAR** — destino de BUSINESS/LEAD aprovados. |
| `prospect_leads` | 228 | **Ciclo completo do lead**: identidade (company/trade/cnpj/cpf), geo (lat/lng/geocode), contato (phone/`whatsapp`/email/website), `raw_data` (jsonb proveniência), `status`, `duplicate_of_lead_id/client_id`, `representative_client_id` (conversão), `visited/qualified/converted_at`, `company_id`, campos RF dormentes | **REUTILIZAR** — pipeline de lead pronto. |
| `prospects_b2b` | **758.929** | Base **CNPJ/Receita** (OpenCNPJ): cnpj/cnae/razão/situação/endereço/geocode/`is_client`/`covered_by_lead_id` | **REUTILIZAR (opcional)** como *fonte* "Empresas/estabelecimentos" — hoje **dormente** (fluxo é Apify-first). |
| `b2b_leads` | 1 | Leads **inbound** do site (form Saporino + agora COFICO) | **NÃO tocar** — canal diferente (inbound), não é discovery. |
| `lead_rf_candidates` | 0 | Candidatos de match Receita — **vazio** (matching RF removido do fluxo) | Ignorar. |

### 1.3 Providers / Actors (Apify já é multi-actor)
Um **único `APIFY_TOKEN`** (secret do Supabase, nunca no frontend) já serve **3 edge functions com actors distintos**:
| Edge function | Actor | Uso atual |
|---|---|---|
| `apify-places` | `compass~crawler-google-places` | Prospecção (leads no mapa) |
| `ecommerce-scrape` / `vtex-scrape` | actor de e-commerce/VTEX | Inteligência de preço concorrente (`EcommercePriceIntel`) |
| `studio-import-instagram` | `apify~instagram-scraper` | Studio (Instagram) |

**Leitura:** a realidade **multi-provider/multi-actor já existe** — mas cada actor é **bespoke** (código específico por função). **NÃO há a abstração `DiscoveryProvider → ApifyProvider → ActorAdapter`** que você desenhou. Consolidar isso é o segundo item novo (fino).

`apify-places` já traz de fábrica: gate `is_admin()`, **teto mensal** (`MONTHLY_PLACES_CAP`), **estimativa de custo** (`COST_PER_PLACE`), orçamento acumulado do mês, disparo assíncrono (start/status), geo-bounding. **Modelo de referência para o adapter.**

### 1.4 Biblioteca de keywords
`src/constants/prospectKeywords.ts` — **já existe** e é rica: `PROSPECT_KEYWORDS` agrupadas por **categoria** (=campanha/tema), com `segment`, `places` (vai/não vai pro mapa) e **`channel: 'apify' | 'fora_do_mapa'`** (cargo/intenção reservado p/ LinkedIn/busca — exatamente a sua visão multi-fonte). **PORÉM: hardcoded em código.** Você quer **editável pelo admin** (add/remove/editar/agrupar/ativar). → **MIGRAR constants → tabela DB** (seed a partir do arquivo atual).

### 1.5 Dedup, custo, jobs, RLS
- **Dedup:** `leadMatch.ts` (`leadMatchesProspect` — nome + geo + bairro, **não só nome**) + colunas `duplicate_of_lead_id/client_id`. **REUTILIZAR/ESTENDER** (discovery precisa dedupe por URL canônica / external_id / telefone / CNPJ, além do de negócio já existente).
- **Custo/orçamento:** `prospect_runs.cost_estimate_usd` + teto mensal no edge. Custo-por-lead já é computável (`cost_estimate_usd` / `leads_created`). **ESTENDER** p/ custo-por-resultado / por-aprovado / por-cliente.
- **Score:** **NÃO existe** score de prioridade (o único "score" é o de *match* de dedup). **NOVO** — Discovery Score determinístico com fatores registrados.
- **Background jobs:** hoje é **assíncrono via polling** (edge `start` → frontend faz `status` em loop → importa). **Sem fila/cron.** Suficiente p/ MVP; fila real fica p/ depois.
- **RLS / company_id:** todas as `prospect_*` têm `company_id` + policy `is_admin()`. **Multi-empresa e segurança já contemplados.**

---

## 2. Gap analysis — delta para a visão "Discovery Intelligence"
| # | Visão do pedido | Estado hoje | Gap |
|---|---|---|---|
| 1 | **Resultado ≠ lead** (grupo/comunidade/perfil/business tipados) | Todo resultado vira `prospect_leads` | 🔴 **NOVO** — tabela `discovery_results` tipada (a peça central) |
| 2 | Keywords **editáveis** + grupos/campanhas | Hardcoded em constants | 🟠 **MIGRAR p/ DB** (`discovery_keywords` + grupos) |
| 3 | **Multi-fonte** (WhatsApp/social/web/business), fonte só aparece se houver provider real | Só Google Places alimenta prospecção | 🟠 **ESTENDER** — registry de fontes; UI mostra só as com actor configurado |
| 4 | Abstração `DiscoveryProvider/ApifyProvider/ActorAdapter` | 3 actors bespoke | 🟠 **CONSOLIDAR** (adapter fino, sem espalhar actor pela UI) |
| 5 | **Status de descoberta** (NEW/REVIEWING/APPROVED/DISMISSED/DUPLICATE/STALE) | Status de *lead* existe; de *descoberta* não | 🟠 **NOVO** (coluna em `discovery_results`) |
| 6 | **Discovery Score** (determinístico, fatores registrados) | Inexistente | 🟠 **NOVO** (função no banco + fatores em jsonb) |
| 7 | **Aprovação humana** → BUSINESS/LEAD vira `prospect_leads`; COMMUNITY/GROUP vira "fonte qualificada" | Conversão lead→cliente existe (`representative_client_id`) | 🟢 **REUTILIZAR** p/ BUSINESS; 🟠 pequena estrutura p/ COMMUNITY |
| 8 | **Proveniência/LGPD** (onde/URL/data/provider/keyword/run) | `raw_data` jsonb já guarda proveniência | 🟢 **REUTILIZAR/FORMALIZAR** + nota LGPD (discovery ≠ consentimento) |
| 9 | **Analytics por keyword** (runs/encontrados/aprovados/aproveitamento) | Não há ligação keyword↔run↔resultado | 🟠 **NOVO** (FKs + view de agregação) |
| 10 | **Funil keyword→descoberta→lead→cliente→venda** | Parcial (lead→cliente existe via `converted_at`/`representative_client_id`) | 🟡 **DEPOIS** (fechar quando 009+/vendas existirem) |

**Resumo:** 1 tabela nova central (`discovery_results`) + keywords em DB + adapter/registry fino + score + views de analytics. **Todo o "downstream" (pool, atribuição, lead, cliente, dedup de negócio, custo, RLS, multi-empresa) já existe e se reutiliza.**

---

## 3. Arquitetura proposta (reuso máximo, mínimo novo)

```
Admin → RepCo → Prospecção
   ├── Listas / Importar   (ProspectionManager)      [existe]
   ├── Atribuir pools      (PoolAssignment)          [existe]
   └── Descobrir           (NOVA subaba)             [novo, fino]
          │
          ▼
   [ Keywords em DB ]  →  DISCOVERY RUN (prospect_runs estendido)
   [ Região preset ]         │
   [ Fonte + Provider ]      ▼
                        DiscoveryProvider → ApifyProvider → ActorAdapter
                              │  (reutiliza padrão de apify-places)
                              ▼
                        discovery_results  (TIPADO: BUSINESS / COMMUNITY /
                              │             PUBLIC_WHATSAPP_GROUP / PROFILE / ...)
                              │             + status + score + proveniência + dedupe
                              ▼
                        [ APROVAR ] (ação humana)
                              ├── BUSINESS/LEAD → prospect_leads → pool → representante   [reutiliza]
                              └── COMMUNITY/GROUP → fonte qualificada                       [pequeno novo]
```

**Tabelas novas (mínimo):**
1. `discovery_keywords` (id, termo, grupo/campanha, segment provisório, region_preset, sources[], ativa, company_id) — **seed do `prospectKeywords.ts` atual**.
2. `discovery_results` (id, run_id, keyword_id, **type** enum, name, niche, city/uf/country, source, public_url, description, size_estimate, followers/members, provider, **discovery_score**, **score_factors** jsonb, **status** enum, external_id/canonical_url p/ dedupe, provenance jsonb, first_found_at, last_checked_at, company_id, converted_prospect_lead_id).
3. (opcional) `discovery_sources`/`discovery_actors` (registry: provider, actor_id, actor_version, fonte lógica, ativo) — pode começar como config no código e virar tabela depois.

**Estender `prospect_runs`:** `provider`, `source_type`, `actor_id`, `actor_version`, `result_count`, `keyword_id` (aditivo, sem quebrar os 7 runs existentes).

---

## 4. MVP proposto (mapeado ao seu §26 — marcando reuso)
| Item MVP | Como | Novo? |
|---|---|---|
| 1. Subaba "Descobrir" | 3ª TabBtn em `ProspectionAdmin` | pequeno |
| 2. Keywords + grupos (CRUD) | `discovery_keywords` + tela | novo (seed do constants) |
| 3. Região | presets (país/UF/cidade) configuráveis | reusa geo existente |
| 4. Seleção de fonte | registry; só mostra fonte com actor real | novo (fino) |
| 5. Adapter Apify | consolidar padrão `apify-places` | reusa |
| 6. 1–2 actors validados | **Google Places** (já validado) + 1 (ver §6) | reusa+1 |
| 7. Executar busca | estende edge `apify-places` (ou novo `discovery-run` genérico) | estende |
| 8. Histórico de runs | `prospect_runs` estendido | reusa |
| 9. Resultados normalizados | `discovery_results` | novo |
| 10. Score simples | função determinística + fatores | novo |
| 11. Aprovar/descartar | ações na tabela | novo (UI) |
| 12. Dedupe | `leadMatch` + URL/external_id | reusa+estende |
| 13. Custo/proveniência | `prospect_runs` + `raw_data`/provenance | reusa |
| 14. Enviar aprovado → prospecção | BUSINESS → `prospect_leads` → pool | **reusa 100%** |

**Fora do MVP (depois):** Ai.Bot (sugestão/priorização de keywords), sugestões automáticas, funil completo até venda, fila/cron de jobs, fontes que ainda não têm actor real.

---

## 5. Encaixe na Master Task List
- **Não existe** task de Discovery na MTL atual; é **evolução da Camada 2 (Prospecção B2B)** do blueprint §15.
- **Pré-requisitos:** **nenhum hard.** A infra de prospecção necessária **já existe** (runs, pools, leads, dedup, custo, RLS, company_id, adapter Apify).
- **Relação com TASK 009+ (Client Identity / Commercial Accounts):** **independente.** Discovery vive no **topo do funil** (antes de lead). A conversão "aprovado → lead → cliente" já funciona hoje via `prospect_leads.representative_client_id`. Quando C2 (CUSTOMER_IDENTITY) entrar, só se **re-roteia a conversão** para o novo modelo — ajuste leve, **não** pré-requisito.
- **Ordem recomendada:** **depois** do Site Sprint; **pode entrar antes, depois ou em paralelo** à TASK 009 — não bloqueia nem é bloqueada. Sugiro tratá-la como **task própria** (ex.: "TASK INTEL-1 — RepCo Discovery Intelligence") na trilha de inteligência/prospecção, agendável quando você quiser, **sem furar a fila** dos P0 de dados/logística.

---

## 6. Providers / Actors recomendados
- **Agora (validados/baixo risco):**
  - `compass~crawler-google-places` — **já em produção** (BUSINESS/estabelecimentos). Mantém como fonte "Empresas/Google Maps".
  - `prospects_b2b` (758k CNPJ) como **fonte interna gratuita** "Empresas por CNAE/UF" — sem custo Apify, já carregada.
- **Curto prazo (1 actor adicional, validar custo primeiro):** um actor de **busca web pública** (SERP/site) para descobrir páginas/diretórios por keyword — cobre "Web pública".
- **Cautela (avaliar viabilidade/ToS/LGPD antes):** WhatsApp grupos/canais **públicos** — só descoberta de **links públicos**, **nunca** entrar em grupo, raspar membros ou mensagens (ver §7). Só ligar a fonte se houver actor real e conforme.
- **Já existentes reaproveitáveis:** `apify~instagram-scraper` (Studio) e o actor de e-commerce — mostram que o token/quota são compartilhados; **coordenar orçamento Apify** entre Prospecção, Studio e Price Intel (uma só conta).

---

## 7. Risco / Custo / Impacto / LGPD
- **Custo Apify:** conta/token **único** compartilhado (Places + Instagram + e-commerce). Discovery aumenta o consumo → **respeitar o teto mensal existente** e medir **custo-por-resultado/aprovado/lead**. Nunca rodar actor pago sem pedir (regra vigente).
- **LGPD / proveniência:** guardar origem (URL pública, data, provider, keyword, run). **Discovery ≠ consentimento para contato.** Dado de pessoa física descoberto **não** presume base legal de marketing. Empresa/estabelecimento público é diferente de PF.
- **WhatsApp — linha vermelha:** só links/grupos/canais **públicos descobertos**. **Proibido**: entrar em grupo privado, extrair membros, ler/raspar mensagens, burlar convite, disparar spam/mensagem automática. Discovery = *market intelligence*, não automação de contato.
- **Anti-duplicação de sistema:** **não** criar 2º CRM, 2º RepCo, 2º módulo de prospecção, nem duplicar `b2b_leads`/pools/"Buscar leads no mapa". Tudo aqui **estende** o existente.
- **Impacto:** alto valor de inteligência comercial (Camada 1/2 do blueprint) com esforço **médio-baixo** graças ao reuso; risco técnico baixo (padrões já provados em produção).

---

## 8. Claude Technical Opinion
1. **Subaba "Descobrir" é o lugar certo.** Não inventar aba nova no Admin. O container `ProspectionAdmin` já tem o padrão.
2. **A jogada arquitetural que evita retrabalho:** separar **`discovery_results` (tipado)** de **`prospect_leads` (lead)**. Se você continuar empurrando tudo pra `prospect_leads`, um grupo de WhatsApp/uma comunidade vira "lead" falso e polui o pipeline. A camada tipada + **aprovação humana** é o que transforma isso em inteligência de mercado real (e não em lixo de scraper).
3. **Keywords em DB, não em código.** É pré-condição para "aprender qual palavra funciona" (§19/§21). Migre o `prospectKeywords.ts` (que já está bem estruturado) para `discovery_keywords` com seed.
4. **Adapter fino agora, registry depois.** Não construa um framework de providers genérico no MVP. Reaproveite o padrão do `apify-places` (gate+budget+start/status) e generalize `prospect_runs` com `provider/actor`. A abstração completa (`DiscoveryProvider`) vale quando houver ≥3 fontes reais.
5. **Score determinístico com fatores registrados** desde o início (nicho+região+keyword+qualidade+atividade pública+relevância → 0–100, guardando os fatores). Nada de IA inventando score. Ai.Bot só *recomenda* depois.
6. **Consolidar orçamento Apify** entre Prospecção/Studio/Price Intel — é uma conta só. Vale um painelzinho de custo Apify global (futuro).
7. **O que fazer agora vs depois:**
   - **Agora (MVP):** subaba + keywords DB + região + fonte Google Places (reuso) + `discovery_results` + score simples + aprovar/descartar + dedupe + custo + "aprovar BUSINESS → prospect_leads".
   - **Depois:** WhatsApp/social como fontes (quando houver actor conforme), Ai.Bot (sugestão/priorização), sugestões automáticas de keyword, funil até venda, fila/cron.

---

## 9. Decisões que preciso de você (antes de qualquer implementação)
1. **Aprovar a peça central:** criar `discovery_results` (tipado) separado de `prospect_leads`? (recomendo **sim**).
2. **Keywords:** migrar `prospectKeywords.ts` → tabela DB editável (seed do atual)? (recomendo **sim**).
3. **Fontes do MVP:** começar só com **Google Places** (reuso, custo conhecido) + opcionalmente **`prospects_b2b`** (CNPJ, grátis)? WhatsApp/social ficam para depois (precisam de actor conforme + avaliação LGPD/ToS).
4. **Quando:** encaixar como **TASK INTEL-1**, agendável após o Site Sprint, **sem furar a fila** dos P0 (009+/logística)? (recomendo **sim** — NÃO BLOQUEANTE).
5. **Orçamento Apify:** confirmar teto mensal compartilhado (Prospecção + Studio + Price Intel) antes de ligar novas fontes.

> **Parado aqui para sua revisão, conforme pedido.** Nada foi implementado. Nenhuma tabela/edge/UI criada. C1/C2 não reabertos. Site Sprint e fila oficial intactos.
