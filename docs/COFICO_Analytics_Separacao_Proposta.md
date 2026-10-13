# Separar o Analytics da COFICO do da Saporino — proposta

> 13/10/2026. **Proposta, não execução.** Nada foi criado no Google e o rastreamento atual
> está intacto, conforme sua instrução.

## A pendência, em uma frase

Toda página servida por este projeto — inclusive `coficobrasil.com.br` inteiro — carrega o
mesmo `index.html`, e esse arquivo traz o Google Analytics **`G-SD6R798HNZ`, que é a propriedade
do Café Saporino**. A visita de um cliente da COFICO entra no relatório da Saporino.

```html
<!-- index.html, linhas 26-32 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SD6R798HNZ"></script>
```

## Por que isso incomoda além da estética

1. **Número errado nos dois lados.** O tráfego da Saporino está inflado pelas visitas da COFICO,
   e a COFICO não tem nenhum número próprio. Qualquer decisão tomada sobre "quantas visitas o
   site teve" está medindo duas empresas somadas.
2. **São empresas diferentes.** Café Saporino Ltda (61.109.694/0001-94) e V. Medeiros de Santi
   Ltda (66.006.929/0001-36). Os dados de navegação do cliente de uma estão sendo tratados na
   conta da outra — e a política de privacidade da COFICO que acabamos de publicar diz que a
   controladora é a V. Medeiros de Santi.
3. **Vai piorar.** O mesmo `index.html` serve Coffee LiVRE e, no futuro, cada marca nova. Hoje é
   um vazamento; com mais marcas vira bagunça permanente.

## O que eu proponho (quando você autorizar)

**Uma propriedade GA4 por marca**, escolhida em tempo de execução pelo domínio — exatamente como
já fazemos com favicon, robots, sitemap e og:image.

### Passo 1 — você cria (ou me autoriza a pedir) a propriedade
No Google Analytics, uma propriedade GA4 nova chamada **COFICO Brasil**, com o fluxo de dados
apontando para `www.coficobrasil.com.br`. Sai um ID no formato `G-XXXXXXXXXX`. **É a única etapa
que depende de conta Google — eu não crio nada sem sua ordem.**

### Passo 2 — eu ligo no código
O ID entra como variável de ambiente (`VITE_GA_COFICO`), nunca escrito no arquivo, e o `index.html`
passa a escolher qual carregar pelo domínio:

```js
// pseudo: o host decide a propriedade, antes de carregar o gtag
var marca = /(^|\.)coficobrasil\.com\.br$/.test(location.hostname) ? COFICO : SAPORINO;
```

Custo: zero. GA4 é gratuito nesta escala e não há serviço pago envolvido.

### Passo 3 — eu provo que separou
Uma bancada igual à das páginas legais: busca o HTML de cada domínio e confere que
`coficobrasil.com.br` **não** carrega `G-SD6R798HNZ`, e que `cafesaporino.com.br` **não** carrega
o ID da COFICO. Vira teste permanente, não verificação de uma vez só.

## Duas decisões que são suas

- **O histórico fica onde está.** Os dados já coletados continuam na propriedade da Saporino,
  misturados. Não dá para separar retroativamente. A alternativa é marcar a data da virada e
  tratar o que veio antes como "medição conjunta".
- **Consentimento.** O aviso de cookies da COFICO já existe e é separado do da Saporino, mas
  hoje o GA carrega **antes** de qualquer aceite, nos dois sites. Isso é um assunto próprio
  (Consent Mode), maior que esta separação, e merece decisão à parte — me diga se quer que eu
  levante isso.

## Enquanto você não decide

Nada muda. O rastreamento continua como está e a pendência fica registrada aqui, em
`docs/COFICO_Paginas_Legais_Meta.md` e na memória do projeto.
