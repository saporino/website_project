# RAIO-X OPERACIONAL — COFFEE LiVRE

> Fonte oficial de arquitetura operacional do Coffee LiVRE.
> Criado em 11/09/2026 a partir da auditoria do estado real do código.
> **A seção 17 é o registro de evolução. Toda unidade entregue é anotada lá, e em nenhum outro arquivo.**

Referência visual: [`coffee-livre-home-laranja.html`](coffee-livre-home-laranja.html), nesta mesma pasta.

---

## 1. O que é o Coffee LiVRE

Marketplace vertical de café. Produtores, torrefações, empacotadores e marcas vendem direto ao consumidor, e a plataforma cuida de vitrine, descoberta e, em fases seguintes, de pagamento e logística.

**Marca independente.** Para o visitante, a protagonista é o Coffee LiVRE. COFICO e RepCo podem ser infraestrutura tecnológica e operacional nos bastidores; não aparecem na interface pública.

**Endereço hoje:** `coficobrasil.com.br/coffeelivre`, atrás de portão privado.
**Endereço futuro:** `coffeelivre.com.br`. Por isso nenhum caminho absoluto da COFICO é escrito à mão no código — tudo sai de `src/pages/coffeelivre/config.ts`.

## 2. Fronteiras com o resto do ecossistema

| Plataforma | Domínio | Relação |
|---|---|---|
| **Coffee LiVRE** | marketplace transacional de café | esta |
| **Coffee Network** | relacionamento e oportunidades B2B entre participantes, com escudo de contato | irmã, sem acoplamento |
| **Saporino** | marca de café própria | pode ser um dos vendedores, nunca a cara da plataforma |
| **COFICO Last Mile** | operação logística | fornecedor potencial de fulfillment |
| **RepCo** | plataforma de vendas B2B e inteligência | camada tecnológica candidata |

**Regra de isolamento:** toda tabela do Coffee LiVRE usa o prefixo `lv_`. Nenhuma tabela existente de Saporino, RepCo ou COFICO é alterada, lida ou reaproveitada. O que se compartilha é infraestrutura (Supabase, Auth, Storage), nunca tabela de domínio.

## 3. Princípios de construção

1. **RLS desde a primeira tabela.** Não existe "ligo depois".
2. **Prefixo `lv_` sem exceção.**
3. **Fidelidade ao visual aprovado.** O HTML de referência manda; o CSS da página é gerado dele por `scripts/escopar-css-coffeelivre.mjs` e escopado em `.livre-root`.
4. **Dado de demonstração é sempre identificável.** Número simulado nunca pode ser confundido com venda real.
5. **Campo vazio não vira informação fictícia.** O Coffee Passport mostra o que existe e cala o resto.
6. **Nada que gere custo ou transação externa nesta fase.**
7. **Caminho e identidade centralizados** em `config.ts`, para a migração de domínio não virar reconstrução.

## 4. Estado do código

```
src/pages/coffeelivre/          página pública
├── config.ts                   caminho base, marca, sessão  ← centralizador
├── CoffeeLivrePage.tsx          raiz
├── AccessGate.tsx               portão da demonstração
├── mockData.ts                  dados de demonstração (a substituir)
├── svg.tsx                      33 ilustrações
├── coffeelivre.css              gerado do HTML oficial
└── 15 componentes de seção

src/components/admin/
├── PlataformasAdmin.tsx         agrupador: Coffee Network | Coffee LiVRE
└── coffeelivre/
    ├── CoffeeLivreAdmin.tsx     casca com as sub-abas
    └── LivreAcesso.tsx          códigos da demonstração

public/coffeelivre/              logo 494×128 · ícone 64×68
docs/marketplace/                HTML de referência · este documento
scripts/                         escopar-css-coffeelivre.mjs · verificar-coffeelivre.mjs
```

**Acoplamento com o resto do sistema:** rota e título em `App.tsx`, tokens `livre-*` no Tailwind, link no rodapé da COFICO, aba do admin. Nada mais.

## 5. Banco

| Tabela | Finalidade | RLS |
|---|---|---|
| `lv_settings` | configuração da plataforma em chave/valor | admin |
| `lv_demo_access` | códigos da demonstração, como hash | admin |

| Função | Finalidade |
|---|---|
| `lv_normalizar_codigo(text)` | sha256 do código sem caixa e sem espaços |
| `lv_validar_acesso(text)` | confere um código sem expor a tabela; `SECURITY DEFINER` |

`pgcrypto` mora no schema `extensions` neste projeto. Toda função que usar `digest` precisa escrever `extensions.digest`, senão falha com "function digest does not exist".

## 6. Acesso da demonstração

Portão de conveniência, **não autenticação de marketplace**. Código guardado como hash, conferido no servidor, sessão de trinta dias no navegador, logout no rodapé. Vários códigos coexistem: dá para entregar um por convidado e desativar o que vazou.

A autenticação real (comprador, vendedor, papéis) é fase posterior.

## 7. Modelo de dados planejado

**Ainda não implementado.** Decisão estrutural em aberto, registrada aqui para não ser tomada por acidente:

- **Produto** é o item que o vendedor cadastra.
- **Oferta** é preço, estoque e condição.
- **Lote** é a origem rastreável que alimenta o Coffee Passport.

Produto canônico compartilhado entre vendedores funciona mal para café: dois lotes do mesmo Catuaí de dois produtores não são o mesmo item, e a diferença entre eles é o que dá valor à plataforma.

## 8. Vendedor

**Ainda não implementado.** Distinção necessária entre produtor, fazenda, cooperativa, torrefação, empacotador, marca e distribuidor. O tipo é atributo do vendedor, não da loja, e é ele que decide o que o Passport pode afirmar.

Vendedor (pessoa jurídica) e loja (vitrine pública) são entidades separadas.

## 9. Coffee Passport

**Ainda não implementado.** É o diferencial defensável da plataforma.

Campos previstos: origem, região, produtor, fazenda, espécie, variedade, processo, torra, moagem, pontuação, notas sensoriais, peso, lote, rastreabilidade.

Níveis previstos: **comercial** (tradicional ou blend), **origem identificada**, **especial ou microlote**. Campo inexistente não gera informação fictícia.

A Saporino já tem metade da fundação em `green_coffee_lots`, `lot_documents` e `batch_photos`. São tabelas de outra plataforma e não serão reaproveitadas, mas o modelo serve de referência.

## 10. Categorias e atributos

**Ainda não implementado.** Atributos previstos: marca, vendedor, preço, origem, estado, região, espécie, torra, moagem, peso, processo, pontuação, notas sensoriais.

## 11. Fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 1 | Fundação, portão, home real, catálogo, Passport, loja, captação de vendedor, admin mínimo, visão | em andamento |
| 2 | Autenticação real, carrinho, checkout, pagamento, split | não iniciada |
| 3 | Fulfillment, logística, NF-e, repasse automático | não iniciada |
| 4 | Assinatura, mídia, inteligência de dados, serviços ao vendedor | não iniciada |

## 12. Fora de escopo na fase 1

Pagamento real, Mercado Pago, OAuth de vendedor, split, cobrança, NF-e, fulfillment, transportadora, emissão fiscal, contratos definitivos, regras tributárias, automações financeiras e qualquer integração externa que gere custo ou transação.

## 13. Decisões pendentes

**Negócio:** comissão, quem é o vendedor legal, se a Saporino vende lá dentro, exclusividade.
**Produto:** produto canônico ou por vendedor, o que é um lote, atributos obrigatórios, níveis do Passport.
**Vendedor:** tipos aceitos, aprovação, o que publica sozinho, plano ou mensalidade.
**Comprador:** pessoa física ou jurídica, cadastro obrigatório, assinatura.
**Financeiro e pagamentos:** quem recebe primeiro, prazo de repasse, retenção, nota fiscal, provedor, split, chargeback.
**Logística:** envio pelo vendedor ou fulfillment, papel da COFICO, frete por item ou por pedido, pedido com dois vendedores.
**Confiança:** avaliações, moderação, disputas, a promessa de "compra garantida" que o mockup já faz.
**Legal:** termos, contrato com vendedor, LGPD.
**Tecnologia:** onde os dados moram, domínio próprio, catálogo e busca.

## 14. Riscos conhecidos

| Risco | Estado |
|---|---|
| "Nespresso" em nome de produto de demonstração | aberto |
| "Loja Saporino" entre as lojas de exemplo | aberto |
| Celular perde a navegação acima de 560 px, sem menu substituto | aberto |
| Promessas comerciais no ar sem ratificação | aberto |
| Portão é conveniência, não segurança | mitigado em parte: código saiu do pacote |
| CSS gerado por script: edição manual é perdida na próxima geração | documentado no topo do arquivo |

## 15. Identidade

Laranja `#DA6418`, cabeçalho `#E97524`, claro `#F3A066`, marrom `#3A2318`, escuro `#24150E`, etiqueta `#EFE3DA`. Tokens registrados no Tailwind com prefixo `livre-`, para uso futuro; a página usa o CSS próprio.

**Nunca misturar** com o vermelho da Saporino ou da COFICO na interface pública. Tom: popular e profissional, brasileiro, acessível, moderno, comercialmente forte. Evitar luxo excessivo, cafeteria boutique, SaaS corporativo e aparência de template.

## 16. Verificação

`node scripts/verificar-coffeelivre.mjs` compara o porte com o HTML oficial: classes, textos, contagens, SVGs e as declarações de CSS. Deve terminar em "SEM DIFERENCAS a justificar".

---

## 17. Registro de evolução

### Unidade 0 — Porte da home (10/09/2026)

Home oficial portada para React com fidelidade verificada. Rota `/coffeelivre`, portão por variável de ambiente, CSS escopado, 33 SVGs convertidos, dados em `mockData.ts`. Verificador sem diferenças.

### Unidade 1 — Fundação e portão (11/09/2026)

**Migration:** `20260911100000_fundacao_coffee_livre.sql`. Primeiras tabelas `lv_`, ambas com RLS admin-only desde o nascimento.

**O que mudou:** o código de acesso saiu do pacote JavaScript. Antes vinha de `VITE_COFFEELIVRE_CODE` e era comparado no navegador, legível por qualquer visitante e impossível de trocar sem deploy. Agora vive no banco como hash e é conferido por `lv_validar_acesso`, que devolve apenas verdadeiro ou falso.

**Também nesta unidade:** logout no rodapé; `config.ts` centralizando caminho base, marca e assets para a migração de domínio; admin de acesso com criação, desativação e contagem de uso; agrupador **Plataformas** no admin, reunindo Coffee Network e Coffee LiVRE sem somar aba nova à barra.

**Verificado:** código certo com espaço e caixa trocada entra; errado e vazio não; `anon` não lê `lv_demo_access` nem `lv_settings`; logout limpa a sessão e volta ao portão; sem rolagem horizontal em 375 px; campo do portão com fonte de 16 px, que evita o zoom automático do iOS; `TROCAR_ESTE_CODIGO` não aparece em lugar nenhum do `dist`.

**Não verificado:** o admin não foi conferido na tela, porque o navegador de teste não está autenticado como administrador.

**Pendente desta unidade:** trocar o código inicial por um de verdade, pelo admin.

### Próxima unidade

**Unidade 2 — Catálogo.** Tabelas de vendedor, loja, categoria, produto e atributos, com RLS e seeds de demonstração identificados. É a fundação de que a home, a busca, o produto e a loja dependem.
