# CLAUDE.md — Café Saporino / website_project

> Este arquivo é lido automaticamente pelo Claude Code como contexto do projeto.
> Idioma de trabalho: **PT-BR**, respostas diretas e sem enrolação.

## 1. Visão do produto
Plataforma da **Café Saporino** com três frentes:
- **Loja B2C** — `/`
- **Painel Admin** — `/admin`
- **Portal RepCo** (portal do representante) — `/repco`

**Prioridade atual: terminar o B2B (RepCo).** O B2C fica para uma fase dedicada depois. O modelo de cliente B2C ainda não está construído.

## 2. Stack
React 18 + TypeScript + Vite + Tailwind + Supabase (Postgres + Auth + Storage + RLS) + Vercel (auto-deploy ao `push` em `main`). Repo local: `c:\Users\vlade\OneDrive\Documents\website_project`.

## 3. Regras de execução (IMPORTANTES)
- Sempre validar com `npm run typecheck` **e** `npm run build` antes de commitar. Só commitar se ambos passarem.
- **Push autorizado (desde 02/06/2026):** Vlademir liberou push direto ("não precisa ficar pedindo, faz"). Pode `git push origin main` após `typecheck`+`build` OK. (Push = deploy automático na Vercel; mudança aparece no site publicado após `push` + `Ctrl+Shift+R`.) Tirar dúvida só em ação destrutiva (ex.: zerar dados teste→live).
- `typecheck`/`build` **NÃO** pegam bugs de runtime ou de dados (ex.: uma coluna que ficou fora de um `.select()` compila e passa, mas não funciona). Ao mexer em comportamento, **subir o dev server e verificar na tela**, rastreando o dado de ponta a ponta: **banco → query/select → estado → componente**.
- Edições atômicas e idempotentes; preferir mudanças pequenas e verificáveis.

## 4. Banco (SQL em produção)
SQL roda via RPCs do Supabase: `exec_migration` (DDL/DML) e `exec_select` (SELECT — **não aceita `;` no fim**). Credenciais no `.env`: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Funções de segurança: `public.is_admin()`, `public.my_rep_id()`. **Storage buckets:** `invoices` (NF/comprovantes/boletos), `lot-documents` (docs de lote, privado), `products` (imagens).

## 5. Fluxo do RepCo
Rep cadastra clientes → lança pedido em 3 passos: **Cliente → Produtos → Revisão** → gera o pedido. No B2B o **cliente não paga pelo site**: paga por PIX, boleto ou depósito bancário **direto na conta da empresa** (o rep registra o pedido; Vlademir aprova antes de gerar NF). Mercado Pago = só B2C. A **comissão** (empresa → rep) é um fluxo separado de como o cliente pagou.

## 6. Esquema — tabelas principais
- `representative_clients` — clientes do rep. Campos-chave: `forma_pagamento` ('boleto'/'pix'), `prazo_pagamento` (texto, ex. '7d'), `segment`, `default_fiscal_order_type`, CPF/CNPJ, dados bancários.
- `representatives` — `user_id`, `cpf`, `commission_rate`, `has_personal_delivery`, `experience_start_date`, `status`.
- `representative_orders` — pedidos. `order_number` (RC-XXXXX) gerado por trigger; `invoice_pdf_url`/`invoice_xml_url`/`payment_proof_url` etc.
- `representative_commissions` — comissão por pedido (ADMIN lê/edita). `status` pending/paid, `payment_cycle_start/end`, `scheduled_payment_date`.
- `representative_commission_payouts` — livro-caixa que o REP lê em "Pagas". `amount`, `payment_method`, `cycle_start/end`, `scheduled_payment_date`, `status` scheduled→paid, `proof_url`, `proof_filename`.
- `representative_order_installments` — parcelas do boleto. `installment_number`, `amount`, `due_date`, `boleto_url`, `proof_url`, `status` (vira `paid` quando o comprovante é anexado → gatilho cria o payout proporcional).
- `price_lists` — preço por segmento B2B (R$/pacote). UNIQUE(product_id, segment).
- **Inventário/Lotes:** `green_coffee_lots` (lote de café verde: peso/custo/status), `lot_transfers` (transferências verde/torrado), `lot_documents` (docs: compra_verde/nota_fiscal/pagamento_torra/pagamento_embalagem), `batch_photos`, `roasting_companies` (+ `roasting_company_contacts`). UI = `BatchManagement.tsx` (cadeia de custos verde→torra→embalagem→custo/kg; `products.stock` atualizado por trigger a partir dos lotes ativos).
- **Rotas/Logística:** `routes`, `route_stops`, `route_assignments`, `delivery_proofs`, `client_route_links` — RouteManager (admin) + RepCoRoutes (mapa Leaflet/OSM, geofencing 500m, GPS, nav Waze/Maps, POD foto+texto). `RepCoLiveMap` = presença ao vivo dos reps.
- **Sistema:** `presence_sessions` (presença online), `notifications` (alertas do admin).

## 7. Regras de negócio confirmadas
- **Numeração de pedido:** trigger `generate_repco_order_number` → `'RC-' || LPAD(nextval('repco_order_seq'),5,'0')`. Acima de 99999 vira `RC-100000` automaticamente (LPAD não trunca). **Nunca resetar em produção** (só em fase de teste, e só com a tabela vazia).
- **Condição de pagamento na Revisão deve vir do perfil do cliente** (`forma_pagamento` + `prazo_pagamento`). Cliente boleto → Revisão abre em boleto. Errar isso gera NF errada → cancelamento de nota. Crítico.
- **Comissão:** 5% base + 0,5% bônus PIX + 2,5% entrega pessoal (flag `has_personal_delivery`, liberada pelo admin — imediata p/ reps conhecidos, após 90 dias p/ desconhecidos), cap 8%. Cálculo no **banco**. Ciclo sáb→sex: PIX paga 2ª segunda após a sexta; boleto paga 1ª segunda (mais rápido, intencional); boleto multi-parcela libera proporcional por parcela confirmada. Bônus de entrega paga no mesmo ciclo da venda.
- **"Pagar bloco":** admin paga `payouts` agrupados por rep + método + ciclo, com 1 comprovante → marca os payouts como `paid` → enche a aba "Pagas" do rep. (Componente `RepCoPayoutBlocks.tsx`.)
- **Fardo:** 1 fardo = 10 pacotes de 500g = 5kg, qualquer produto; preço do fardo = 10× o do pacote. Estoque sempre em pacotes.
- **Visibilidade do rep:** vê só as próprias vendas/pipeline/comissão — nunca custo de produto, margem da empresa, ou dados de outros reps.
- **Multi-tenant:** `company_id` nas tabelas core, backfill p/ Saporino. RLS estruturada mas **policies ainda não ligadas** — ligar antes do go-live.
- **Deletar pedido/cliente de teste:** o código precisa listar e deletar também os arquivos no Supabase **Storage** (ON DELETE CASCADE não remove arquivos de storage).
- **PDFs (contratos/formulários):** sempre AcroForm (campos preenchíveis), sem underscores visuais; linhas de assinatura manual permanecem como linhas visuais.
- **Linhas de produto (`products.product_line`):** campo **aberto/extensível** por produto (admin define; não é enum fixo). De-para atual: `Tropeiro Paulista Extra Forte` e `Tropeiro Paulista Tradicional` (homônimos); `Café Saporino Tradicional` → **Saporino Clássico**. `Café Especial Arábica`, `Café Gourmet Patrocinense`, `Café Premium Gourmet` = **produtos de teste** (não serão lançados). "Saporino Temporadas" = linha sazonal sem produto ativo. Usado pela Camada 1 (inteligência por linha) — ver §15.

## 8. Estado — feito / em aberto
**Feito (recente):** excluir pedido; venda em fardo; esconder admins/reps da aba Clientes; `RepCoPayoutBlocks` (pagar bloco); `prazo_pagamento` adicionado ao select de clientes; reset da numeração de teste; `key` por cliente no picker de pagamento; **pré-preenchimento boleto na Revisão validado na tela** (CAFE SAPORINO boleto/7d → Revisão abre em Boleto/7 dias — ver §9).

**Em aberto / faltando:** reserva de carrinho 5 min; realtime; deletar cliente → prospecção; limpeza de storage ao deletar (test vs live); ligar RLS multi-tenant; transição test → live; revisar Manual do Representante; **e-mail Resend (BLOQUEADO — esperando novo Google Workspace @cafesaporino.com.br)**; integrações de marketplace; **PWA (reativar — hoje desativado) → instalar via link (Add to Home Screen) → depois Google Play via PWABuilder**; revisar webhook Mercado Pago (`supabase/functions/mercadopago-webhook`).

**Assinatura B2C (status):** v1 FEITO — admin controla liga/desliga + descontos por compromisso (tiers) + quais produtos entram (`subscription_settings` + `products.subscription_enabled`), em **Configurações da Loja**. Picker usa produtos reais (foto, preço, torra, notas), seletor de compromisso aplica desconto, checkout cobra o **1º ciclo** via Mercado Pago e registra a assinatura. PJ direciona ao representante (atacado via RepCo). **Falta:** cobrança **recorrente** automática (preapproval Mercado Pago — passo 2); refinar frete (hoje grátis por padrão no checkout da assinatura).

**PRÓXIMO PROJETO aprovado (após fechar assinatura) — Rastreabilidade do café ("Conheça seu café"):** página pública por produto/lote com origem e storytelling, inspirada (NÃO copiar) em AgTrace/Clube Café. Blocos: **Conheça seu produtor** (nome, fazenda, foto, mapa satélite, altitude, história), **Conheça seu café** (variedade, processo, safra, altitude, lote, torra), **Análise sensorial** (gráfico radar tipo SCA por atributo + pontuação + descrições — só p/ cafés que SÃO Arábica do Cerrado), **Certificados/laudos** (anexar certificado de prêmio + relatório PDF). Fundação já existe em `green_coffee_lots` (fazenda/altitude/variedade/SCA/notas), `lot_documents`, `batch_photos`, `roasting_companies`. **Adicionar:** perfil do produtor (nome/bio/foto/coordenadas/temperatura), notas sensoriais por atributo (radar), upload de certificado, página pública + componente de gráfico. Design e ícones próprios Saporino. **A seção "Conheça o nosso café" da página de assinatura hoje generaliza specs do Clássico Tradicional (altitude/moagem fina/pontuação do Cerrado) como se valessem p/ todos — corrigir nesse projeto (genérico de marca no topo + perfil por produto; pontuação só p/ Arábica do Cerrado).**

## 9. ✅ RESOLVIDO (01/06/2026) — pré-preenchimento da condição de pagamento
**Sintoma (era):** na Revisão do Novo Pedido (`src/components/repco/RepCoNewOrder.tsx`), a "Condição de pagamento" abria em **"À vista/PIX"** mesmo quando o cliente tinha `forma_pagamento='boleto'` e `prazo_pagamento` (ex. '7d'). Deveria abrir em **Boleto / 7 dias**.

**Cadeia do dado (toda verificada e íntegra):** `representative_clients.prazo_pagamento` → `.select()` em RepCoNewOrder ([linha 67](src/components/repco/RepCoNewOrder.tsx), inclui `prazo_pagamento`) → `selectClient()` parseia o prazo e seta `boletoOffsets`/`paymentTerm` ([linhas 101-106](src/components/repco/RepCoNewOrder.tsx)) → `<BoletoCombinationPicker key={selectedClient.id} initialOffsets={boletoOffsets} />` ([linha 392](src/components/repco/RepCoNewOrder.tsx)) inicializa via `useState(keyForOffsets(initialOffsets))`.

**Causa raiz e fix (já em produção):** `useState` não relê `initialOffsets` em re-render. Resolvido por dois mecanismos combinados: (1) `key={selectedClient?.id}` força remontagem ao trocar de cliente (commit `f4a0a1e`); (2) o picker fica atrás de `step==='review'`, então sempre desmonta/remonta ao entrar na Revisão, relendo `boletoOffsets`. O elo do banco também foi corrigido incluindo `prazo_pagamento` no select (commit `f7e9dfb`).

**Validado NA TELA (não só compila):** banco confirmado via `exec_select` (CAFE SAPORINO LTDA = `boleto`/`7d`); fluxo Cliente→Revisão reproduzido no dev server partindo de `boletoOffsets=[]` → o `<select>` abre em `value='s7'` / label **"7 dias"** com "1 boleto: vencimento em D+7." `typecheck` + `build` OK.

---
*Seções §10-§14 consolidadas dos antigos docs de contexto/handoff (movidos para `docs/_legacy/`). Mantêm apenas o que é evergreen; snapshots datados (contagem de linhas, listas de commit, status de blocos de maio/2026) foram descartados.*

## 10. Design system Saporino
| Token | Valor | Uso |
|---|---|---|
| Primário | `#8B2214` | Botões principais, ícones de cards, destaques |
| Primário hover | `#6d1a10` | Hover de botões |
| Primário legacy | `#a4240e` | Componentes antigos (ex. RepCoNewOrder) — migrar gradualmente p/ `#8B2214` |
| Fundo página | `#f8f7f5` | `min-h-screen` em todas as páginas admin/repco (nunca `bg-gray-50`) |
| Fundo ícone card | `#f5f0ef` | Background dos ícones nos stat cards |
| Cards | `#ffffff` | branco com `border border-gray-200` |
| Borda sutil | `#ddd0cc` | bordas contextuais no tom Saporino |

**Regras:** sem gradientes coloridos nem pastéis (blue-50/purple-50/green-50/yellow-50) em stat cards. Badges de **status de pedido** mantêm cor semântica (verde=pago, amarelo=pendente). Alertas de erro/sucesso mantêm `bg-red-50`/`bg-green-50`. Stat card padrão: `bg-white border border-gray-200 rounded-xl p-4`, ícone em `w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214]`; card de total leva `border-l-4 border-l-[#8B2214]`.

## 11. Arquitetura frontend & gotchas de deploy
- **Router custom** em `src/App.tsx`: lê `window.location.pathname` + escuta `popstate`. **NÃO usa react-router-dom** (está em `package.json` mas não é usado no App). Navegar = `window.history.pushState({}, '', '/rota')` seguido de `window.dispatchEvent(new PopStateEvent('popstate'))`.
- **`vercel.json` (crítico, não alterar sem entender):** usa `routes` (não `rewrites`). Estáticos (img/js/css/fontes) e `/assets`, `/icons` passam ANTES do catchall `/(.*) → /index.html`. Sem isso, F5 em `/admin` retorna página em branco.
- **PWA desativado:** `vite-plugin-pwa` está comentado no `vite.config.ts` (SW causava branco no F5). `index.html` tem script que desregistra SWs antigos + limpa caches. Reativar futuramente com `navigateFallback: '/index.html'` + `skipWaiting: true` (ver §8 backlog Google Play).
- **Auth race condition:** AdminDashboard/RepCoDashboard devem aguardar `loading` do `useAuth` antes de checar permissão; senão F5 mostra "Acesso Negado" enquanto a sessão restaura.
- **Optimistic update** no `RepCoNewOrder`: mostra sucesso na hora e insere em background; em falha, reverte para a revisão com erro.
- **Keep-alive Supabase:** `App.tsx` faz ping a cada 4 dias (evita pausa do plano free).
- **Imagens** em `/public` (servidas na raiz), sempre kebab-case — nome com espaço vira 404 no Vercel. Fallback de produto: `/saporino-logo.png`.
- **Deep-link admin:** `localStorage.setItem('admin-initial-tab', '<aba>')` antes de navegar p/ `/admin`.

## 12. Roadmap RepCo — regras já especificadas (a implementar)
- **Score do cliente (Serasa interno, 0-1000):** admin anexa PDF do print Serasa + score inicial ao cadastrar. Evolui por boleto: pago em dia +20; 1-3d atraso −30; 4-7d −50; >7d não pago −100; 3 boletos seguidos em dia +30. **PIX/à vista não afeta o score.** Faixas: 0-300 ruim, 300-500 regular, 500-700 bom, 700-900 ótimo, 900-1000 excelente.
- **Trava por boleto vencido:** D+1 do vencimento sem pagamento → cliente trava (não recebe novos pedidos; rep vê "Cliente bloqueado — boleto vencido em DD/MM"). Destrava: automática ao anexar comprovante, ou manual pelo admin.
- **Sininho de notificações (admin):** vermelho piscando = pedido novo do rep (abre perfil do rep + pedido); amarelo + nº = pedido alterado pelo rep (abre com diff); azul = boleto vencendo/vencido (abre o cliente). Canais de alerta pessoal: sininho → Telegram bot (gratuito, prioritário) → PWA Push → e-mail (Resend, bloqueado).
- **Boletos múltiplos:** até **5 boletos por pedido** + comprovantes correspondentes; combos comuns (1x7/14/28/30, 2x30/60, 3x30/60/90) + "Personalizado". Vencimento digitado manual (OCR Google Vision é melhoria futura — boleto/NF/Serasa).
- **Pedido auditável:** notas livres e anexo de PDF do pedido sempre liberados; editar produtos/qtd só enquanto `invoice_pdf_url IS NULL` (após NF anexada, trava; cada alteração gera audit log).

## 13. Empresa, sócios e contatos
- **Café Saporino Ltda** — CNPJ 61.109.694/0001-94 (situação ATIVA), nome fantasia "CAFE SAPORINO", Simples Nacional. Site: https://www.cafesaporino.com.br · Repo: https://github.com/saporino/website_project
- **Sede (Receita):** Alameda Rio Negro, 503, Sala 2005 — Alphaville Centro Industrial e Empresarial — Barueri/SP — CEP 06454-000.
- **Sócios (estrutura atual):** Vlademir M. De Santi — Diretor Sócio Administrador · Michael Jakobson — Diretor Sócio Financeiro · Eunice Jakobson — Diretora Sócia Financeira (Jakobsons baseados nos EUA).
- **Vlademir:** região metropolitana de SP; PT-BR, conciso, não-dev (instruções passo a passo). Operação/lease comercial em Várzea Paulista/SP (30 meses desde abr/2026; distinto da sede em Barueri). Outra renda: Carra Indústria de Bebidas (separada do Saporino). Telegram/WhatsApp pessoal p/ alertas: +55 11 91771-9798.
- **Contador:** Leonardo Ferrareis (Ferrareis Soluções Contábeis).
- ⚠️ Diretório local está dentro do OneDrive — mover pra fora num futuro próximo.

## 14. Glossário
| Termo | Significado |
|---|---|
| **RC-XXXXX** | Nº de pedido RepCo (trigger `generate_repco_order_number`). Numeração por canal no e-commerce: `PF-`/`PJ-`/`ML-`/`SH-`/`AZ-`/`TK-` |
| **Pedido Cliente Nº** | Nº que o cliente fornece (PO/ordem) — opcional |
| **Admin Force** | Perfil de testes (representa rep ou admin durante o dev) |
| **Cliente de teste** | CAFE SAPORINO LTDA (boleto/7d, segmento distribuidora) — verificado em 01/06/2026 |
| **Segmentos** | distribuidora e marketplaces `ML/SH/AZ/TK` (ML=Mercado Livre, SH=Shopee, AZ=Amazon, TK=TikTok) |
| **Lotes / BatchManagement** | Gestão de estoque de café verde (`green_coffee_lots` etc.; UI `BatchManagement.tsx` já existe — cadeia de custos completa) |
| **Linhas de produto** | Saporino Clássico, Tropeiro Paulista Tradicional, Tropeiro Paulista Extra Forte, Grão Gourmet, Saporino Temporadas |

## 15. Norte estratégico — RepCo como SaaS de inteligência de dados
O RepCo não é só portal de pedidos: é o **motor de inteligência de dados** e o **produto SaaS** da Saporino. Blueprint completo em [`docs/RepCo_Inteligencia_de_Dados_Blueprint.md`](docs/RepCo_Inteligencia_de_Dados_Blueprint.md) — **ler antes de planejar features de RepCo**. Resumo: a camada de dados é a fundação (cada pedido nasce estruturado), em 3 camadas construídas em ordem (não paralelizar):
1. **Inteligência comercial (director/admin):** dimensões em cada pedido (`product_line`, geo do cliente, `channel`, `payment_type/cycle`, `confirmed_at`) → views de agregação no banco → RLS papel `director` por `company_id` → rota `/repco/inteligencia` (visão geral, **mapa de calor por área**, ranking de reps, preço praticado).
2. **Prospecção B2B com dado público:** `prospects_b2b` + ETL da base CNPJ (OpenCNPJ) por CNAE+UF → mapa de prospecção e de buracos de cobertura.
3. **Multi-tenant como produto:** enforce RLS multi-tenant, isolamento entre empresas, onboarding/billing.

O **heatmap geográfico** e o redesenho da **Performance** que estão no backlog são a Camada 1.4 e dependem da Camada 1.1 (hoje o cliente só tem `endereco_completo` em texto — falta geo estruturado). Não usar NielsenIQ/Scanntech nem ler NF de concorrente.
