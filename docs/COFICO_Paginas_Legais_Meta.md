# COFICO — páginas legais para a Meta (Fase 2)

> 13/10/2026. A **primeira versão está no ar**; a **versão definitiva descrita abaixo está
> commitada e aguardando aprovação** para publicar.
> Commits: `a3bdcbb` (páginas) · `87d5f24` (rota do Vercel) · `304f2d2` (título da aba) ·
> versão definitiva (texto duradouro, sem avisos provisórios).

## As três URLs

| URL (domínio da COFICO) | Também responde em | Arquivo estático gerado |
|---|---|---|
| `https://www.coficobrasil.com.br/privacidade` | `/coficobrasil/privacidade` | `dist/cofico-privacidade.html` |
| `https://www.coficobrasil.com.br/termos` | `/coficobrasil/termos` | `dist/cofico-termos.html` |
| `https://www.coficobrasil.com.br/exclusao-de-dados` | `/coficobrasil/exclusao-de-dados` | `dist/cofico-exclusao-de-dados.html` |

O segundo caminho existe por dois motivos: é como a página é servida enquanto o site da COFICO
roda **sob** o domínio da Saporino, e é como se testa em `localhost`.

## Legível sem JavaScript — como

O crawler da Meta não executa JavaScript. Um site React entrega `<div id="root"></div>` vazio,
e a política seria lida como página em branco.

A solução: o texto mora em **`src/pages/coficobrasil/legal.json`** (fonte única) e é renderizado
**duas vezes**:

1. **No build** (`scripts/prerender-seo.mjs` + `scripts/legal-render.mjs`) — o HTML do texto é
   escrito **dentro** do `<div id="root">` de cada arquivo. O crawler lê o HTML cru.
2. **No navegador** — o React monta e substitui aquele conteúdo pelo dele. Como usa
   `createRoot().render()` (não `hydrateRoot`), não há erro de hidratação; e como as classes
   Tailwind são as mesmas, não pisca.

Medido no build: **11.784 bytes** de texto estático na privacidade, 6.330 nos termos, 6.029 na
exclusão de dados.

Há duas cópias do renderizador de marcação (uma em `.ts` para o React, uma em `.mjs` para o
build). O teste `src/lib/legalCofico.test.ts` compara as duas **texto por texto**: se alguém
mexer numa e esquecer a outra, o teste quebra. Era isso ou a Meta ler uma política diferente
da que o cliente vê.

## Versão definitiva — por que o texto foi refeito

A primeira versão descrevia o WhatsApp como algo "em preparação", numa caixa de aviso. Isso
obrigaria a reescrever a política no dia em que a integração fosse ligada — e uma política que
se sabe provisória não serve para análise da Meta.

A versão definitiva é escrita por **modalidade de tratamento**: cada seção diz *quando* aquele
tratamento ocorre, *quais* dados envolve e *com que base legal*. O texto declara explicitamente
que descrever uma modalidade **não é declarar que ela está em funcionamento** — assim ele vale
antes e depois da ativação, sem alteração. Três testes guardam isso: um proíbe afirmar que a
integração já opera, outro proíbe qualquer aviso provisório, e o terceiro exige a frase que
separa descrição de declaração de funcionamento.

O tipo de bloco `aviso` foi **removido do código** (componente, renderizador do build e tipos).
Um teste reprova qualquer bloco com chave fora de `h2`/`p`/`ul`, para a tarja não voltar pelo JSON.

### Alcance

A política deixou de ser "do site" e passou a cobrir **a operação da COFICO**: clientes e seus
contatos, fornecedores, representantes e promotores, destinatários de entrega e candidatos; o
cadastro, o pedido, o faturamento, a armazenagem, o transporte e a comprovação de entrega; os
sistemas internos de gestão; e o atendimento por qualquer canal. Passou de 11 para **18 seções**
e de 11.784 para **22.297 bytes** de texto estático.

Entraram, entre outras: o papel de **operadora** quando a COFICO trata dados por conta de uma
marca contratante (§3); **geolocalização** de representantes e promotores durante a jornada e
**comprovação fotográfica** de entrega (§9); **registro de quem fez o quê** nas operações
sensíveis do fluxo comercial (§8.3); **atendimento automatizado** e o direito de revisão por
pessoa natural do Art. 20 (§14); crianças e adolescentes (§16).

## O que mudou no conteúdo (primeira versão)

**Reaproveitado integralmente** o texto já existente de Privacidade e Termos (regra 4). O que
entrou de novo:

- **Privacidade §6 — Atendimento comercial por WhatsApp.** Abre com uma caixa destacada dizendo
  que hoje o atendimento é pelo **aplicativo WhatsApp Business**, operado à mão, e que a
  integração com a **Cloud API está em preparação e ainda não está em operação** (regra 6).
  Depois: o que é, quais dados (nome, telefone, conteúdo das mensagens, metadados), para quê,
  bases legais, o papel da Meta e a transferência internacional, retenção, e como sair/apagar.
- **Termos §5 — Atendimento por WhatsApp.** Mensagem não é oferta vinculante; não substitui a
  formalização do pedido.
- **Exclusão de dados** — página nova: por onde pedir (e-mail `sac@coficobrasil.com.br` e
  WhatsApp `(11) 93810-0909`), o que informar, prazo de resposta, o que a lei permite reter, e
  o aviso de que a cópia que fica **no aparelho do cliente** e nos servidores da Meta não está
  sob guarda da COFICO.

## Pendente de revisão jurídica (fora da página)
Na versão definitiva, a política **não carrega tarja de pendência** — uma política pública com
aviso "em revisão" não passa confiança, e a Meta lê a página como ela está. Os pontos que
dependem do jurídico ficam no campo `revisaoJuridica` de cada documento em `legal.json`, **não
são renderizados**, e um teste reprova o documento que ficar sem nenhum.

**Política de Privacidade** (`/privacidade`)
- Prazos concretos de retenção por tipo de documento (§13) — montar tabela de retenção com o contador e o jurídico.
- Documentação das salvaguardas de transferência internacional (§12), incluindo os provedores efetivamente contratados.
- Designação formal do Encarregado/DPO e publicação do nome, se a empresa optar por nomear pessoa identificada (§15).
- Confirmar as bases legais escolhidas para a geolocalização de representantes e promotores durante a jornada (§9).
- Confirmar o enquadramento do compartilhamento com marcas representadas: operador, controlador ou controladoria conjunta (§11).

**Termos de Uso** (`/termos`)
- Eleição de foro (§11) e extensão da limitação de responsabilidade (§9) — confirmar com o jurídico.
- Verificar se as áreas restritas (§6) exigem termo de uso próprio, assinado no acesso, além destes Termos.

**Como pedir a exclusão dos seus dados** (`/exclusao-de-dados`)
- Prazo de resposta anunciado (§4) — confirmar o compromisso que a empresa quer assumir publicamente.
- Lista de retenções obrigatórias (§5) — amarrar à tabela de retenção por tipo de documento, com o contador.
- Procedimento de verificação de identidade (§3) — definir quando exigir documento, para não criar coleta excessiva.

Para listar a qualquer momento: `node scripts/auditoria-paginas-legais.mjs` imprime os pontos
no fim do relatório.

## Verificação

```bash
npm run build && node scripts/auditoria-paginas-legais.mjs
```

A bancada lê o HTML **cru** do `dist/`, sem navegador e sem JavaScript — igual ao crawler da
Meta — e confere 55 pontos: texto presente até o último bloco, H1, data, título/canonical/
og:site_name/favicon da COFICO, ausência de qualquer "Saporino" ou do CNPJ dela, links legais
relativos, o roteamento do `vercel.json` (e que a rota de raiz **só** vale no domínio da COFICO)
e o sitemap. **55 ok, 0 falhas.**

Além disso: `src/lib/legalCofico.test.ts` — **23 testes**. Suíte completa: **459 testes**
(eram 436). `typecheck` e `build` OK.

Na tela (dev server): `/coficobrasil/privacidade` e `/coficobrasil/exclusao-de-dados` abrem com
o título da COFICO; o hash antigo `/coficobrasil#privacidade` **continua funcionando** (regra 7);
`localhost/privacidade` continua caindo em "Página não encontrada", como antes — o site da
Saporino não mudou.

## O que NÃO foi feito, de propósito

- **Não publicado.** Espera aprovação.
- **Saporino e RepCo intocados.** A única mudança fora da pasta `coficobrasil/` é a rota nova em
  `src/App.tsx`, que só responde no domínio da COFICO ou sob `/coficobrasil/`, e
  `resolveJsonModule` no `tsconfig.app.json`.
- **Logos e identidade visual intocados.**

## Dois defeitos que só apareceram DEPOIS de publicar

Ambos passaram por `typecheck`, `build`, 459 testes e pela bancada local. Ficam registrados
porque a bancada agora cobre os dois.

**1. `/privacidade` servia o site da Saporino no domínio da COFICO.** No `vercel.json`, quando
uma rota usa `has` (condição de domínio), os grupos de captura do HOST entram na **mesma
numeração** dos grupos do `src`. O `(www\.)?` capturante roubava o `$1`: o destino virava
`/cofico-www..html`, que não existe, e a rota seguia para o catchall. Grupo não-capturante
`(?:www\.)?` resolve. A bancada agora reprova **qualquer** rota que use `$n` no destino com
grupo capturante no host — a classe inteira, não só este caso.

**2. A aba virava "Café Saporino" assim que o React montava.** O efeito de título do `App.tsx`
só saía fora quando o caminho começava com `/coficobrasil`; as páginas legais moram na **raiz**
do domínio da COFICO. O HTML estático abria certo e era sobrescrito um instante depois — a Meta
abriria a política da COFICO com o nome da Saporino na aba. Corrigido usando a mesma função de
rota (`rotaLegalCofico`), e a rota direta passou a mostrar o aviso de cookies **da COFICO**.

Lição das duas: verificação local em `dist/` não substitui verificação **na URL publicada**.

## Verificado em produção

`scripts/` + bancada contra as URLs reais, com `user-agent` de crawler da Meta e **sem
executar JavaScript**: as três respondem 200 com 7.472 / 3.604 / 3.173 caracteres de texto
legível, título/canonical/favicon da COFICO, CNPJ da COFICO presente e **nenhum nome, CNPJ,
logo ou og:image da Saporino**. `/coficobrasil/<slug>` idem. No navegador: o hash antigo
`#privacidade` continua funcionando, e `cafesaporino.com.br/politica-privacidade` segue no ar
sem mudança.

## Pendência encontrada (decisão do Vlademir)

**O Google Analytics do site da COFICO é o da Saporino.** O `index.html` carrega
`G-SD6R798HNZ`, que é a propriedade do Café Saporino, e esse script vai junto em todas as
páginas da COFICO. Não é título nem metadado, por isso não entrou na regra 9 — mas é o mesmo
tipo de vazamento de marca: a visita do cliente da COFICO está sendo contada como visita da
Saporino. Criar uma propriedade GA própria da COFICO é decisão dele; não mexi. Proposta completa em
[`COFICO_Analytics_Separacao_Proposta.md`](COFICO_Analytics_Separacao_Proposta.md).

## Fase 3 — o que falta para a Meta

Estas páginas atendem ao requisito **de documentação** da Meta. Para a WhatsApp Cloud API
entrar em operação ainda faltam, fora do escopo desta fase: a verificação do negócio no
Business Manager, a URL de callback do webhook e o token de verificação.

**O número +55 11 93810-0909 NÃO deve ser migrado.** Decisão do Vlademir (13/10/2026): o
objetivo é a modalidade oficial de **Coexistência**, se a Meta aprovar, que preserva o WhatsApp
Business funcionando no celular. A migração comum desativa o aplicativo no aparelho — é
justamente o que não se quer. Nenhuma conexão foi feita nesta etapa.
