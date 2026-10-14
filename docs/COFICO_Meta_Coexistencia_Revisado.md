# Coexistência e App Review — recomendação revisada, com a documentação na mão

> 14/10/2026. Nada submetido, nenhum número registrado ou migrado, nenhum termo aceito,
> nenhum BSP contratado, produção e Saporino intocadas.

**Este documento corrige a recomendação que eu dei ontem.** Eu afirmei duas coisas de
memória, e você cobrou evidência. Fui à documentação da Meta e **uma delas estava errada de
um jeito que teria custado caro.**

---

## O que eu errei

### Erro 1 — recomendei tirar `whatsapp_business_management`. Isso bloquearia a Coexistência.

A documentação de **Tech Provider** lista, para o App Review:

> **Advanced access to `whatsapp_business_management`:** Needed to access clients' WABAs.

E a de **onboarding de usuários do WhatsApp Business app** — que é o nome oficial da
Coexistência — exige, como primeiro requisito:

> **"You must already be a Solution Partner or Tech Provider."**

Ou seja: **o caminho documentado para a Coexistência passa por ser Tech Provider, e Tech
Provider exige App Review das DUAS permissões.** Tirar `whatsapp_business_management` da
submissão fecharia a porta que você quer abrir.

**Sua decisão 1 estava certa e a minha recomendação estava errada.** Mantenha a permissão.

### Erro 2 — eu disse que Embedded Signup "serve só para outras empresas"

Parcialmente certo, pelo motivo errado. O correto, pela documentação:

- Embedded Signup é mesmo **construído para parceiros**: a página inteira fala em "your
  business customers", e a lista de requisitos é dirigida a quem constrói a integração.
- **Mas é o único mecanismo documentado de Coexistência.** Não existe, na documentação, um
  caminho de autoatendimento para uma empresa ligar o próprio número em coexistência pelo
  painel. A página de onboarding **não descreve** esse caminho — e eu não vou afirmar que ele
  não existe, porque a documentação simplesmente não trata disso.

**A consequência prática:** para a COFICO ligar o **próprio** número em coexistência, o
caminho documentado é a COFICO **ser o Tech Provider** e onboardar a si mesma pelo fluxo.
Não é contorno: é como a Meta modelou.

**Então "Tech Provider" não é outro projeto, como eu disse. É o caminho da Coexistência.**

---

## O que isso muda no plano

| | Antes (meu erro) | Agora |
|---|---|---|
| `whatsapp_business_management` | tirar | **manter — é obrigatória** |
| Tech Provider | "outro projeto, depois" | **pré-requisito da Coexistência** |
| Embedded Signup | "não precisa" | **precisa, é o mecanismo** |
| Vídeo de modelos | problema sem solução honesta | **resolvido — ver abaixo** |

---

## O vídeo de modelos: resolvido pela própria Meta

A documentação de Tech Provider diz, sobre os dois vídeos exigidos:

> "One shows a message sent from your app and received in WhatsApp. The other shows your app
> creating a message template. **Screen recordings of the API Setup cURL script or WhatsApp
> Manager can substitute for these.**"

**A Meta aceita explicitamente a gravação do WhatsApp Manager no lugar de uma tela própria.**

Isso resolve o impasse sem construir nada artificial: o vídeo B é a criação de um modelo
**no WhatsApp Manager**, e isso é exatamente o que a COFICO vai fazer na vida real. Sua
decisão 2 — não construir um gerenciador só para passar na revisão — está preservada, e
agora com respaldo documental.

---

## Operações reais que justificam `whatsapp_business_management` (item 3)

Não é teoria: o RepCo **já depende** dessa permissão hoje.

| Operação | Onde | Estado |
|---|---|---|
| **Inscrever o app na WABA** (`subscribed_apps`) | foi o que fez a mensagem real chegar | **já usada** — o Claude MCP fez isso |
| Ler o número para confirmar a coexistência (`is_on_biz_app`, `platform_type`) | confirmar que o celular continua funcionando | necessária na ativação |
| Consultar modelos aprovados | saber o que o atendente pode usar com a janela fechada | proposta abaixo |

O primeiro item sozinho já é uso legítimo: **sem `whatsapp_business_management` o webhook não
teria sido inscrito, e nenhuma mensagem teria chegado.** Isso aconteceu de verdade, ontem.

---

## Proposta: painel de modelos, só leitura (item 4 — não implementado)

**Útil?** Sim, e por um motivo concreto: quando a janela de 24 h fecha, o atendente hoje vê
"só modelo aprovado" e **não tem como saber quais existem**. Ele teria que abrir o painel da
Meta no meio do atendimento.

**O que seria:** uma seção em RepCo › WhatsApp listando os modelos da WABA — nome, categoria,
idioma e **status de aprovação** — e a qualidade do número. Duas chamadas de leitura à Graph
API, numa função de borda, token no servidor, acesso pelo mesmo papel da central.

**O que NÃO seria:** criar, editar ou apagar modelo. Isso continua no WhatsApp Manager, que
já faz bem.

**Suficiente para a revisão?** Pela documentação, **nem é necessário** — a gravação do
WhatsApp Manager basta. Então a decisão é operacional, não de revisão: vale construir porque
ajuda quem atende, ou não vale agora.

**Não implementei.** Aguardo sua palavra.

---

## O que a Coexistência exige de verdade (item 10)

### Obrigatório

| Requisito | Situação |
|---|---|
| Ser **Solution Partner ou Tech Provider** | ❌ falta — depende da verificação em análise |
| **Verificação do negócio** aprovada | ⏳ em análise (segunda tentativa) |
| **App Review** das duas permissões | ❌ falta |
| **Embedded Signup com session logging** | ❌ não implementado |
| Webhook que recebe e processa de forma confiável | ✅ **pronto e provado** |
| Saber usar a Cloud API | ✅ |
| **Certificado SSL válido** no servidor do Embedded Signup | ⚠️ depende do domínio — ver abaixo |
| WhatsApp Business app **2.24.17 ou superior** no celular | ⚠️ **confira no seu aparelho** |
| `extras.featureType = whatsapp_business_app_onboarding` no fluxo | ❌ a implementar |

> Atenção: o valor antigo `"coexistence"` **não vale mais**. Quem seguir tutorial velho erra
> aqui.

### Opcional

- Linha de crédito — **só para Solution Partner**. Tech Provider exige que o cliente ponha o
  próprio meio de pagamento; no caso, vocês mesmos.
- Sincronizar histórico (até 180 dias) — só se a empresa aprovar o compartilhamento.

### O que você perde ao ligar a Coexistência — leia antes de decidir

A documentação é explícita, e isso afeta o seu dia a dia:

- **Todos os aparelhos conectados são desvinculados** no momento do onboarding. WhatsApp Web
  e dispositivos vinculados caem e precisam ser reconectados.
- **Conversas em grupo não sincronizam** com a Cloud API.
- **Desativados ou sem suporte em 1:1:** mensagens temporárias, ver uma vez, localização ao
  vivo, listas de transmissão.
- **Sem suporte na Cloud API:** chamadas de voz e vídeo, ferramentas comerciais, canais.
- **Throughput fixo de 20 mensagens por segundo** — irrelevante para atendimento, mas é o teto.
- **Preço:** o que sai do aplicativo continua grátis; o que sai pela Cloud API é cobrado.
- **A janela de 24 h vale só para a Cloud API.** Mensagem mandada do celular não cria nem
  estende a janela da API.
- **Para sair:** não se usa a API de desregistro — tem que desconectar pelas configurações do
  aplicativo.

Nada disso impede, mas **lista de transmissão e chamadas** são coisas que você talvez use.

---

## Domínio — correção preparada (item 8)

Implementei e testei, **sem tocar em DNS nem em produção**:

- `repco.coficobrasil.com.br` passa a ser reconhecido como **o portal**, não a vitrine.
- Continua sendo domínio da COFICO para marca: favicon, título e páginas legais.
- Qualquer outro subdomínio (`loja.`, `www.`) segue indo para o site institucional.

**36 testes** na suíte de domínio, incluindo o caso que teria quebrado: hoje, sem essa
correção, `repco.coficobrasil.com.br` mostraria a **página institucional da COFICO** em vez
do portal.

Falta, quando você decidir: um `CNAME repco → cname.vercel-dns.com`, o domínio na Vercel
(HTTPS automático) e uma regra no `vercel.json`. **O SSL válido que o Embedded Signup exige
vem junto, de graça** — mais um motivo para esse domínio.

---

## Declarações no App Review que não batem (item 9)

| Declaração cadastrada | Realidade | O que fazer |
|---|---|---|
| "o RepCo **cria** modelos de mensagem" | não existe | **remover** |
| "o RepCo **gerencia** modelos" | não existe | **remover** |
| "o RepCo administra templates" | não existe | **remover** |

**Substituir por** (verdadeiro hoje):

> O aplicativo usa `whatsapp_business_management` para inscrever o webhook na conta do
> WhatsApp Business da empresa, consultar o número conectado e **acompanhar** os modelos de
> utilidade aprovados, que a equipe usa para avisar o cliente sobre o pedido dele. A criação
> e a edição dos modelos são feitas no WhatsApp Manager da Meta.

Se o painel de consulta for construído, a frase "acompanhar os modelos" passa a ser
demonstrável também dentro do RepCo.

---

## Ordem recomendada

```
1. verificação do negócio aprovada           ← em análise, trava tudo
2. gravar o token de envio                   ← você
3. primeiro envio real autorizado            ← você
4. vídeo A (RepCo enviando e recebendo)
5. vídeo B (modelo no WhatsApp Manager)      ← aceito pela Meta
6. corrigir as declarações do App Review
7. submeter App Review das DUAS permissões
8. aprovado → status de Tech Provider
9. domínio repco.coficobrasil.com.br + SSL
10. Embedded Signup com featureType = whatsapp_business_app_onboarding
11. Coexistência do +55 11 93810-0909
```

Os passos 2 a 7 podem ser feitos **agora**, enquanto a verificação corre. O 8 em diante
depende da Meta.

---

## Fontes

- [Onboard WhatsApp Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/)
- [Embedded Signup — Overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [Get started as a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)
- [WhatsApp changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)

> Parte dessas páginas tem mais de um ano. Antes de implementar o Embedded Signup, confirmar
> os valores atuais no painel — foi assim que o `featureType` mudou sem aviso.
