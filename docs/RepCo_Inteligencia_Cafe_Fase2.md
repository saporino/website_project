# Fase 2 — classificação inteligente do universo do café

> Executada em 13/10/2026 sobre os **6.208 anúncios já coletados**. Nenhuma coleta paga foi
> feita. Nenhum registro original foi alterado.

## O que mudou no método

A régua antiga (`normalize.ts`, 44 linhas) perguntava *"que tipo de café é este?"* e terminava
com `return 'torrado_moido'`. Como nunca perguntava **se era café**, tudo que não casasse com
nenhuma regra virava café moído.

A régua nova (`classificarCafe.ts`) inverte a ordem:

1. **pertence ao universo?** → relevante · ambíguo · fora do escopo
2. **o que é?** → família (café, bebida pronta, filtro, coador, equipamento, embalagem, acessório)
3. **só então** apresentação, classe, composição, peso, marca — **em campos separados**, porque
   um produto é gourmet *e* arábica *e* torrado e moído ao mesmo tempo.

O que não dá para decidir vira **ambíguo** e espera revisão humana, em vez de virar café por
descuido.

## Onde a classificação mora

Tabela nova `ecommerce_classificacao`, **paralela** ao snapshot, com a versão da régua gravada
em cada linha (regra 8 do briefing). O dado coletado continua exatamente como veio da fonte.
Isso permite rodar uma régua nova sem apagar a anterior e comparar as duas — e todo número de
relatório sabe dizer com que versão foi medido.

A view `vw_cafe_comparavel` entrega só o que é relevante na última versão.

## Resultado sobre os 6.208 anúncios

### Relevância

| | | |
|---|---|---|
| relevante | 4.841 | 78,0% |
| ambíguo (aguarda revisão) | 1.179 | 19,0% |
| fora do escopo | 188 | 3,0% |

### Família — com quem cada item pode ser comparado

| | | |
|---|---|---|
| café | 5.530 | 89,1% |
| **bebida pronta** (café com leite, cappuccino) | **405** | 6,5% |
| fora do universo | 188 | 3,0% |
| equipamento | 42 | 0,7% |
| coador | 15 | 0,2% |
| acessório | 13 | 0,2% |
| embalagem | 10 | 0,2% |
| filtro de papel | 5 | 0,1% |

Os 405 de **bebida pronta** estavam misturados com café puro na v1 — e café com leite tem
preço por quilo que não se compara com café.

### O erro que mais distorcia número

**248 pesos corrigidos**, todos multipack de cápsula:

```
 4,4 g → 79,2 g   Café em Cápsula Nescafé Brasil 18x4,4g
 5,3 g → 53,0 g   Café em Cápsulas Melitta Lungo 10x5,3g
 5,2 g → 52,0 g   Café em Cápsula Pilão Colômbia 10x5,2g
```

A v1 lia o peso de **uma** cápsula e ignorava o multiplicador. Efeito no preço médio:

| apresentação | v1 (R$/kg) | n | v2 (R$/kg) | n |
|---|---|---|---|---|
| **cápsula** | **1.363,96** | 869 | **401,71** | 357 |
| torrado e moído | 110,60 | 2.266 | 95,86 | 1.343 |
| grãos | 161,53 | 472 | 159,18 | 453 |
| solúvel | 216,43 | 789 | 236,01 | 648 |

O preço médio da cápsula estava **3,4× inflado**. Qualquer decisão de posicionamento tomada
sobre esse número estava errada.

### Preço por quilo: menos, e certo

**818 itens perderam o preço por quilo** — não é perda, é correção: eram contas feitas sobre
peso ambíguo. A regra agora é explícita: *sem peso confiável, não existe preço por quilo*.

Um "Caixa C/ 10un" sem peso por unidade não vira R$/kg nenhum, e o motivo fica registrado.

### Dois achados que o título sozinho esconderia

- **"Sandália Havaianas 37/38 Café par"** — aqui "café" é a **cor**. Agora sai do escopo.
- **Almofada, tijolo a vácuo e pouch** são formatos que, no varejo brasileiro, só existem para
  café moído: grão inteiro não é vendido assim. Usar esse sinal derrubou o ambíguo de **29,2%
  para 19,0%** sem chutar — e cada dedução fica escrita no campo `motivos`.

## Testes

`src/lib/classificarCafe.test.ts` — **36 casos, todos com títulos reais do banco**, incluindo
cada erro que a auditoria encontrou. Se algum voltar, o teste quebra.

## O que ainda não está resolvido

- **1.179 ambíguos** esperando revisão. A maioria é "diz café, não diz a apresentação"
  (ex.: *Café Nescafé Original 150g*). Precisam da tela de revisão — hoje a tabela já tem
  `revisado_por`, `revisado_em` e `correcao`, mas **não existe interface**.
- **Filtros: 5 itens.** O briefing exige comparar 102 com 102. O classificador já guarda o
  número, mas a base quase não tem filtros — é questão de coleta, não de régua.
- **Equipamentos: 42.** Mesma situação.
- **Os relatórios de produção continuam na v1.** Nada foi trocado, conforme a regra 11.

## Próxima etapa recomendada

1. **Tela de revisão dos ambíguos** no RepCo — sem ela, os 1.179 não viram dado útil e o ciclo
   de melhoria não fecha. É também o que começa a tirar a operação do terminal (regra 7 do
   briefing original).
2. **Só então** trocar os relatórios para a v2, com o antes/depois à vista.
3. **Depois disso**, ampliar a coleta — buscando por categoria em vez do termo genérico
   "café", que é o que traz chocolate e sandália.
