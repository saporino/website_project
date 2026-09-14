# COFFEE LiVRE — BACKUP MESTRE · SNAPSHOT 14/09/2026 (fechamento da Unidade 8)

> Snapshot congelado. Não editar: a versão viva é `COFFEE_LIVRE_BACKUP_MESTRE.md` na raiz do repositório.

> **Instrução de recuperação.** Se o chat original do Coffee LiVRE estiver indisponível ou incompleto, leia integralmente este documento e o `docs/marketplace/RAIO_X_OPERACIONAL_COFFEE_LIVRE.md` antes de continuar. Confirme o estado atual no Git e no staging. Não reinicie unidades aprovadas. ChatGPT atua como PM/QG e Claude Code como executor. Decisões técnicas reversíveis seguem sem necessidade de autorização repetitiva do usuário.

| | |
|---|---|
| Data do snapshot | 14/09/2026 |
| Motivo | grande unidade concluída (U8) |
| Último commit de unidade aprovada | `ef85672` — Unidade 8 |

---

## 1. Os documentos de continuidade

| Papel | Onde | O que guarda |
|---|---|---|
| Fonte estratégica, gerencial e de continuidade | `COFFEE_LIVRE_BACKUP_MESTRE.md` | visão, princípios, modelo, governança, roadmap, estado das unidades |
| Fonte técnica e operacional | `docs/marketplace/RAIO_X_OPERACIONAL_COFFEE_LIVRE.md` | arquitetura, modelo de dados, regras, decisões de implementação, testes, limitações (evolução na seção 17) |
| Estado executável | Git + `supabase/migrations` + staging | código, estrutura do banco, seeds e ambiente de testes reconstruível |

### Política de backup
- **CHAT NÃO É BACKUP.**
- Criar snapshot datado quando houver:
  - grande unidade concluída;
  - mudança de arquitetura;
  - mudança de modelo comercial;
  - integração financeira real;
  - integração logística real;
  - decisão jurídica relevante;
  - lançamento;
  - alteração importante de roadmap.
- Não criar snapshot para pequenas mudanças. O Git preserva o histórico intermediário.

---

## 2. O que é o Coffee LiVRE

Marketplace vertical especializado em café.

**Visão:** conectar produtores, fazendas, cooperativas, torrefações, marcas, distribuidores, empacotadores e fornecedores de equipamentos e acessórios a consumidores e empresas.

Não é apenas um website: é **negócio, produto, marketplace, ativo tecnológico e ativo investível**.

> "Você entende de café. O Coffee LiVRE entende de vender."
>
> "EU SEI FAZER CAFÉ. O COFFEE LiVRE ME AJUDA A VENDER."

A plataforma trabalha para o seller.

**Modelo:** marketplace 3P com fulfillment Coffee LiVRE no MVP. Motores: catálogo, storefront/CMS, pedidos, pagamentos, logística.

**Conceitos estratégicos:**
- LiVRE Entrega
- LiVRE Passport
- Lot Passport
- LiVRE Copiloto
- Escada de Quantidade / Leve Mais, Pague Melhor
- Comparação de Mercado
- Calculadora de Economia
- B2B
- LiVRE LiVE — somente depois do core transacional, de pagamento e de logística.

---

## 3. Governança

- ChatGPT = PM/QG. Claude Code = executor.
- Decisões técnicas reversíveis não precisam voltar ao usuário.
- Escalar: capital relevante, propriedade, jurídico, posicionamento de marca ou compromisso estratégico difícil de reverter.

## 4. Stack e regras técnicas permanentes

- Vite, React, TypeScript, Tailwind, Supabase, Vercel.
- Tabelas do marketplace com prefixo `lv_`.
- Mercado Pago sempre no backend (Edge Functions). Nunca expor secrets no frontend. Secrets próprios `LV_MP_*`.
- Migration versionada; staging primeiro, produção depois. Testes destrutivos só no staging (RAIO-X §17.1.11).

---

## 5. Unidade 8 — APROVADA · commit `ef85672`

**Criado:**
- carrinho multiloja;
- checkout em 6 etapas;
- pedido pai;
- subpedido por seller;
- snapshot de produto, preço, desconto, taxas, piso e lote;
- reserva de estoque no servidor;
- FEFO;
- proteção contra overselling;
- TTL configurável;
- baixa após pagamento aprovado;
- devolução após expiração ou cancelamento;
- máquina de estados;
- eventos e histórico;
- idempotência;
- providers de pagamento e frete simulados;
- Meus Pedidos;
- Seller Central / Pedidos;
- Admin / Pedidos.

**Arquitetura validada:** Comprador → carrinho multiloja → checkout → pedido pai → subpedidos → reservas → pagamento → entrega.

**Cenário validado:** Seller A com 2 × Café Tradicional 500 g e Seller B com 3 × Café Especial 250 g. Resultado:
- 1 checkout;
- 1 pedido pai;
- 2 subpedidos;
- reservas independentes;
- repasses conceituais;
- isolamento RLS;
- compra consolidada para o comprador.

**Testes finais:**
- 83/83 bancada de pedidos (API/RLS);
- 114/114 API existente;
- 382/383 navegador (única falha: timeout, validado como instabilidade);
- 329 unitários;
- typecheck, build e fidelidade OK.

**Migrations** `20260914100000`, `20260914110000` e `20260914120000`, aplicadas em staging e produção. Pagamento simulado proibido em produção.

**Limitações:**
- pagamento real inexistente;
- frete real inexistente;
- CEP manual ou simulado;
- taxa de pagamento ainda não trata o frete integralmente;
- comprador sem recuperação de senha e sem endereço persistido;
- fiscal/NF-e não implementado;
- reembolso real não implementado;
- problema legado do Dashboard da Saporino fora do escopo.

---

## 6. Roadmap neste snapshot

| Unidade | Tema | Situação |
|---|---|---|
| U8 | Carrinho multiloja, checkout e pedido | APROVADA |
| U9 | Mercado Pago real | PRÓXIMA |
| U10 | LiVRE Entrega / CD / transportadoras | depois |
| U11 | Primeiro ciclo real ponta a ponta, controlado | depois |
| — | Growth / creators / LiVRE LiVE | depois |
