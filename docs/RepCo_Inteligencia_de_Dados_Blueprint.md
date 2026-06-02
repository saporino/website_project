# RepCo como Motor de Inteligência de Dados da Saporino
### Blueprint de arquitetura para implementação no Claude Code

**Stack:** React 18 + TypeScript + Tailwind + Vite + Supabase + Vercel
**Domínio:** www.cafesaporino.com.br
**Contexto:** o RepCo já registra cada venda como dado estruturado no Supabase. Este documento transforma esse dado operacional em **inteligência comercial**, em 3 camadas, construídas nesta ordem por dependência técnica.

---

## Princípio que guia tudo

A 3 Corações levou ~60 anos para montar um império físico e só depois parafusou o SAP por cima para enxergar, em tempo real, quanto vende por região via ~3 milhões de notas fiscais/mês. A Saporino faz o caminho inverso: **a camada de dados é a fundação, não um remendo posterior.** Cada pedido nasce como registro de banco. O objetivo é dar ao Diretor Comercial as mesmas ferramentas de decisão da 3 Corações — sobre o dado *próprio*, que é o único que importa para decidir onde reforçar estoque, preço e time de vendas.

**Importante (limite legal):** não existe acesso público à nota fiscal individual de concorrentes. O que a 3 Corações monitora é (a) o próprio sell-in e (b) dados de sell-out *comprados* (NielsenIQ/Scanntech — contratos de dezenas a centenas de milhares de R$/ano). A Saporino NÃO precisa disso para começar. O poder vem do dado próprio (Camada 1) + dado público legal (Camada 2).

---

## CAMADA 1 — Painel de Inteligência Comercial (PRIMEIRO)

**Por que primeiro:** o dado já existe no RepCo; é o de menor esforço e maior retorno; e as Camadas 2 e 3 dependem de um modelo de vendas sólido e bem agregado.

### 1.1 Garantir que cada pedido carrega as dimensões de análise
Conferir/garantir que a tabela de pedidos (orders/order_items) tem, por linha de item:
- `company_id` (multi-tenant — já aprovado)
- `product_line` (Saporino Clássico, Tropeiro Paulista Tradicional, Tropeiro Paulista Extra Forte, Grão Gourmet, Saporino Temporadas) e `product_id`
- `quantity`, `unit_price` (preço praticado), `total`
- `rep_id` (representante), `client_id`
- `channel` (Site, RepCo, Marketplace)
- `payment_type` (PIX, boleto, depósito) e `payment_cycle` (à vista / prazo)
- localização: `client_cep`, `municipio`, `uf` (derivar do endereço do cliente)
- `created_at` / `confirmed_at` (data da venda e data de confirmação de pagamento — necessário para alinhar com o ciclo de comissão)

### 1.2 Camadas de agregação no banco (não no frontend)
Manter a lógica no banco como fonte única de verdade (mesmo princípio do ciclo de comissão). Criar **views** ou **materialized views** no Supabase:
- `vw_vendas_por_area` — soma/qtd por município/UF, por período
- `vw_vendas_por_linha` — por `product_line`, por período
- `vw_vendas_por_rep` — por representante (faturamento, qtd, ticket médio, nº de clientes ativos)
- `vw_vendas_por_canal` — Site vs RepCo vs Marketplace
- `vw_preco_praticado` — preço médio por linha por área (detecta quem está vendendo abaixo/acima)
- `vw_clientes_ativos_por_area` — densidade de clientes ativos por região (insumo da Camada 2)

Para tempo real, usar Supabase Realtime ou refresh agendado das materialized views (pg_cron) conforme volume.

### 1.3 RLS — quem vê o quê
- **Representante:** continua vendo SÓ o próprio dado (vendas/pipeline/comissão). Nunca custo de produto, margem, nem dado de outro rep. (regra já definida)
- **Diretor Comercial / Admin (papel `director`/`admin`):** vê o agregado de TODA a empresa dele — cruzando reps, áreas, linhas, preços. Dentro do `company_id` apenas (multi-tenant garante que o diretor da empresa X nunca vê dado da empresa Y).
- Política RLS: `director`/`admin` ignora o filtro rep-level, mas SEMPRE preso ao `company_id`.

### 1.4 Telas (React + Tailwind)
Rota nova tipo `/repco/inteligencia` (acesso só director/admin):
- **Visão geral:** faturamento e volume do período, variação vs período anterior, por linha e por canal.
- **Mapa de calor de vendas por área** (município/UF) — onde está saindo mais café.
- **Ranking de representantes** — faturamento, ticket médio, nº de clientes ativos, linhas que mais vende.
- **Tabela de preço praticado por linha/área** — para detectar erosão de preço e oportunidade.
- **Filtros:** período, linha, canal, rep, região.

> Resultado: o "ajuste de distribuição em tempo real baseado em dados puros de consumo" da 3 Corações — sobre o dado próprio da Saporino.

---

## CAMADA 2 — Motor de Prospecção B2B com dados públicos (SEGUNDO)

**Por que segundo:** depende do modelo de "clientes ativos por área" da Camada 1 para cruzar e revelar os buracos de cobertura. Tudo aqui usa dado **público e gratuito**.

### 2.1 Fontes (APIs gratuitas)
- **Base de CNPJ (Receita Federal / dados abertos):**
  - **OpenCNPJ** (`opencnpj.org`) — API pública gratuita, sem cadastro, ~50 req/s por IP, e **base completa em ZIP para download** (ideal para carregar offline no Supabase).
  - **CNPJá API pública** (`cnpja.com/api/open`) — dados cadastrais, situação, endereço, CNAEs, sócios, Simples Nacional; 5 consultas/min/IP (tier comercial para volume).
  - **BrasilAPI** — apoio para CEP/complementos.
- **IBGE** (`servicodados.ibge.gov.br`) — população, renda e dados de município (priorização de esforço por região).

### 2.2 Como puxar para o RepCo
**Estratégia recomendada: ETL em lote, não consulta ao vivo.** Baixar a base completa de CNPJs (OpenCNPJ ZIP), filtrar e carregar uma vez, atualizar periodicamente — evita estourar limite de API e dá resposta instantânea no app.

Passos para o Claude Code:
1. Criar tabela Supabase `prospects_b2b` (cnpj, razao_social, nome_fantasia, cnae_principal, cnae_descricao, situacao, logradouro, municipio, uf, cep, lat, lng, fonte, atualizado_em, `company_id`).
2. Script de ETL (rodar em função serverless/Vercel ou job local) que:
   - baixa/filtra a base por **CNAE-alvo** + **UF/municípios de interesse** (começar por SP, depois MG/Cerrado);
   - insere/atualiza em `prospects_b2b`;
   - geocodifica endereço → lat/lng (ou agrega por CEP/município numa primeira versão simples).
3. **CNAEs-alvo (confirmar a lista exata na carga):** restaurantes, lanchonetes/casas de chá e sucos, padarias/confeitarias, mercearias/minimercados/supermercados, hotéis/pousadas, bares/cafeterias, food service. (Verificar os códigos exatos contra a tabela CNAE no momento do ETL.)

### 2.3 Telas
- **Mapa de prospecção:** pins dos prospects B2B sobrepostos aos clientes ativos (vw_clientes_ativos_por_area da Camada 1).
- **Mapa de buracos:** regiões com alta densidade de prospects e baixa/nenhuma cobertura de rep → onde abrir território.
- **Lista exportável por área/CNAE** para o diretor distribuir aos representantes.

> Resultado: o Diretor Comercial monta times estratégicos por área com base em densidade real de PDVs potenciais, não em achismo.

---

## CAMADA 3 — Multi-tenant como produto (SaaS) (TERCEIRO)

**Por que terceiro:** só faz sentido depois que as Camadas 1 e 2 provarem valor com a própria Saporino. A fundação técnica (`company_id` + RLS) já está aprovada — esta camada é a *comercialização* dela.

### Conceito (analogia The Coffee/Jungle)
A 3 Corações usou a logística que já existia para dar escala nacional a marcas de terceiros — mais faturamento no mesmo caminhão. Em software: uma vez que o RepCo multi-tenant existe ("o caminhão"), **outras torrefadoras/distribuidoras plugam produtos e representantes na plataforma da Saporino, pagando assinatura.** Custo marginal do cliente nº 2 ≈ zero. A inteligência de dados (Camadas 1 e 2) é o diferencial que justifica a mensalidade.

### O que isso exige tecnicamente (boa parte já encaminhada)
- `company_id` em todas as tabelas core (já aprovado) — **agora as políticas RLS precisam ser efetivamente ENFORCED**, não só estruturadas.
- Isolamento total de dados entre empresas (resposta à pergunta nº 1 de qualquer comprador/investidor: "meus dados e comissões vazam para outra empresa?"). RLS no nível do banco — nunca no frontend — é o que torna a transparência ao representante segura.
- Onboarding de nova empresa-cliente, billing/assinatura, e provisionamento de usuários (director/reps) por `company_id`.

### Argumento de venda (para pitch/investidores)
1. **Isolamento de dado por empresa** (multi-tenant/RLS no banco) — responde à dúvida nº 1 sobre vazamento de dado/comissão entre empresas.
2. **Transparência ao representante** (ele vê pipeline, comissão acumulada e data de pagamento) como diferencial — e a RLS é o que torna essa transparência segura.

---

## O que NÃO fazer agora
- **Não contratar NielsenIQ/Scanntech.** É o dado que gigante compra para ver o mercado todo; custo de dezenas a centenas de milhares de R$/ano. Fase 4 eventual, não fundação.
- **Não tentar "ler nota fiscal de concorrente".** Não é público e não é o caminho. O poder está no dado próprio + dado público de prospecção.
- **Não construir as 3 camadas em paralelo.** Camada 1 é laje; 2 e 3 dependem dela.

---

## Sequência de implementação (resumo executável)
1. **Camada 1.1–1.2:** garantir dimensões nos pedidos + criar as views de agregação no Supabase.
2. **Camada 1.3:** política RLS para papel `director`/`admin` (agregado por `company_id`).
3. **Camada 1.4:** rota `/repco/inteligencia` com visão geral + mapa de calor + ranking de reps + preço praticado.
4. **Camada 2.1–2.2:** tabela `prospects_b2b` + ETL da base CNPJ (OpenCNPJ) filtrada por CNAE+UF.
5. **Camada 2.3:** mapa de prospecção + mapa de buracos de cobertura.
6. **Camada 3:** enforcement de RLS multi-tenant + onboarding/billing de empresas-cliente.

---

## Pendência permanente (sempre no recap)
**Resend email setup PENDING — aguardando a nova conta Google Workspace @cafesaporino.com.br.**
