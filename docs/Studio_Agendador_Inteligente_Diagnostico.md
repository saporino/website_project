# Agendador inteligente de conteúdo — diagnóstico e proposta

> 17/10/2026. **Nenhuma linha de código alterada.** Auditoria do que existe e proposta
> para discussão, como você pediu.

---

## 1. A notícia boa: a parte difícil já funciona

Eu esperava ter que construir a leitura da arte. **Já está pronta e rodando em produção.**

Exemplo real, tirado do seu banco agora:

```
Arquivo:  Café, Sorrisos e Sabor Saporino.png
Texto lido da arte:  "SAPORINO | Quem prova, sorri. | SAPORINO (na xícara)"
Copywriting:  "Headline curta, rítmica e em duas partes com quebra de linha
               (afirmação + consequência): 'Quem prova,' / 'sorri.'"
```

E em outra peça, onde não havia texto, a IA disse isso com todas as letras:

```
"Não há texto na peça além do logo na xícara (SAPORINO).
 A comunicação é 100% visual/emocional."
```

Isso é exatamente o insumo que o agendador precisa. **O sistema já lê suas artes** — só não usa essa leitura para decidir quando postar.

---

## 2. O que existe hoje

| Peça | Onde | Estado |
|---|---|---|
| **Upload e armazenamento** | `studio_videos` + Storage | ✅ 49 mídias |
| **Biblioteca de mídia** | aba Vídeos, com filtros e miniatura | ✅ |
| **Análise de IA** | `studio_analyses` — 30 campos | ✅ **lê o texto da arte** |
| **Agendamento manual** | `studio_campaigns.scheduled_at` | ✅ |
| **Robô que publica** | `publish-scheduled`, a cada 5 min pelo `pg_cron` | ✅ **43 das 45 publicações passaram por ele** |
| **Instagram** | `publish-instagram` | ✅ 3 contas conectadas |
| **TikTok** | `publish-tiktok` | ⚠️ rascunho |
| **Histórico e erro** | `status`, `published_at`, `publish_error`, `platform_post_id` | ✅ |
| **Meta diária por marca** | `meta_posts_dia` (3 para todas) + tela `MetaDiaria` | ✅ |
| **Impressão digital de conteúdo** | `studio_content_fingerprints` | ⚠️ existe, mas só 6 linhas e **só para imagens geradas**, não para as artes que você envia |

**O robô não é teoria:** 43 das 45 publicações tinham `scheduled_at` preenchido. O caminho
automático está provado com carga real.

### E há uma fila parada

**6 mídias já analisadas e sem campanha nenhuma.** São artes prontas, com a IA já tendo
lido o que elas dizem, esperando alguém decidir o dia. É exatamente a dor que você
descreveu.

---

## 3. O que falta — e é menos do que parece

### 3.1 A análise não guarda o que o agendador precisaria perguntar

A IA lê *"Comece sua terça-feira"*, entende, escreve no resumo — e depois o texto fica
preso num parágrafo. Ninguém consegue perguntar **"me dê as artes de terça-feira"**.

Falta um punhado de campos estruturados:

| Campo | Para quê | Exemplo |
|---|---|---|
| `dia_da_semana` | trava de dia | `terca` |
| `periodo` | trava de horário | `manha` |
| `temporalidade` | se pode rodar qualquer dia | `perene` · `dia_fixo` · `sazonal` |
| `tema` | evitar dois iguais seguidos | `bom_dia` · `produto` · `receita` |
| `data_comemorativa` | Dia do Café, Natal… | `2026-05-24` |
| `confianca` | quando a IA ficou em dúvida | `0.0 a 1.0` |

Esses campos saem da **mesma chamada de IA que já acontece**. Não é uma análise nova, é
pedir mais seis coisas na que já roda. **Custo adicional perto de zero.**

### 3.2 Não há regras editoriais configuráveis

Hoje `meta_posts_dia = 3` para todas as marcas, e nada diz **em que horários**. Falta uma
tabela simples: por marca, quais janelas (ex.: 08h, 12h, 19h), quais dias, quais horários
bloqueados.

### 3.3 Não há motor de decisão

É a peça central que não existe: dado um conjunto de artes analisadas e um calendário,
escolher qual arte vai em qual horário.

### 3.4 Não há dados de desempenho

Você pediu que o sistema aprendesse com o que funciona. **Hoje não temos esse dado** — a
API do Instagram devolve curtidas e alcance, mas nunca ligamos essa leitura.

Isso é a fase 2 de verdade: sem histórico, qualquer "melhor horário" seria invenção.

---

## 4. Como eu faria a análise inteligente

**Não criar uma segunda IA.** A análise que já roda ganha um pedaço a mais no pedido,
devolvendo um bloco estruturado junto do que já devolve:

```
agendamento: {
  dia_da_semana:   "terca" | null,
  periodo:         "manha" | "tarde" | "noite" | null,
  temporalidade:   "perene" | "dia_fixo" | "sazonal" | "campanha",
  tema:            "bom_dia",
  data_especifica: null,
  confianca:       0.95,
  justificativa:   "A arte diz 'Comece sua terça-feira'."
}
```

A `justificativa` é o que te deixa conferir se a IA entendeu certo, em vez de confiar no
escuro.

**A regra de ouro:** quando a IA não tiver certeza (`confianca` baixa, ou texto ambíguo),
ela **não chuta** — marca para revisão. Seu item 10, e eu concordo: errar o dia de uma
peça é pior do que te perguntar.

---

## 5. Como escolher dia, hora e imagem

O motor roda em três filtros, nessa ordem:

**1. Elimina o impossível** *(trava rígida)*
- Arte de terça só entra em terça
- Arte de "bom dia" só entra em janela da manhã
- Arte sazonal fora da época sai da lista

**2. Elimina o repetido** *(trava de contexto)*
- Já tem "bom dia" publicado nessa marca hoje → essa arte não entra hoje
- Mesmo tema nos últimos N dias → desce na fila
- Arte já publicada antes → fora, a menos que você libere reuso

**3. Ordena o que sobrou** *(preferência)*
- Arte mais antiga na fila primeiro (não deixa nada encalhar)
- Diversidade de tema ao longo da semana
- *(fase 2)* desempenho histórico daquele horário

Se depois dos três filtros **nenhuma arte servir para um horário**, o sistema deixa o
horário **vazio** e avisa — em vez de enfiar qualquer coisa. Postar errado é pior que
não postar.

---

## 6. Como não estragar o que já funciona

Essa é a parte que mais me preocupa, porque há 45 publicações reais no histórico.

- **Nada do que já está agendado é tocado.** O motor só cria agendamento novo, nunca
  mexe em `scheduled_at` existente.
- **O robô de publicação não muda.** Ele continua lendo `studio_campaigns` como hoje.
  O agendador escreve na mesma tabela, do mesmo jeito que você escreve à mão.
- **Nada publica sozinho sem você ligar.** A sugestão nasce como **proposta**; você
  aprova. Só quando você disser "pode ir no automático" é que vira agendamento direto.
- **Botão de pânico:** uma chave por marca que desliga o automático e devolve tudo ao
  manual, sem perder nada.

---

## 7. Como testar antes de ligar

Na ordem, e cada uma só começa quando a anterior passa:

1. **Análise às cegas** — rodar os campos novos nas **49 mídias que já existem**, sem
   agendar nada. Você olha a lista e diz: a IA acertou o dia e o período? É o teste mais
   barato que existe, e usa material real seu.
2. **Calendário fantasma** — o motor monta a semana inteira, mostra na tela, e **não
   grava nada**. Você compara com o que faria à mão.
3. **Uma marca só, uma semana** — liga de verdade para a Saporino, com aprovação manual
   de cada post.
4. **Automático com rede** — as outras marcas, com a chave de desligar à mão.

---

## 8. Proposta em etapas

| Etapa | O que entrega | Risco |
|---|---|---|
| **1** | Campos de agendamento na análise + reprocessar as 49 mídias | baixo — só lê |
| **2** | Tela da fila: "artes prontas, sem data" com o que a IA entendeu | baixo |
| **3** | Regras editoriais por marca (janelas, dias, bloqueios) | baixo |
| **4** | Motor de sugestão + calendário fantasma | médio |
| **5** | Aprovar com um clique → vira agendamento | médio |
| **6** | Automático por marca, com chave de desligar | alto |
| **7** | *(depois)* desempenho real alimentando a escolha de horário | — |

As etapas 1 e 2 **já resolveriam boa parte da sua dor**: você veria as 6 artes paradas,
com "esta é de terça, esta é de manhã, esta pode qualquer dia" — e agendaria em minutos,
sem deduzir.

---

## 9. O que eu preciso que você decida

**a) Até onde vai o automático?** Minha recomendação: parar na etapa 5 (sugere, você
aprova com um clique). O passo 6 economiza seu clique e, em troca, um erro vai ao ar sem
ninguém ver. Com uma conta de cliente no sistema, isso pesa mais.

**b) Quais são as janelas de horário?** Hoje são 3 posts/dia sem horário definido. Quais
horários você considera bons? Posso começar com 08h / 12h / 19h e você ajusta.

**c) Arte já publicada pode repetir?** Depois de quanto tempo?

**d) Quais temas você quer que o sistema reconheça?** Eu começaria com: bom dia, boa
tarde, boa noite, dia da semana, produto, receita, promoção, data comemorativa,
institucional. Falta algum que você usa?

**e) Vale ligar a leitura de desempenho do Instagram?** É o que permitiria o sistema
aprender de verdade. Dá trabalho e não é urgente — mas sem isso, "melhor horário" continua
sendo regra fixa, não inteligência.

---

## 10. Uma ressalva honesta

Você pediu que o sistema escolha "a melhor foto" para cada horário. Com as regras acima,
ele escolhe **a mais adequada** — a que respeita dia, período, tema e não repete.

**"Melhor" de verdade só depois da etapa 7**, quando houver dado de desempenho. Antes
disso, qualquer sistema que afirme saber qual arte rende mais está adivinhando com
confiança — e eu prefiro te dizer isso agora do que te entregar um número inventado.
