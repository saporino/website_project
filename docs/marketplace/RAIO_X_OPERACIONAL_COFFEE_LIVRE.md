# RAIO-X OPERACIONAL — COFFEE LiVRE

> **Fonte oficial de arquitetura operacional do Coffee LiVRE.**
>
> **Origem deste documento.** Nenhum RAIO-X operacional foi fornecido ao projeto por outra via — verificado em todo o repositório, incluindo `docs/governanca` e `docs/_legacy`. O conteúdo abaixo é a auditoria de 21 seções levantada sobre o código real em 10/09/2026, mais as decisões de arquitetura tomadas desde então. É a única versão que existe.
>
> **A seção 17 é o registro de evolução.** Toda unidade entregue é anotada lá, e em nenhum outro arquivo.

Referência visual: [`coffee-livre-home-laranja.html`](coffee-livre-home-laranja.html), nesta pasta.

---

## 1. O que é o Coffee LiVRE

Marketplace vertical de café. Produtores, torrefações, empacotadores e marcas vendem direto ao consumidor, e a plataforma cuida de vitrine, descoberta e, em fases seguintes, de pagamento e logística.

**A visão não para no pacote de café.** O Coffee LiVRE é o marketplace do ecossistema: cafeteiras, moedores, filtros, coadores, acessórios e insumos entram no mesmo catálogo. Essa decisão tem consequência técnica direta, registrada na seção 10.

**Marca independente.** Para o visitante, a protagonista é o Coffee LiVRE. COFICO e RepCo podem ser infraestrutura tecnológica e operacional nos bastidores; não aparecem na interface pública.

**Endereço hoje:** `coficobrasil.com.br/coffeelivre`, atrás de portão privado.
**Endereço futuro:** `coffeelivre.com.br`. Nenhum caminho absoluto da COFICO é escrito à mão no código: tudo sai de `src/pages/coffeelivre/config.ts`.

## 2. Fronteiras com o resto do ecossistema

| Plataforma | Domínio | Relação |
|---|---|---|
| **Coffee LiVRE** | marketplace transacional de café | esta |
| **Coffee Network** | relacionamento e oportunidades B2B entre participantes, com escudo de contato | irmã, sem acoplamento |
| **Saporino** | marca de café própria | pode ser vendedora um dia, nunca a cara da plataforma |
| **COFICO Last Mile** | operação logística | fornecedor potencial de fulfillment |
| **RepCo** | plataforma de vendas B2B e inteligência | camada tecnológica candidata |

**Verificado no código:** Coffee Network e Coffee LiVRE não se tocam em nenhum ponto. Nenhum import, nenhuma tabela em comum, nenhuma rota compartilhada.

**Regra de isolamento:** toda tabela do Coffee LiVRE usa o prefixo `lv_`. Nenhuma tabela de Saporino, RepCo ou COFICO é alterada, lida ou reaproveitada. Compartilha-se infraestrutura (Supabase, Auth, Storage), nunca tabela de domínio.

**Como o RepCo pode ser a camada tecnológica sem misturar domínio:** o RepCo já tem o padrão de que o Coffee LiVRE precisa, que é coluna de tenant em toda tabela núcleo mais RLS. O Coffee LiVRE entra como plataforma própria, com tabelas próprias e prefixo próprio. O que separa domínio de infraestrutura é disciplina de nome e de tabela, não de repositório.

## 3. Princípios de construção

1. **RLS desde a primeira tabela.** Não existe "ligo depois".
2. **Prefixo `lv_` sem exceção.**
3. **Fidelidade ao visual aprovado.** O HTML de referência manda; o CSS é gerado dele por `scripts/escopar-css-coffeelivre.mjs` e escopado em `.livre-root`.
4. **Dado de demonstração é identificável na origem**, por coluna `is_demo`, não por convenção de nome.
5. **Campo vazio não vira informação fictícia.** O Coffee Passport mostra o que existe e cala o resto.
6. **Atributo depende da categoria**, nunca do produto.
7. **Nada que gere custo ou transação externa na fase 1.**
8. **Caminho e identidade centralizados** em `config.ts`.

## 4. Estado do código

```
src/pages/coffeelivre/          página pública
├── config.ts                   caminho base, marca, rotas permanentes  ← centralizador
├── catalogo.ts                 única porta de leitura do catálogo
├── CoffeeLivrePage.tsx         raiz
├── AccessGate.tsx              portão da demonstração
├── mockData.ts                 dados da home (a substituir na unidade 3)
├── svg.tsx                     33 ilustrações
├── coffeelivre.css             gerado do HTML oficial
└── 15 componentes de seção

src/components/admin/
├── PlataformasAdmin.tsx        agrupador: Coffee Network | Coffee LiVRE
└── coffeelivre/
    ├── CoffeeLivreAdmin.tsx    casca com as sub-abas
    └── LivreAcesso.tsx         códigos da demonstração

public/coffeelivre/             logo 494×128 · ícone 64×68
docs/marketplace/               HTML de referência · este documento
scripts/                        escopar-css-coffeelivre.mjs · verificar-coffeelivre.mjs
```

**Acoplamento com o resto do sistema:** rota e título em `App.tsx`, tokens `livre-*` no Tailwind, link no rodapé da COFICO, aba do admin. Nada mais.

## 5. O que funciona, o que é maquete, o que não existe

*Levantado em 10/09/2026 e atualizado a cada unidade.*

| Área | Situação |
|---|---|
| Home | visual real, dados de maquete até a unidade 3 |
| Header, benefícios, categorias, origens, lojas, rodapé | apenas visual |
| Hero, carrosséis, favoritar, carrinho, toast | funciona, estado local no navegador |
| Busca | apenas interface: mostra aviso e não busca |
| Portão privado | **funciona**, conferido no servidor |
| Catálogo (vendedor, loja, categoria, produto, atributo) | **funciona**, no banco, com RLS |
| Coffee Passport | **estrutura pronta**, tela na unidade 5 |
| Página de produto, de loja, de categoria | não existe |
| Carrinho como página, checkout, login, cadastro | não existe |
| Seller Central, Investor View | não existe |
| Avaliações, favoritos persistentes, pedidos, pagamentos, frete | não existe |

## 6. Acesso da demonstração

Portão de conveniência, **não autenticação de marketplace**. Código guardado como hash em `lv_demo_access`, conferido no servidor por `lv_validar_acesso`, sessão de trinta dias no navegador, logout no rodapé. Vários códigos coexistem: dá para entregar um por convidado e desativar o que vazou.

Não existe usuário comprador, vendedor, papel ou sessão de banco. A autenticação real é fase 2.

## 7. Vendedor e loja

**Implementado.** Duas tabelas separadas desde o primeiro dia, mesmo com relação de um para um hoje.

- **Vendedor** (`lv_sellers`) é quem responde pelo negócio: razão social, CNPJ, tipo, cidade, responsável, situação. **Não é público** — CNPJ e contato só o administrador lê.
- **Loja** (`lv_stores`) é a presença pública: slug, nome, chamada, história, especialidade, logo, capa, cor. Legível por qualquer visitante.

Separar depois, com produto e URL já apontando para a entidade errada, seria caro. Separar agora custou uma tabela.

**Tipos iniciais de trabalho, não regra jurídica:** produtor, fazenda, cooperativa, torrefação, indústria, marca, distribuidor, empacotador. Campo texto, e não enum, porque ainda vamos aprender os recortes reais.

## 8. Produto, oferta e lote

**Implementado hoje:** produto carrega preço, peso e estoque implícito, com um vendedor por item.

**Deliberadamente NÃO congelado:** a separação em três camadas. Registrada aqui para não ser tomada por acidente, e para que ninguém a implemente cedo demais.

- **Produto** é o item que o vendedor cadastra.
- **Oferta** seria preço, estoque e condição, quando houver concorrência pelo mesmo item.
- **Lote** seria a origem rastreável de uma safra.

Produto canônico compartilhado entre vendedores funciona mal para café: dois lotes do mesmo Catuaí de dois produtores não são o mesmo item, e a diferença entre eles é o que dá valor à plataforma. **O caminho de saída é aditivo:** nasce `lv_offers` e o produto perde as colunas de preço. Migração de dados, não de conceito.

## 9. Coffee Passport

**Estrutura implementada. Tela na unidade 5.**

É o diferencial defensável da plataforma: a identidade digital do café dentro do Coffee LiVRE.

**Não tem tabela própria, de propósito.** É a projeção dos atributos marcados como `no_passport` que o produto realmente tem, pela view `vw_lv_coffee_passport`. Consequências:

- campo sem valor simplesmente não existe na saída, e a tela não tem como inventar;
- acrescentar um campo ao Passport é uma linha em `lv_attributes`, não uma migration de coluna;
- café comercial e microlote usam a mesma estrutura e mostram coisas diferentes, porque preencheram coisas diferentes.

**Campos previstos e já cadastrados:** origem, região, fazenda, produtor, espécie, variedade, processo, safra, lote, torra, moagem, pontuação, notas sensoriais, certificações, data de torra, peso.

**Níveis, derivados e nunca escolhidos numa caixa de seleção**, pela função `lv_nivel_do_passport`:

| Nível | Critério |
|---|---|
| **especial** | pontuação registrada de 80 ou mais |
| **origem_identificada** | tem fazenda, produtor, região ou variedade |
| **comercial** | tem ao menos torra, moagem ou espécie |
| *nulo* | não é café |

### QR Code permanente

Cada produto tem slug único e URL estável, obtida por `rotaDoProduto(slug)`. É o destino de um QR que a torrefação poderá imprimir na embalagem, no balcão, em display ou em material de feira:

```
QR → coffeelivre.com.br/cafe/[slug] → Coffee Passport → produto → comprar
```

**Regra dura:** embalagem não se recolhe. O slug de um produto que já circulou **nunca** pode mudar. A troca de domínio, essa sim, é livre: muda `BASE` no `config.ts` e todo QR antigo segue funcionando por redirecionamento.

Geração de imagem do QR, contagem de leitura e material de impressão ficam para fase posterior. Nada na arquitetura atual os impede.

### Lot Passport — extensibilidade registrada, não implementada

- **Coffee Passport** é a identidade permanente do café.
- **Lot Passport** seria a identidade de uma safra ou lote específico daquele café.

O caminho é aditivo e não exige mexer no que existe: uma tabela `lv_lots` mais uma `lv_lot_attributes` com a **mesma forma** de `lv_product_attributes`, reaproveitando o mesmo catálogo `lv_attributes`. O produto ganha um `current_lot_id` opcional, e o Passport passa a ler o lote quando existir e o produto quando não existir.

## 10. Categorias e atributos

**Implementado.** Árvore de categorias em dois ramos, e o segundo ramo é a prova da tese da seção 1:

```
Cafés                      Equipamentos e acessórios
├── Café em grãos          ├── Cafeteiras
├── Café torrado e moído   ├── Moedores
├── Cafés especiais        ├── Filtros e coadores
├── Cápsulas               └── Acessórios
└── Drip coffee
```

**O atributo pertence à categoria, não ao produto.** Uma coluna `variedade` em `lv_products` obrigaria todo moedor a ter uma. Em vez disso, `lv_attributes` é o catálogo de campos possíveis, `lv_category_attributes` diz quais valem onde, e `lv_product_attributes` guarda só os valores que cabem.

Resultado verificado: os filtros de "Cafés especiais" são origem, região, espécie, processo, torra, moagem, pontuação, certificações e peso. Os de "Moedores" são material, capacidade e voltagem. **Um moedor não tem como ter pontuação SCA**, e isso é estrutural, não disciplina.

## 11. Banco

| Tabela | Finalidade | Leitura pública |
|---|---|---|
| `lv_settings` | configuração em chave/valor | não |
| `lv_demo_access` | códigos da demonstração, como hash | não |
| `lv_sellers` | vendedor: CNPJ, tipo, contato, situação | **não** |
| `lv_stores` | vitrine pública do vendedor | sim, se ativa |
| `lv_categories` | árvore de categorias | sim, se ativa |
| `lv_attributes` | catálogo de campos possíveis | sim |
| `lv_category_attributes` | quais campos valem em qual categoria | sim |
| `lv_products` | produto | sim, se publicado |
| `lv_product_attributes` | valores por produto | sim, se o produto estiver publicado |
| `lv_product_images` | imagens | sim, se o produto estiver publicado |

| Função ou view | Finalidade |
|---|---|
| `lv_normalizar_codigo(text)` | sha256 do código sem caixa e sem espaços |
| `lv_validar_acesso(text)` | confere um código sem expor a tabela |
| `vw_lv_coffee_passport` | campos de passaporte que têm valor |
| `lv_nivel_do_passport(uuid)` | comercial, origem identificada ou especial |

**Armadilha do ambiente:** `pgcrypto` mora no schema `extensions` neste projeto. Toda função com `search_path` fixo que use `digest` precisa escrever `extensions.digest`, senão falha com "function digest does not exist".

## 12. Fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 1 | Fundação, portão, catálogo, home real, busca, produto, Passport, loja, captação de vendedor, admin mínimo, visão | em andamento |
| 2 | Autenticação real, carrinho, checkout, pagamento, split | não iniciada |
| 3 | Fulfillment, logística, NF-e, repasse automático | não iniciada |
| 4 | Assinatura, mídia, inteligência de dados, serviços ao vendedor, QR com métricas, Lot Passport | não iniciada |

**Fora de escopo na fase 1:** pagamento real, Mercado Pago, OAuth de vendedor, split, cobrança, NF-e, fulfillment, transportadora, emissão fiscal, contratos definitivos, regras tributárias, automações financeiras e qualquer integração externa que gere custo ou transação.

## 13. Decisões pendentes

**Negócio:** modelo de receita e percentual de comissão; quem é o vendedor legal na transação; se a Saporino vende lá dentro e em que condição; exclusividade.

**Produto:** quando separar produto de oferta; o que é um lote; quais atributos passam a ser obrigatórios.

**Vendedor:** quais tipos são aceitos; como é aprovado; o que pode publicar sozinho; se há plano ou mensalidade; o que a Seller Central faz.

**Comprador:** pessoa física, jurídica ou ambas; cadastro obrigatório para comprar; assinatura.

**Financeiro e pagamentos:** quem recebe primeiro; prazo de repasse; retenção; quem emite a nota; provedor; split ou repasse manual; chargeback.

**Logística:** envio pelo vendedor ou fulfillment; papel da COFICO; frete por item ou por pedido; pedido com dois vendedores.

**Confiança e segurança:** avaliações de quem e de quê; moderação; disputas; a promessa de "compra garantida" que o mockup já faz.

**Legal:** termos do marketplace; contrato com vendedor; LGPD.

**Tecnologia:** onde os dados moram a longo prazo; domínio próprio; motor de catálogo e busca.

**Investidor:** o que a demonstração precisa provar; quais números mostrar; dado real ou simulação declarada.

## 14. Premissas que vieram do mockup e nunca foram ratificadas

Estão escritas na home e ninguém assumiu: frete grátis acima de noventa e nove reais, cinco por cento de desconto no Pix, até seis parcelas sem juros, "compra garantida, receba ou seu dinheiro de volta", trinta por cento na semana do especial, assinatura com quinze por cento, dez por cento na primeira compra.

Não aparecem em lugar nenhum, nem como maquete: comissão do marketplace, política de devolução, aprovação de vendedor, exigência de pessoa jurídica, ranking e reputação.

## 15. Riscos conhecidos

| Risco | Estado |
|---|---|
| "Nespresso" em nome de produto | **resolvido** na unidade 2: fora dos seeds |
| "Loja Saporino" e "Café Fazendinha" como vendedores de exemplo | **resolvido** na unidade 2 |
| Portão é conveniência, não segurança | mitigado: código saiu do pacote JavaScript |
| Celular perde a navegação acima de 560 px, sem menu substituto | **aberto** |
| Promessas comerciais no ar sem ratificação | **aberto** |
| Home ainda lê dados do próprio código | aberto até a unidade 3 |
| CSS gerado por script: edição manual se perde na próxima geração | documentado no topo do arquivo |

## 16. Identidade e verificação

Laranja `#DA6418`, cabeçalho `#E97524`, claro `#F3A066`, marrom `#3A2318`, escuro `#24150E`, etiqueta `#EFE3DA`. Tokens no Tailwind com prefixo `livre-`, para uso futuro; a página usa o CSS próprio.

**Nunca misturar** com o vermelho da Saporino ou da COFICO na interface pública. Tom: popular e profissional, brasileiro, acessível, moderno, comercialmente forte. Evitar luxo excessivo, cafeteria boutique, SaaS corporativo e aparência de template.

`node scripts/verificar-coffeelivre.mjs` compara o porte com o HTML oficial: classes, textos, contagens, SVGs e as declarações de CSS. Deve terminar em "SEM DIFERENCAS a justificar".

---

## 17. Registro de evolução

### Unidade 0 — Porte da home (10/09/2026)

Home oficial portada para React com fidelidade verificada. Rota `/coffeelivre`, portão por variável de ambiente, CSS escopado, 33 SVGs convertidos, dados em `mockData.ts`. Verificador sem diferenças.

### Unidade 1 — Fundação e portão (11/09/2026)

**Migration:** `20260911100000_fundacao_coffee_livre.sql`. Primeiras tabelas `lv_`, ambas com RLS admin-only desde o nascimento.

**O que mudou:** o código de acesso saiu do pacote JavaScript. Antes vinha de `VITE_COFFEELIVRE_CODE` e era comparado no navegador, legível por qualquer visitante e impossível de trocar sem deploy. Agora vive no banco como hash e é conferido por `lv_validar_acesso`, que devolve apenas verdadeiro ou falso.

**Também nesta unidade:** logout no rodapé; `config.ts` centralizando caminho base, marca e assets; admin de acesso com criação, desativação e contagem de uso; agrupador **Plataformas** no admin, reunindo Coffee Network e Coffee LiVRE sem somar aba nova à barra.

**Verificado:** código certo com espaço e caixa trocada entra; errado e vazio não; `anon` não lê `lv_demo_access` nem `lv_settings`; logout limpa a sessão e volta ao portão; sem rolagem horizontal em 375 px; campo do portão com fonte de 16 px, que evita o zoom automático do iOS; `TROCAR_ESTE_CODIGO` não aparece em lugar nenhum do `dist`.

**Não verificado:** o admin na tela, porque o navegador de teste não está autenticado como administrador.

### Unidade 2 — Catálogo (11/09/2026)

**Migrations:** `20260911140000_catalogo_coffee_livre.sql` (estrutura) e `20260911150000_seeds_demo_coffee_livre.sql` (demonstração).

**Oito tabelas, uma view e uma função.** Vendedor separado de loja; categoria em árvore cobrindo café e equipamentos; atributo ligado à categoria e não ao produto; Coffee Passport como projeção, sem tabela própria; nível derivado do preenchimento.

**Seeds:** 5 vendedores de perfis diferentes (fazenda, torrefação pequena, marca regional, torrefação de especiais, equipamentos), 5 lojas, 11 categorias, 20 atributos, 11 produtos e 77 valores de atributo. Tudo com `is_demo = true` na origem.

**Problemas da auditoria corrigidos:** saíram "Loja Saporino", "Café Fazendinha" e "Nespresso" dos dados de demonstração.

**Verificado:** anônimo lê loja, categoria, atributo e produto publicado, e **não** lê vendedor, configuração nem código de acesso; anônimo não escreve; produto em rascunho não aparece, e os atributos dele caem junto; filtros de "Cafés especiais" trazem pontuação e processo, os de "Moedores" trazem material e voltagem; o microlote tem 14 campos de passaporte e nível "especial", o tradicional tem 4 e nível "comercial", o moedor tem zero e a seção não existe para ele.

**Ainda não ligado à tela.** A home continua lendo `mockData.ts` até a unidade 3.

### Próxima unidade

**Unidade 3 — Home real.** Vitrine, categorias, origens e grade de lojas passam a ler do banco pelo `catalogo.ts`. `mockData.ts` sai de cena.
