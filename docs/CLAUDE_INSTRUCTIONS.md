# CLAUDE_INSTRUCTIONS.md
**Documento permanente — Café Saporino**  
*Última atualização: 30/05/2026 — Sessão Fase 1 NF*

---

## 0. Como usar este documento

Em qualquer nova conversa, abra com:
> "Lê o `docs/CLAUDE_INSTRUCTIONS.md` antes de fazer qualquer coisa."

Claude (eu) vai usar Antigravity pra ler isso e retomar o contexto.

---

## 1. Sobre o projeto

**Empresa:** Café Saporino Ltda (CNPJ 61.109.694/0001-94, Simples Nacional)  
**Site:** https://www.cafesaporino.com.br  
**Repo:** https://github.com/saporino/website_project  
**Sócios atuais (50/50):**
- Vlademir Medeiros De Santi (administrador, ponto de contato técnico)
- Eunice & Michael Jakobson (juntos, baseados nos EUA)

**Nota:** Honorina Rosa De Santi NÃO é mais sócia (entrada dos Jakobson).

**Objetivo de longo prazo:** plataforma de distribuição de café (B2B + B2C) escalável, com modelo de Cooxupé como referência. Posição: vendável como produto a terceiros no futuro.

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React + TypeScript |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Deploy | Vercel (auto-deploy ao push em `main`) |
| Pagamento | Mercado Pago |
| Email (planejado) | Resend (pendente Google Workspace @cafesaporino.com.br) |
| OCR (futuro) | Google Cloud Vision API (free tier 1.000/mês) |
| Notificações (futuro) | Telegram Bot + PWA Push Notifications |

**Diretório local:** `c:\Users\vlade\OneDrive\Documents\website_project`  
⚠️ Está dentro do OneDrive — mover pra fora num futuro próximo.  
⚠️ Diretório residual `CodexProjects\website_project` foi deletado (não usar mais).

**Env vars (.env):** VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MERCADO_PAGO_PUBLIC_KEY, SUPABASE_SERVICE_ROLE_KEY.

---

## 3. Canais do site

| URL | Quem usa | Função |
|---|---|---|
| `/` | Consumidor final | Loja online (B2C) |
| `/admin` | Vlademir (sócio admin) | Painel administrativo total |
| `/repco` | Representantes comerciais | Portal pra criar pedidos, ver clientes, NF, etc |

**Admin Force:** perfil de teste atual (usado pra ambos admin e rep durante desenvolvimento).

---

## 4. Como eu (Claude) devo trabalhar

### Princípios não-negociáveis
1. **Não chutar.** Diagnóstico primeiro (HAR, console, logs), código depois.
2. **Validar antes de commit.** Sempre `npm run typecheck` + `npm run build` passando.
3. **Atomic commits.** Cada commit é uma unidade lógica.
4. **Encoding UTF-8 ou escapes Unicode.** Zero mojibake.
5. **Fazer um sprint pequeno por vez.** Não acumular 10 features em 1 commit.
6. **Sempre perguntar quando algo parecer estranho.** Não assumir.

### Lições aprendidas (não repetir)
- Chute por commit (lição do Codex: 6 commits sem diagnóstico → bug não resolvido)
- Esquecer `npm install` antes de build
- Trabalhar em 2 diretórios paralelos
- Confiar no PowerShell pra encoding de acentos (usar Python ou escapes \uXXXX)
- Refatorar sem entender o porquê do código original

### Como interagir com o Antigravity
- Antigravity executa por mim no PC de Vlademir
- Vlademir cola blocos e me cola o output
- Toda instrução técnica vai DENTRO do bloco (como comentário PowerShell) — não em texto separado
- Padrão de cabeçalho:
  - INSTRUÇÕES PRO ANTIGRAVITY (NÃO RESUMIR output literal)
  - OBJETIVO claro
  - VALIDAÇÃO OBRIGATÓRIA: typecheck + build
  - Se algo falhar: PARAR, reportar, NÃO commitar

---

## 5. Como Vlademir prefere trabalhar

- **Português brasileiro** sempre
- **Conciso, direto, sem floreios**
- **Não é desenvolvedor profissional** — instruções passo a passo simples
- **Antigravity executa, ele só cola e me devolve o output**
- **Prints quando eu pedir** (UI, console, network)
- **Pergunta quando algo parecer estranho** ANTES de codar
- **Não gastar créditos** com retrabalho — preferir 1 commit certo a 5 commits errados
- **Visualmente:** confia em mim como "mestre" — eu padronizo
- **Funcionalmente:** ele define o que quer, eu implemento

---

## 6. Modelo de negócio (regras críticas)

### Fluxo padrão de venda RepCo

1. Representante cria pedido no /repco
2. Admin recebe alerta vermelho (sininho)
3. Admin clica no alerta -> abre DIRETO o perfil do representante (não lista)
4. Admin vê o pedido novo
5. Admin gera NF em sistema externo
6. Admin anexa NF + (boleto OU comprovante PIX) no pedido
7. Representante recebe a NF/comprovante no portal
8. Pedido vai pra aba "Concluído" no perfil do rep

### Tipos de pagamento

| Tipo | Documentos obrigatórios | Regra |
|---|---|---|
| **PIX / Depósito (à vista)** | NF (opcional) + comprovante PIX (obrigatório) | Sem comprovante = não libera entrega |
| **Boleto (a prazo)** | NF + Boleto + data vencimento | Após pagamento -> anexar comprovante |
| **Sem NF** | Só comprovante PIX | Não tem boleto |

### Boletos múltiplos
- Até **5 boletos por pedido** + 5 comprovantes correspondentes
- Combinações comuns: 1x7d, 1x14d, 1x28d, 1x30d, 2x30/60, 2x14/28, 3x30/60/90
- Opção **Personalizado** sempre disponível pra qualquer combinação
- Data de vencimento: admin digita manual (OCR via Google Vision é melhoria futura)

### Sistema de Score do Cliente (estilo Serasa, mas interno)
- Escala: **0-1000** (mesma do Serasa real)
- Admin **anexa PDF do print Serasa** ao cadastrar cliente + digita score inicial
- PDF fica no histórico do cliente (auditoria de origem)
- Evolução automática baseada em pagamentos:
  - Boleto pago em dia: **+20 pts**
  - Boleto pago 1-3 dias atrasado: **-30 pts**
  - Boleto pago 4-7 dias atrasado: **-50 pts**
  - Boleto não pago após 7 dias: **-100 pts**
  - 3 boletos seguidos em dia: bônus de recuperação **+30 pts**
- **PIX/depósito à vista NÃO afeta o score** (sem risco, não conta)
- Faixas visuais: 0-300 ruim, 300-500 regular, 500-700 bom, 700-900 ótimo, 900-1000 excelente

### Trava de cliente (boleto vencido)
- D+1 do vencimento sem pagamento -> cliente **trava automaticamente**
- Cliente travado:
  - NÃO pode receber novos pedidos
  - Representante recebe alerta pra contatar
  - Representante vê na tela: **"Cliente bloqueado — boleto vencido em DD/MM"** + motivo
- Destrava:
  - **Automático** quando admin anexa comprovante de pagamento
  - **Manual** pelo admin no painel (botão dedicado)

### Pedido auditável (representante pode adicionar info após criação)

| Componente | Regra |
|---|---|
| **Observações/notas** | Sempre disponível, texto livre |
| **Anexar PDF do pedido do cliente** | Sempre disponível (no novo ou em existente) |
| **Editar produtos/quantidades** | Disponível enquanto invoice_pdf_url IS NULL. Após admin anexar NF -> trava edição. Cada alteração registra audit log. |

---

## 7. Sistema de notificações (sininho)

| Cor | Tipo | Ação ao clicar |
|---|---|---|
| Vermelho (piscando) | Pedido NOVO criado pelo rep | Abre perfil do rep + pedido específico |
| Amarelo + número (piscando) | Pedido alterado pelo rep (auditoria) | Abre o pedido com diff visual |
| Azul | Boleto vencendo hoje OU vencido | Abre o cliente correspondente |

**Canais de alerta pessoal pro admin (Vlademir):**
1. Sininho no /admin (sempre, presença no computador)
2. **Telegram bot** (gratuito, prioritário — Claude vai criar quando chegar nessa fase)
3. **PWA Push Notifications** (após RepCo PWA estar pronto)
4. Email (após Resend + Google Workspace pronto)

---

## 8. Estado atual (30/05/2026)

### Já funciona
- Upload de NF PDF/XML no admin (com nome do arquivo) — Fase 1A
- Portal Representante mostra NF anexada + botões Baixar/Imprimir/WhatsApp/Email — Fase 1B
- Upload de Comprovante de pagamento via input dinâmico — Fase 2
- Destaque visual cliente na lista do rep
- Mensagem dinâmica com Pedido Cliente Nº condicional
- Policies RLS do bucket invoices configuradas

### Backlog priorizado (próximos sprints)

| Prioridade | Sprint | Conteúdo |
|---|---|---|
| Alta | 3 | Boleto + datas (manual) + múltiplos boletos (até 5) |
| Alta | 4 | Sistema de notificações (cores vermelho/amarelo/azul piscando + roteamento) |
| Alta | 5 | Score do cliente (anexar PDF Serasa + score inicial + evolução automática) |
| Alta | 6 | Trava de cliente por boleto vencido + destrava manual/auto |
| Média | 7 | Pedido auditável (notas + anexos + edição condicional) |
| Média | 8 | OCR Google Vision (boleto + NF + score Serasa) |
| Média | 9 | RepCo PWA completo (manifest + SW + offline-first + push notifications) |
| Baixa | 10 | Telegram bot pra alertas pessoais |
| Baixa | 11 | Resend (espera Google Workspace) |
| Futuro | 12 | Marketplaces, Mapa ao vivo, Prospecção (não documentado ainda) |

### Conhecido mas não investigado
- Erro `Error loading orders` no console (não-bloqueante)
- Erros 400 em `user_profiles.account_type=eq.PF/PJ` (não-bloqueante)
- Status do pedido: "Concluído" não significa pagamento confirmado — clarificar

---

## 9. Padrões técnicos do projeto

### Upload de arquivos
**Padrão correto:** `document.createElement('input')` em runtime, NÃO `<input type="file">` no JSX dentro de `.map()`.

**Motivo:** re-render do React desmonta o input enquanto o file picker está aberto, fazendo o `onChange` morrer silenciosamente (resolvido na Fase 1 após 2 dias de bug).

### Encoding
Sempre UTF-8. Em arquivos com acentos, preferir escapes Unicode (\u00e9 ao invés de literal) pra evitar problemas com PowerShell/Windows codepage.

### Validação SQL
- `exec_migration` (REST) cobre tabelas user
- Policies de `storage.objects` precisam SQL Editor manual (service_role não tem permissão pra schema storage)

### Decisões arquiteturais já tomadas
- Supabase Realtime ao invés de Socket.IO custom (over-engineering)
- Sentry ao invés de OpenTelemetry full (escala adequada)
- Vercel auto-deploy ao invés de Kubernetes (já resolve)
- Mensagem WhatsApp/Email manda só TEXTO (signed URLs expiram)
- Telegram bot ao invés de WhatsApp Business API (gratuito)
- Score interno ao invés de API Serasa real (custo alto)

---

## 10. Glossário

| Termo | Significado |
|---|---|
| **RC-00004** | Formato de número de pedido interno (gerado automaticamente) |
| **Pedido Cliente Nº** | Número que o cliente fornece (PO, ordem, etc) — opcional |
| **Admin Force** | Perfil de testes atual (representa qualquer rep ou admin) |
| **Triunfante Distribuidora** | Cliente de teste atual |
| **Lots / Lotes** | Sistema separado de gestão de estoque de café verde (BatchManagement) |

---

## 11. Contatos e dados pessoais (Vlademir)

- **Localização:** Brasil — Região metropolitana de SP
- **Lease comercial:** Várzea Paulista/SP (30 meses desde abr/2026)
- **Contador:** Leonardo Ferrareis (Ferrareis Soluções Contábeis)
- **Outra renda:** Carra Indústria de Bebidas (separada do Saporino)
- **Telegram/WhatsApp pessoal pra alertas:** +55 11 91771-9798

---

## 12. Roteiro de continuidade entre conversas

Quando uma conversa esgotar (limite de imagens ou contexto):

1. Vlademir abre nova conversa Claude
2. Primeira mensagem: **"Lê o `docs/CLAUDE_INSTRUCTIONS.md` no projeto antes de fazer qualquer coisa. Antigravity está rodando."**
3. Claude usa Antigravity pra ler -> tem todo o contexto
4. Continuamos de onde paramos

**Para atualizações importantes neste documento:** abrir PR específico de update + push. Manter datado no topo.

---

*Fim do documento. Sempre que algo mudar substancialmente — backlog, decisão arquitetural, nova regra de negócio — atualizar AQUI primeiro, depois codar.*