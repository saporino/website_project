# Inteligência de mercado do café no RepCo — auditoria (13/10/2026)

> Fase 1 do briefing "Aprimoramento da inteligência de mercado do café via Apify".
> **Nada foi alterado.** Este documento é o diagnóstico do que existe, medido no banco de
> produção e no código, para decidir o que construir.

## 1. O que já existe

### Três caminhos de coleta, independentes entre si

| Caminho | Edge function | Para que serve | Estado |
|---|---|---|---|
| Prospecção B2B | `apify-places` | empresas no Google Maps (actor `compass~crawler-google-places`) | **em uso** — 10 execuções, 1.057 leads |
| Descoberta | `discovery-run` | grupos/redes (actor `lofomachines~whatsapp-group-search`) | **construído, nunca usado** — 0 linhas |
| Preço de e-commerce | `ecommerce-scrape` | anúncios em marketplace e supermercado | **em uso** — 6.208 anúncios |

### Fontes cadastradas (`ecommerce_sources`, 15 linhas)

- **4 com actor Apify (custo por execução):** Amazon (`viralanalyzer~amazon-brazil-intelligence`), Mercado Livre (`riseandcode/apify-mercadolivre-search`), Shopee (`gio21/shopee-scraper`), TikTok Shop (`trakk/tiktok-shop-search-scraper`).
- **11 sem actor, varredura VTEX própria (custo zero):** Atacadão, Savegnago, Muffato, Giga, Mambo, Covabra, Santa Luzia, Sam's, Oba, Natural da Terra, Hortifruti.

### Volume coletado

```
super_atacadao   1824 itens · 9 dias · 19/06 → 26/09
super_savegnago   824 itens · 3 dias
super_muffato     710 itens · 3 dias
super_giga        648 itens · 5 dias
super_mambo       642 itens · 2 dias
super_covabra     405 itens · 2 dias
super_santaluzia  298 itens · 1 dia
super_sams        247 itens · 2 dias
mercadolivre      200 itens · 1 dia (15/06)
super_oba         153 itens · 1 dia
amazon            108 itens · 1 dia (15/06)
super_natural      90 itens · 1 dia
super_hortifruti   59 itens · 1 dia
—————
6.208 anúncios · 2.517 SKUs distintos · última coleta 26/09 (17 dias atrás)
```

Também existem **758.929 linhas em `prospects_b2b`** (base CNPJ carregada) e **68 em
`coffee_market_index`**. `gondola_itens` e `discovery_results` estão zeradas.

### Como a classificação funciona hoje

Tudo vem de `supabase/functions/_shared/normalize.ts` — **44 linhas**, expressões regulares
sobre o título:

```ts
classifyType(title) →
  cápsula | filtro | solúvel | grãos | torrado_moido   // ← fallback
```

E um filtro de sanidade por faixa de R$/kg que marca `is_suspect`.

## 2. Problemas encontrados (medidos, não suposições)

### 2.1 Não existe teste de relevância — o maior buraco

O normalizador decide **qual tipo de café** o item é. Ele **nunca pergunta se é café**. E o
último `return` é `torrado_moido`, então tudo que não casa com nenhuma regra vira café moído.

Resultado, contado no banco:

| | |
|---|---|
| chocolate, biscoito, bolo, sorvete, panetone, bombom | **143** |
| café **com leite** (categoria diferente, R$/kg incomparável) | **132** |
| copo, caneca, xícara, garrafa | 6 |

Exemplos reais que hoje estão como `torrado_moido`:

```
Chocolate Lacta Intense Amargo 60% Cacau Café 85g
Bolo Casa Suíça Café da Manhã Chocolate 250g
Biscoito de Café Coffee Joy 90g
```

Esses entram na média de preço do café moído.

### 2.2 Peso e multipack

| | |
|---|---|
| sem peso extraído | **890** (14,3%) |
| sem preço por kg | **1.809** (29,1%) |
| com "kit/pack/unidades" no título e sem peso | **185** |

Pior que a ausência: `extractWeightG` pega o **primeiro** número seguido de g/kg. Em
`Café em Cápsulas 3 Corações 10x9g`, lê **9 g** e ignora o `10×` — o preço por quilo sai
**dez vezes errado**, e passa no filtro de sanidade porque cápsula não tem faixa definida.

### 2.3 Categorias que o briefing pede e não existem

`unit_type` tem cinco valores. Comparando com o briefing:

- **Filtros (categoria C):** 26 itens no total, e o tipo `filtro` **não distingue 102 de 103** — exatamente a comparação que o briefing diz que não pode ser feita.
- **Equipamentos (categoria D):** não existem. Cafeteira, moedor e prensa cairiam em `torrado_moido`.
- **Embalagens (categoria E):** não existem.
- **Apresentação × classificação comercial × composição:** hoje é **um campo só**. Não dá para dizer "gourmet, 100% arábica, torrado e moído" — são três eixos espremidos em `unit_type`.

### 2.4 Sem nível "ambíguo"

O briefing pede relevante / ambíguo / fora do escopo, com revisão humana. Hoje existe só
`is_suspect` (181 itens), que é sanidade de preço, não classificação — e ninguém revisa.

### 2.5 Operação depende de terminal

`scripts/load_ecommerce_dataset.py` existe para carregar um dataset já exportado do Apify.
É útil (reaproveita run pago, custo zero), mas confirma a reclamação do briefing: parte da
rotina comercial vive fora do painel.

### 2.6 Custo é registrado só na prospecção

`prospect_runs` tem `cost_estimate_usd` e `cost_actual_usd` — 10 execuções, **US$ 3,10
estimado contra US$ 0,20 real**, ou seja, a estimativa é ~15× mais pessimista que a conta.
**`ecommerce-scrape` não registra custo nenhum**: não há como responder "quanto gastamos
coletando preço".

### 2.7 Dados frios

Última coleta: **26/09**, 17 dias atrás. Amazon e Mercado Livre têm **um único dia** (15/06).
Não há histórico suficiente para evolução de preço, que é o valor principal da camada.

## 3. Taxonomia recomendada

Separar o que hoje é um campo só em **eixos independentes**, porque um produto pertence a
vários ao mesmo tempo:

| Eixo | Valores | Hoje |
|---|---|---|
| `familia` | café, filtro, equipamento, embalagem, acessório, **fora do escopo** | não existe |
| `apresentacao` | torrado e moído, grãos, solúvel, cápsula, sachê, pronto para beber, verde | é o atual `unit_type` |
| `classe` | tradicional, extraforte, superior, gourmet, premium, especial | não existe |
| `composicao` | 100% arábica, robusta/conilon, blend, descafeinado, orgânico | só `is_arabica` |
| `metodo` | espresso, coador, prensa, italiana | não existe |
| `embalagem` | peso líquido, unidades por pacote, pacotes no kit | só `weight_g` |
| `relevancia` | relevante, ambíguo, fora do escopo | não existe |

**Regra de comparação:** só comparar dentro de mesma `familia` + `apresentacao`, e por
**R$/kg** quando houver peso confiável. Filtro compara com filtro do **mesmo número**.

## 4. Riscos técnicos

1. **Reclassificar os 6.208 itens existentes** muda números que já foram vistos em relatório. Precisa de versão do classificador gravada na linha, para saber com que régua cada item foi medido.
2. **Actor de terceiro muda sem aviso** — campo que some vira dado nulo silencioso. Hoje não há verificação de contrato de retorno.
3. **Custo de coleta nacional**: 11 supermercados VTEX são grátis; os 4 marketplaces Apify custam por item. Sem registro de custo no `ecommerce-scrape`, qualquer ampliação é às cegas.
4. **Termo de busca genérico**: as fontes buscam `"café"`, o que traz chocolate e bolo. Buscar por categoria reduziria lixo **e** custo.

## 5. Próxima unidade recomendada

**Classificador de relevância + eixos, aplicado em cima dos 6.208 itens que já temos** —
custo zero de Apify, porque usa dado já pago:

1. acrescentar as colunas dos eixos e `relevancia`, sem apagar `unit_type`;
2. reescrever `normalize.ts` com teste de relevância e detecção de multipack;
3. rodar sobre o histórico e **medir** quantos mudam de classificação;
4. mostrar o antes/depois antes de valer para relatório.

Só depois disso faz sentido ampliar a coleta: coletar mais com classificador ruim é pagar
para aumentar o lixo.
