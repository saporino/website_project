# Auditoria para a primeira submissão à Meta

> 14/10/2026. Nada submetido, nada enviado, nenhum número registrado, app não publicado.
> Produção: `whatsapp-webhook` e `whatsapp-enviar` respondem **404**, zero tabelas `wa_*`.

---

## 1. O que existe de verdade

| Funcionalidade | Estado | Evidência |
|---|---|---|
| Recebimento pela Cloud API | **IMPLEMENTADA E TESTADA** | 3 mensagens reais da Meta; assinatura real validada; 11 verificações |
| Conversas reais na central | **IMPLEMENTADA E TESTADA** | na tela, em staging, com tempo real |
| Controle de acesso por empresa | **IMPLEMENTADA E TESTADA** | 40 verificações; rep e promotor barrados |
| Atribuição de atendimento | **IMPLEMENTADA E TESTADA** | `wa_assumir`; recusa largar conversa de outro |
| Janela de 24 h | **IMPLEMENTADA E TESTADA** | conferida no banco, com o relógio do banco |
| **Envio real** | **IMPLEMENTADA SEM TESTE REAL** | 31 verificações, mas **em modo simulado** — falta o token |
| Leitura de informações da WABA | **NÃO IMPLEMENTADA** | nenhuma chamada à Graph API além do envio |
| **Consulta e gestão de modelos** | **NÃO IMPLEMENTADA** | **não existe no código, no banco ou na tela** |

Procurei por `template`, `modelo_mensagem`, `message_template` e `wa_templates` em todo o
projeto. As únicas ocorrências são **um comentário** e **um valor de enum** na lista de tipos
de mensagem. Não há tabela, função, rota ou tela.

---

## 2. A divergência com a Meta — e é séria

**O que foi dito à Meta:** que o RepCo cria e gerencia modelos de mensagem.
**O que existe:** nada disso.

Isso não é um detalhe de redação. O revisor da Meta abre o vídeo esperando ver a
funcionalidade descrita; não vendo, o pedido é recusado — e uma descrição que não bate com o
produto pesa contra a conta na segunda tentativa, que é justamente onde vocês estão.

### O que recomendo

**Retirar `whatsapp_business_management` desta submissão.** Submeter só
`whatsapp_business_messaging`, que é verdadeira, está implementada e é o que a operação
precisa hoje: responder quem escreve.

Motivo: a COFICO vai usar modelos (para avisar sobre pedido), mas o **WhatsApp Manager da
Meta já faz isso**. Construir uma tela de modelos no RepCo só para justificar uma permissão é
inverter a ordem — software que existe para passar numa revisão, não para servir alguém.

### Se você quiser a permissão agora

A implementação mínima, segura e honesta seria um painel **somente leitura** em RepCo ›
WhatsApp: listar os modelos da WABA com nome, categoria, idioma e **status de aprovação**, e
mostrar a qualidade do número. Isso é útil de verdade — quando a janela de 24 h fecha, o
atendente precisa saber qual modelo pode usar — e justifica a permissão sem inventar nada.

São duas chamadas de leitura à Graph API (`/{waba}/message_templates` e `/{phone_number_id}`)
numa função de borda, com o token no servidor. **Não construí**: é funcionalidade nova e
você pediu para não inventar o que não é necessário. Me diga se quer.

### Frases que o Claude MCP precisa corrigir no painel

Procure, na descrição de `whatsapp_business_management`, qualquer frase do tipo:

| Trocar isto | Por isto |
|---|---|
| "o aplicativo cria modelos de mensagem" | *(remover — não existe)* |
| "gerencia modelos de mensagem" | *(remover — não existe)* |
| "o RepCo administra templates" | *(remover — não existe)* |

Se a permissão for mantida, a descrição honesta é a do §6 do outro documento: administrar a
própria conta e **acompanhar** os modelos de utilidade — nunca "criar pelo aplicativo".

---

## 3. Auditoria da função de envio

| Critério | Estado |
|---|---|
| JWT obrigatório | ✅ publicada **sem** `--no-verify-jwt`; sem `Bearer` → 401 |
| Autorização por empresa e papel | ✅ `wa_pode_enviar` no banco, não na função |
| RLS preservada | ✅ o veredito usa o JWT da pessoa; service role só **grava** |
| Token só no servidor | ✅ `WHATSAPP_COFICO_TOKEN` nunca sai da função |
| Número comercial bloqueado | ✅ trigger no banco; 4 formatos do mesmo número recusados |
| Janela de 24 h no banco | ✅ com o relógio do banco, não o do navegador |
| Idempotência | ✅ chave única; 2 chamadas simultâneas = 1 mensagem |
| Falhas e status de entrega | ✅ falha vira linha marcada com o código da Meta; status casa pelo `wamid` |

**31 verificações, 0 falhas.** O ambiente está pronto para **um** envio real — que não
acontece sem sua autorização explícita.

---

## 4. Domínio do RepCo

**Recomendo `repco.coficobrasil.com.br`** — com uma ressalva que você precisa decidir.

### Por que esse, e não outro

O aplicativo Meta é da COFICO. O Facebook Login for Business e o Embedded Signup exigem que
o domínio esteja no mesmo negócio verificado do app. `repco.cafesaporino.com.br` seria outro
negócio — atrito desnecessário com a Meta.

### A ressalva

**O RepCo é compartilhado**: serve COFICO, Saporino e Fazendinha, com seletor de empresa
dentro. Pôr o portal sob o domínio da COFICO sugere que ele é dela. Na prática não muda
nada — o isolamento é por `company_id`, não por domínio — mas é uma escolha de marca, e é
sua. A alternativa neutra seria um domínio próprio, que custa dinheiro e você pediu para não
criar serviço pago.

### O que seria preciso

| | |
|---|---|
| **DNS** | um `CNAME` `repco` → `cname.vercel-dns.com` |
| **HTTPS** | automático pela Vercel, sem custo |
| **Roteamento** | uma regra nova no `vercel.json` para esse host |
| **Autenticação** | já existe; a central já checa papel e a RLS decide |
| **Redirecionamento** | `/` nesse host → RepCo |

### Um defeito que isso revelaria

`src/App.tsx:264` trata **qualquer** subdomínio de `coficobrasil.com.br` como site
institucional:

```js
if (host === 'coficobrasil.com.br' || host.endsWith('.coficobrasil.com.br'))
  return <CoficoBrasilPage />;
```

Hoje `repco.coficobrasil.com.br` mostraria a **página da COFICO**, não o RepCo. A correção é
pequena, mas tem de vir junto com o DNS — senão o domínio novo nasce mostrando a coisa
errada. **Não alterei**, porque mexer nisso sem o DNS não tem como ser verificado.

---

## 5. Embedded Signup e Coexistência — leia antes de investir

Aqui há uma confusão que custa caro, e prefiro dizer agora:

**Embedded Signup serve para você conectar o WhatsApp DE OUTRAS EMPRESAS no seu sistema.** É
o fluxo de Tech Provider / BSP. Para a COFICO conectar o **próprio** número, ele **não é
necessário** — isso se faz direto no painel, e é o caminho mais curto.

Então a pergunta não é técnica, é de negócio:

| Caminho | O que é | O que exige |
|---|---|---|
| **A. COFICO usa para si** | atender os clientes da COFICO | o que já estamos fazendo + Coexistência |
| **B. COFICO vira Tech Provider** | oferecer WhatsApp às empresas do RepCo como produto | verificação, App Review mais pesado, Embedded Signup, suporte, responsabilidade sobre contas de terceiros |

O caminho B é o SaaS do blueprint — faz sentido um dia, mas é **outro projeto**, não um passo
desta submissão. Misturar os dois agora atrasa o A sem entregar o B.

**Minha recomendação: fechar o caminho A primeiro.** Quando a Coexistência for aprovada e o
atendimento estiver rodando com o número comercial, aí sim avaliar o B com calma.

**Não implementei o SDK de Embedded Signup.** Seria código para um fluxo que você talvez não
vá usar, e que depende de aprovações que ainda não existem.

---

## 6. O que falta para os dois vídeos

**Vídeo A (`messaging`)** — falta **uma coisa só**: o token. Com ele gravado:

```bash
node scripts/whatsapp-demo-gravacao.mjs --enviar
```

O script confere o cenário, para se a janela estiver fechada, avisa se houver mensagem
simulada no histórico, e conduz os sete passos com pausa para a câmera. **O clique em Enviar
é seu** — tem de partir da interface.

**Vídeo B (`management`)** — falta **decidir** se a permissão fica na submissão. Se ficar, a
demonstração é no **WhatsApp Manager da Meta**, não no RepCo, e eu preciso da sua autorização
para o modelo ser criado. Se sair, não há vídeo B.

Gravação: **Win+Alt+R**, só a janela do navegador. Nada de terminal, `.env` ou painel de
outra empresa à vista.

---

## 7. Ícone — conferido

```
Área de Trabalho/meta-cofico/icone-app-meta-1024.png
  PNG · 1024x1024 (quadrado) · 25 KB (limite 5 MB) · sem transparência
```

Gerado do logo oficial em 6250×6250, só redimensionado e achatado sobre branco. **A marca não
foi alterada.**

---

## 8. Testes — o que passou

| Bancada | Resultado |
|---|---|
| Isolamento multiempresa | **40 ok, 0 falhas** |
| Envio (autorização, janela, idempotência) | **31 ok, 0 falhas** |
| Webhook / recebimento real | **11 ok, 0 falhas** |
| Testes unitários | **535 ok** (31 arquivos) |
| Produção intocada | `whatsapp-webhook` **404** · `whatsapp-enviar` **404** · zero tabelas `wa_*` |

**Nenhuma falha.** O que não foi testado é o que não dá para testar sem o token: **o envio
real**.

---

## Resumo

**Funciona, comprovado:** receber da Meta, exibir, isolar por empresa, atribuir atendimento,
respeitar a janela, e toda a mecânica de envio — menos a saída de verdade.

**Falta implementar:** nada para `whatsapp_business_messaging`. Para
`whatsapp_business_management`, falta **tudo** — e a decisão é se vale construir.

**Corrigir na Meta:** remover toda frase que diga que o RepCo cria ou gerencia modelos.

**Domínio:** `repco.coficobrasil.com.br`, com a correção do `App.tsx:264` junto do DNS.

**Vídeos:** A depende só do token. B depende de você decidir sobre a permissão.

**Depende exclusivamente da Meta:** verificação da V. Medeiros de Santi (em análise, trava
tudo), App Review, e a **Coexistência** — sem ela o +55 11 93810-0909 não entra.
