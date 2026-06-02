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
- **Não dar `git push` por conta própria.** Vlademir testa e dá push. Ele testa no site **publicado**, então mudança só aparece após `push` + `Ctrl+Shift+R`.
- `typecheck`/`build` **NÃO** pegam bugs de runtime ou de dados (ex.: uma coluna que ficou fora de um `.select()` compila e passa, mas não funciona). Ao mexer em comportamento, **subir o dev server e verificar na tela**, rastreando o dado de ponta a ponta: **banco → query/select → estado → componente**.
- Edições atômicas e idempotentes; preferir mudanças pequenas e verificáveis.

## 4. Banco (SQL em produção)
SQL roda via RPCs do Supabase: `exec_migration` (DDL/DML) e `exec_select` (SELECT — **não aceita `;` no fim**). Credenciais no `.env`: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Funções de segurança: `public.is_admin()`, `public.my_rep_id()`.

## 5. Fluxo do RepCo
Rep cadastra clientes → lança pedido em 3 passos: **Cliente → Produtos → Revisão** → gera o pedido. No B2B o **cliente não paga pelo site**: paga por PIX, boleto ou depósito bancário **direto na conta da empresa** (o rep registra o pedido; Vlademir aprova antes de gerar NF). Mercado Pago = só B2C. A **comissão** (empresa → rep) é um fluxo separado de como o cliente pagou.

## 6. Esquema — tabelas principais
- `representative_clients` — clientes do rep. Campos-chave: `forma_pagamento` ('boleto'/'pix'), `prazo_pagamento` (texto, ex. '7d'), `segment`, `default_fiscal_order_type`, CPF/CNPJ, dados bancários.
- `representatives` — `user_id`, `cpf`, `commission_rate`, `has_personal_delivery`, `experience_start_date`, `status`.
- `representative_orders` — pedidos. `order_number` (RC-XXXXX) gerado por trigger; `invoice_pdf_url`/`invoice_xml_url`/`payment_proof_url` etc.
- `representative_commissions` — comissão por pedido (ADMIN lê/edita). `status` pending/paid, `payment_cycle_start/end`, `scheduled_payment_date`.
- `representative_commission_payouts` — livro-caixa que o REP lê em "Pagas". `amount`, `payment_method`, `cycle_start/end`, `scheduled_payment_date`, `status` scheduled→paid, `proof_url`, `proof_filename`.
- `price_lists` — preço por segmento B2B (R$/pacote). UNIQUE(product_id, segment).
- `product_batches`, `roasting_companies` — lotes/torrefadoras.

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

## 8. Estado — feito / em aberto
**Feito (recente):** excluir pedido; venda em fardo; esconder admins/reps da aba Clientes; `RepCoPayoutBlocks` (pagar bloco); `prazo_pagamento` adicionado ao select de clientes; reset da numeração de teste; `key` por cliente no picker de pagamento; **pré-preenchimento boleto na Revisão validado na tela** (CAFE SAPORINO boleto/7d → Revisão abre em Boleto/7 dias — ver §9).

**Em aberto / faltando:** reserva de carrinho 5 min; realtime; deletar cliente → prospecção; limpeza de storage ao deletar (test vs live); ligar RLS multi-tenant; transição test → live; revisar Manual do Representante; **e-mail Resend (BLOQUEADO — esperando novo Google Workspace @cafesaporino.com.br)**; integrações de marketplace; publicação Google Play via PWABuilder.

## 9. ✅ RESOLVIDO (01/06/2026) — pré-preenchimento da condição de pagamento
**Sintoma (era):** na Revisão do Novo Pedido (`src/components/repco/RepCoNewOrder.tsx`), a "Condição de pagamento" abria em **"À vista/PIX"** mesmo quando o cliente tinha `forma_pagamento='boleto'` e `prazo_pagamento` (ex. '7d'). Deveria abrir em **Boleto / 7 dias**.

**Cadeia do dado (toda verificada e íntegra):** `representative_clients.prazo_pagamento` → `.select()` em RepCoNewOrder ([linha 67](src/components/repco/RepCoNewOrder.tsx), inclui `prazo_pagamento`) → `selectClient()` parseia o prazo e seta `boletoOffsets`/`paymentTerm` ([linhas 101-106](src/components/repco/RepCoNewOrder.tsx)) → `<BoletoCombinationPicker key={selectedClient.id} initialOffsets={boletoOffsets} />` ([linha 392](src/components/repco/RepCoNewOrder.tsx)) inicializa via `useState(keyForOffsets(initialOffsets))`.

**Causa raiz e fix (já em produção):** `useState` não relê `initialOffsets` em re-render. Resolvido por dois mecanismos combinados: (1) `key={selectedClient?.id}` força remontagem ao trocar de cliente (commit `f4a0a1e`); (2) o picker fica atrás de `step==='review'`, então sempre desmonta/remonta ao entrar na Revisão, relendo `boletoOffsets`. O elo do banco também foi corrigido incluindo `prazo_pagamento` no select (commit `f7e9dfb`).

**Validado NA TELA (não só compila):** banco confirmado via `exec_select` (CAFE SAPORINO LTDA = `boleto`/`7d`); fluxo Cliente→Revisão reproduzido no dev server partindo de `boletoOffsets=[]` → o `<select>` abre em `value='s7'` / label **"7 dias"** com "1 boleto: vencimento em D+7." `typecheck` + `build` OK.
