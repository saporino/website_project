# COFICO — páginas legais para a Meta (Fase 2)

> 13/10/2026. **Nada foi publicado.** O trabalho está commitado localmente e espera aprovação
> do Vlademir para ir ao ar (`git push` = deploy automático na Vercel).

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

## O que mudou no conteúdo

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

## Pendente de revisão jurídica (sinalizado na própria página)

Cada documento tem uma caixa vermelha dizendo o que falta confirmar:

- **Privacidade:** prazos concretos de retenção (§6.6); documentação das salvaguardas de
  transferência internacional (§6.5); designação formal do Encarregado/DPO.
- **Termos:** eleição de foro (§10) e extensão da limitação de responsabilidade (§7).
- **Exclusão:** o prazo de 15 dias (§3) e a lista de retenções obrigatórias (§4), junto com uma
  tabela de retenção por tipo de documento.

Nada foi inventado como fato comercial: os únicos dados afirmados são os que já estavam no
`config.ts` da COFICO (CNPJ, e-mail, telefone), e um teste garante que os três continuam iguais
aos do `config.ts`.

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

## Pendência encontrada (decisão do Vlademir)

**O Google Analytics do site da COFICO é o da Saporino.** O `index.html` carrega
`G-SD6R798HNZ`, que é a propriedade do Café Saporino, e esse script vai junto em todas as
páginas da COFICO. Não é título nem metadado, por isso não entrou na regra 9 — mas é o mesmo
tipo de vazamento de marca: a visita do cliente da COFICO está sendo contada como visita da
Saporino. Criar uma propriedade GA própria da COFICO é decisão dele; não mexi.

## Fase 3 — o que falta para a Meta

Estas páginas atendem ao requisito **de documentação** da Meta. Para a WhatsApp Cloud API
entrar em operação ainda faltam, fora do escopo desta fase: a verificação do negócio no
Business Manager, a URL de callback do webhook, o token de verificação, e a migração do número
comercial `+55 11 93810-0909` do aplicativo para a plataforma — este último é o passo que
**desativa o WhatsApp Business no celular**, e por isso não deve ser feito sem decisão explícita.
