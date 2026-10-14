# App Review da Meta — COFICO RepCo

> 14/10/2026. **Nada foi submetido à Meta.** Nenhum envio real, nenhum modelo criado, nenhum
> número registrado, aplicativo não publicado. O +55 11 93810-0909 segue intocado.

App `2903886426647377` · WABA de teste `1414275710855684` · Phone Number ID de teste
`1386100787926214` · Supabase staging `mzfnhljphcjpqtuesjci`.

---

## 1. Onde a integração está hoje

| | |
|---|---|
| Webhook recebendo da Meta | ✅ assinatura real validada, evento persistido |
| Mensagens reais recebidas | ✅ 3 (`test RepCo 2`, `Oi`, `Tudo bem?`) |
| Central no RepCo, autenticada | ✅ tempo real, janela de 24 h, assumir atendimento |
| Isolamento por empresa | ✅ 40 verificações; representante e promotor não entram |
| Função de envio | ✅ publicada, **modo simulado** |
| **Envio real** | ❌ **falta `WHATSAPP_COFICO_TOKEN`** |
| Produção | zero tabelas `wa_*`, funções em 404 |

**O único bloqueio técnico é o token de envio.** Todo o resto está provado em staging:
31 verificações do envio, 33 do webhook, 40 do isolamento, 535 testes unitários.

---

## 2. O primeiro envio real — preparado, não executado

```bash
$s = Read-Host "Cole o token de acesso do WhatsApp" -AsSecureString
$v = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
npx supabase secrets set --project-ref mzfnhljphcjpqtuesjci WHATSAPP_COFICO_TOKEN=$v
Remove-Variable s, v
```

Depois disso, antes de qualquer disparo, rode:

```bash
node scripts/whatsapp-demo-gravacao.mjs
```

Ele confere o cenário e **para** se faltar alguma coisa: número não habilitado, nenhuma
conversa, ou **janela de 24 h fechada** — nesse último caso o envio seria recusado e a
gravação mostraria uma recusa em vez de uma entrega.

**O envio parte da interface, não de script.** É isso que a Meta precisa ver, e é por isso
que o script conduz a gravação mas não clica em Enviar por você.

---

## 3. Roteiro — `whatsapp_business_messaging`

Grave com **Win+Alt+R** (gravador embutido do Windows). O script acima dá o ritmo.

| # | O que mostrar | Por que a Meta pede |
|---|---|---|
| 1 | A central autenticada em `/repco/whatsapp`, com o nome **COFICO** | prova que é um sistema de atendimento de uma empresa, não um disparador |
| 2 | A conversa do contato de teste, com o histórico recebido | prova que a conversa foi **iniciada pelo cliente** |
| 3 | O indicador da **janela de 24 h** | prova que a regra é respeitada |
| 4 | Digitar e **clicar em Enviar na própria tela** | é a permissão sendo exercida |
| 5 | A mensagem na conversa, com o selo (enviada → entregue → lida) | prova o tratamento de status |
| 6 | **Virar a câmera para o celular** e mostrar a mensagem chegando | é a parte que a Meta mais olha |
| 7 | Responder do celular e mostrar chegando na central **sozinha** | prova o webhook, sem recarregar |

**O que NÃO pode aparecer:** token, senha, o `.env`, o painel de outra empresa, dados de
cliente real, e qualquer mensagem com `wamid.SIMULADO.` no histórico — o script avisa se
houver uma.

---

## 4. Roteiro — `whatsapp_business_management`

**Importante, e dito sem rodeio:** essa permissão é demonstrada no **WhatsApp Manager da
Meta**, não no RepCo. O RepCo **não tem** tela de criação de modelo, e inventar uma para o
vídeo seria mentir para o revisor.

| # | O que mostrar |
|---|---|
| 1 | Business Manager → **WhatsApp Manager** → Modelos de mensagem, com a WABA de teste |
| 2 | **Criar modelo**: nome, categoria **Utilidade**, idioma português |
| 3 | O corpo do modelo, com variável — sugestão abaixo |
| 4 | Enviar para análise e mostrar o modelo na lista com o status |

Sugestão de modelo (**não criei nenhum** — você autoriza antes):

```
Nome:      atualizacao_pedido_cofico
Categoria: Utilidade
Idioma:    Português (BR)

Olá, {{1}}. Seu pedido {{2}} foi faturado e entra na rota de entrega em {{3}}.
Qualquer dúvida, é só responder esta mensagem.
```

É um modelo **de utilidade real** da operação: avisar o cliente sobre o pedido dele. Não é
marketing, e é exatamente o que a COFICO faria.

---

## 5. Gravação de tela

Não precisa de nada novo instalado. O Windows já tem:

- **Win+Alt+R** — grava a janela ativa em MP4. É o caminho mais simples.
- **Win+G** (Xbox Game Bar) — mesma coisa, com controles na tela.
- **Ferramenta de Captura** (Win+Shift+S → aba de gravação) — grava uma região.

**Preserve o que é sensível assim:** janela do navegador sozinha (não a tela inteira),
nenhum terminal visível, nenhuma aba com `.env` aberta, e a central em **staging**, onde o
único contato é o seu próprio telefone de teste. A faixa "STAGING · dados de teste" no
rodapé é honesta — deixe aparecer.

---

## 6. Justificativas para a Meta

### `whatsapp_business_messaging`

**Português**

> A COFICO Brasil é uma distribuidora de alimentos que atende clientes empresariais
> (mercados, padarias, cafeterias e distribuidores) no Estado de São Paulo. O aplicativo
> COFICO RepCo é o sistema interno de gestão comercial e logística da empresa.
>
> Usamos esta permissão para **responder, dentro do nosso próprio sistema, às mensagens que
> os clientes nos enviam**. O cliente sempre inicia a conversa — pelo botão de WhatsApp do
> nosso site, pelo número no cartão do representante ou pelo nosso perfil. A equipe de
> atendimento abre a conversa na central do RepCo e responde com texto livre, dentro da
> janela de 24 horas, que o sistema verifica no servidor antes de permitir o envio.
>
> As respostas tratam de cotação de preço, condição de pagamento, status de pedido,
> agendamento de entrega e suporte. **Não enviamos marketing em massa nem mensagens não
> solicitadas.** Quem pede para sair é registrado como descadastrado automaticamente.
>
> O histórico fica vinculado ao cadastro do cliente, para que qualquer atendente dê
> continuidade sem pedir ao cliente que repita o que já contou.

**English**

> COFICO Brasil is a food distributor serving business customers (grocery stores, bakeries,
> coffee shops and distributors) in the State of São Paulo, Brazil. The COFICO RepCo app is
> the company's internal commercial and logistics management system.
>
> We use this permission to **reply, within our own system, to messages our customers send
> us**. The customer always starts the conversation — through the WhatsApp button on our
> website, the number on our sales representative's card, or our profile. Our support team
> opens the conversation in the RepCo inbox and replies with free-form text inside the
> 24-hour window, which the system verifies server-side before allowing the send.
>
> Replies cover price quotes, payment terms, order status, delivery scheduling and support.
> **We do not send bulk marketing or unsolicited messages.** Opt-out requests are recorded
> automatically.
>
> Conversation history is linked to the customer record so any agent can continue without
> asking the customer to repeat themselves.

### `whatsapp_business_management`

**Português**

> Precisamos desta permissão para administrar nossa própria conta do WhatsApp Business:
> consultar o número conectado, acompanhar a qualidade da conta e gerenciar os **modelos de
> mensagem de utilidade** que usamos para avisar o cliente sobre o pedido dele — faturamento,
> saída para entrega e confirmação de entrega.
>
> São avisos operacionais de pedidos que o próprio cliente fez conosco. Não usamos modelos
> para prospecção nem para promoções em massa.

**English**

> We need this permission to manage our own WhatsApp Business account: check the connected
> phone number, monitor account quality, and manage the **utility message templates** we use
> to notify customers about their own orders — invoicing, dispatch and delivery confirmation.
>
> These are operational notifications about orders the customer placed with us. We do not use
> templates for prospecting or bulk promotions.

---

## 7. Documentação legal — conferida agora

| URL | Estado |
|---|---|
| `https://www.coficobrasil.com.br/privacidade` | **200** |
| `https://www.coficobrasil.com.br/termos` | **200** |
| `https://www.coficobrasil.com.br/exclusao-de-dados` | **200** |

As três são legíveis **sem JavaScript** (o crawler da Meta não executa script) e a política
já descreve o tratamento por WhatsApp, incluindo o papel da Meta e a transferência
internacional. **Falta cadastrá-las no painel do app**, em Configurações → Básico:

- URL da Política de Privacidade → `/privacidade`
- URL dos Termos de Serviço → `/termos`
- URL de Exclusão de Dados → `/exclusao-de-dados`

---

## 8. Ícone do aplicativo

Gerado em **`Área de Trabalho/meta-cofico/icone-app-meta-1024.png`**:

```
1024x1024 · PNG · sem transparência · 25 KB
```

Feito a partir de `public/carreiras/cofico-logo.png` (6250×6250, o original de maior
resolução). **Sem transparência de propósito:** a Meta recusa alpha no ícone, e um PNG
transparente vira fundo preto ou xadrez dependendo de onde ela mostra. A identidade visual
não foi alterada — é o logo oficial, só redimensionado e achatado sobre branco.

---

## 9. Acesso dos revisores — **aqui há um impedimento real**

A Meta costuma pedir credenciais de teste para o revisor entrar no sistema. **Hoje isso é
impossível:** a central roda em `localhost:5174`, que só existe na sua máquina. Não há
ambiente de staging publicado na internet.

Três saídas, em ordem de custo:

1. **Só screencast.** Para `whatsapp_business_messaging`, o vídeo costuma bastar — é o que
   a Meta pede explicitamente no formulário. **É o caminho que eu recomendo começar.**
2. **Publicar o staging** numa URL fechada (um deploy separado na Vercel, apontando para o
   banco de staging, com acesso por senha). Dá trabalho e cria uma superfície nova para
   manter.
3. **Dar acesso à produção** — **não**. Teria dado de cliente real, e isso não se entrega a
   revisor terceirizado.

Se a Meta exigir acesso e o vídeo não bastar, eu monto a opção 2 com dados fictícios, nunca
com conversa real.

---

## 10. Checklist

### Depende de você, agora

- [ ] Gravar **`WHATSAPP_COFICO_TOKEN`** — único bloqueio do envio real
- [ ] Autorizar o **primeiro disparo real** para o 9798
- [ ] Cadastrar as três **URLs legais** no painel do app
- [ ] Subir o **ícone 1024×1024**
- [ ] Autorizar (ou não) a criação do **modelo de utilidade**

### Depende da Meta

- [ ] **Verificação da V. MEDEIROS DE SANTI LTDA** — em análise; trava tudo abaixo
- [ ] App Review de `whatsapp_business_messaging`
- [ ] App Review de `whatsapp_business_management`
- [ ] **Coexistência** — condição para o +55 11 93810-0909 entrar sem perder o app do celular

### Depende de mim, depois do token

- [ ] Rodar a bancada confirmando que o modo simulado saiu do ar
- [ ] Download de mídia para o bucket privado (hoje guardamos só o id na Meta)
- [ ] Token permanente por usuário de sistema (o temporário dura 24 h)

### Ordem que eu seguiria

```
verificação da empresa aprovada
        ↓
token gravado → primeiro envio real autorizado → gravar o vídeo 1
        ↓
modelo de utilidade autorizado → gravar o vídeo 2
        ↓
URLs legais + ícone no painel
        ↓
submeter App Review
        ↓
Coexistência → número comercial
```

**Nada disso foi submetido.** O que está pronto é o material; o envio e a submissão esperam
sua ordem.
