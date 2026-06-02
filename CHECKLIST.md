# ✅ Checklist RepCo / Café Saporino — acompanhamento

> Lista editável — marque `[x]` no que validar. Atualizada por Claude conforme avança.
> _Última atualização: 02/06/2026_

## 🟢 Feito e no ar (commitado + push)
- [x] Prazo de pagamento no cadastro do cliente
- [x] Comissões a prazo quebradas por parcela (com previsão de data)
- [x] Performance dinâmica (dia / semana / horário / calendário / tendência 12m)
- [x] Camada 1 — Painel de Inteligência `/repco/inteligencia` (faturamento, região, linha, ranking reps, preço praticado)
- [x] 6 views de agregação no banco
- [x] Geo do cliente (cidade/UF/CEP auto via CNPJ) + linha de produto no admin
- [x] Score do cliente 0-1000 (evolui no pagamento, badge, PDF Serasa)
- [x] Trava por boleto vencido (destrava ao anexar comprovante)
- [x] Pedido auditável — log de observações
- [x] Sininho: alerta boleto vencido + tempo real + badge piscando
- [x] PWA reativado (instalável / Add to Home Screen)
- [x] Fundação multi-tenant (`company_id` em 11 tabelas)
- [x] Toolbar do admin reorganizada
- [x] CLAUDE.md como fonte única + blueprint salvo

## 🟢 Feito hoje (continuação)
- [x] Heatmap geográfico no mapa (Leaflet, círculo por faturamento) — clientes geocodificados

## 🟠 Precisa de 1 decisão sua
- [ ] Editar produtos do pedido só antes da NF + audit log — **como a comissão recalcula quando muda item?** (decide e eu construo)

## 🔵 Validação do Vlademir (testar na tela)
- [ ] Testar Performance / Inteligência / Score / Trava / Observações
- [ ] Testar PWA no celular (instalar via link)
- [ ] Revisar visual e pedir ajustes

## 🔴 Go-live (decisão/risco — com Vlademir no loop)
- [ ] Ligar RLS multi-tenant (`company_id`) — testar login na hora
- [ ] Transição teste → live (zerar dados de teste)

## 🟣 Projetos à parte (multi-sessão / externos)
- [ ] ETL nacional de CNPJ (prospecção em massa)
- [ ] Billing / onboarding do SaaS (Camada 3)
- [ ] Integrações de marketplace (ML/Shopee/Amazon/TikTok)
- [ ] E-mail Resend (bloqueado: Google Workspace)
