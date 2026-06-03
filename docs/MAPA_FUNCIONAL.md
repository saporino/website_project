# MAPA FUNCIONAL — Café Saporino (visão global de papéis × telas × dados)

> Documento vivo. **Antes de qualquer mudança, consultar aqui + rastrear o dado de ponta a ponta (banco → tela → papel) e conferir a tela equivalente.** Atualizado: 02/06/2026.

## Papéis (quem vê o quê)
| Papel | Como é definido | Onde entra | Acesso |
|---|---|---|---|
| **Cliente PF** | `user_profiles.account_type='PF'` | `/` (loja), `/meu-perfil` | Compra, assina, rastreia. Perfil quase todo read-only |
| **Cliente PJ** | `user_profiles.account_type='PJ'` | idem | idem |
| **Administrador** | `user_profiles.is_admin=true` | `/admin` | Tudo (8 abas) + gerencia reps |
| **Representante** | linha em `representatives` (status pending/active/blocked) | `/repco` | Só o próprio portal; nunca /admin |

⚠️ **Login dropdown da loja** só tem Cliente PF / Empresa PJ / Administrador — **falta "Representante RepCo"** (a fazer).

## Telas do REP (`/repco`, 9 abas) — o que faz e se grava
| Aba | Faz | Grava? |
|---|---|---|
| Início | KPIs, próximas visitas, alertas inatividade | leitura (snooze) |
| Perfil | dados + documentos (CNH/CPF/CNPJ/CORE/Contrato) | rep edita **só e-mail/telefone** + upload docs |
| Clientes | CRUD clientes B2B (PF/PJ) | cria/edita/exclui |
| Novo Pedido | cliente→produtos→revisão→pedido | cria pedido+itens+parcelas |
| Pedidos | histórico, NF, boleto, observações | status + notas |
| Rotas | mapa/paradas (Leaflet, GPS, POD) | POD |
| Prospecção | leads → converte em cliente | converte/descarta |
| Comissões | extrato (à vista/a prazo/pagas) | leitura |
| Performance | gráficos (dia/semana/horário/calendário/12m) | leitura |

## Admin (`/admin → RepCo`)
- Lista/aprova/bloqueia reps; **perfil do rep editável** (nome, e-mail, telefone, CPF, CNPJ, % comissão, entrega pessoal); vê pedidos/comissões/clientes do rep; "Ver como rep" (espelho flutuante); Treinamento ao vivo; Inteligência; Tabela de Preços; Prospecção.

## Cadastro: REP vs CLIENTE (lacuna confirmada)
- **Cliente (RepCoClients):** CNPJ/CPF, razão social, nome fantasia, segmento, e-mails, comprador, prazo/forma pagamento, limite crédito, score Serasa(+PDF), cep/município/uf/bairro, endereço.
- **Representante (regForm em RepCoDashboard):** **só 4 campos** (nome, CPF, telefone, CNPJ). → **enriquecer p/ paridade com cliente + documentos** (a fazer).

## Documentos
- **Rep:** bucket `representative-docs`, tabela `representative_documents` (cnh/cpf_doc/cnpj_doc/core/contrato) — só upload.
- **Cliente:** não tem upload de documento (só PDF do score Serasa em `representative_clients`).

## Dados / tabelas-chave
- Cliente do site: `user_profiles` (PF/PJ). Cliente B2B do rep: `representative_clients`. **São tabelas separadas, sem FK** — risco de duplicidade se o mesmo CNPJ comprar no site e ser cliente de rep. (revisar no futuro)
- Pedidos: `representative_orders` (+ `_items`, `_installments`). Comissão: `representative_commissions` → `representative_commission_payouts` (parcial por parcela). Trava: view `vw_repco_clientes_bloqueados`. Inteligência: views `vw_repco_vendas_por_*`.
- Multi-tenant: `companies` + `company_id` (backfill Saporino); RLS de escopo **pronta mas não ligada** (`my_company_id()`).

## Lacunas / decisões em aberto (rastrear)
- [ ] "Representante RepCo" no dropdown de login.
- [ ] Cadastro completo do rep (paridade com cliente) + documentos no onboarding.
- [ ] Modo **web read-only do rep** com toggle `web_full_access` por rep (admin liga/desliga; celular sempre opera).
- [ ] Admin criar cliente B2B completo (hoje só o rep cria com segmento/crédito).
- [ ] Unificar `is_pj` (representative_clients) vs `account_type` (user_profiles).
- [ ] Sincronizar/ligar `user_profiles` ↔ `representative_clients` (FK) — evitar cliente duplicado.
