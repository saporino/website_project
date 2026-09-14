# COFFEE LiVRE — BACKUP MESTRE

> **Instrução de recuperação.** Se o chat original do Coffee LiVRE estiver indisponível ou incompleto, leia integralmente este documento e o `docs/marketplace/RAIO_X_OPERACIONAL_COFFEE_LIVRE.md` antes de continuar. Confirme o estado atual no Git e no staging. Não reinicie unidades aprovadas. ChatGPT atua como PM/QG e Claude Code como executor. Decisões técnicas reversíveis seguem sem necessidade de autorização repetitiva do usuário.

| | |
|---|---|
| Atualizado em | 14/09/2026 (fechamento da Unidade 8) |
| Último commit de unidade aprovada | `ef85672` — Unidade 8 |
| Snapshot datado | `backups/COFFEE_LIVRE_BACKUP_MESTRE_2026-09-14.md` |

---

## 1. Os documentos de continuidade

| Papel | Onde | O que guarda |
|---|---|---|
| Fonte estratégica, gerencial e de continuidade | `COFFEE_LIVRE_BACKUP_MESTRE.md` (este) | visão, princípios, modelo, governança, roadmap, estado das unidades |
| Fonte técnica e operacional | `docs/marketplace/RAIO_X_OPERACIONAL_COFFEE_LIVRE.md` | arquitetura, modelo de dados, regras, decisões de implementação, testes, limitações (evolução na seção 17) |
| Estado executável | Git + `supabase/migrations` + staging | código, estrutura do banco, seeds e ambiente de testes reconstruível |

### Política de backup
- **CHAT NÃO É BACKUP.** O que não está nestes documentos ou no Git não existe para a continuidade.
- Criar snapshot datado em `backups/` quando houver:
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

### Princípio
> "Você entende de café. O Coffee LiVRE entende de vender."
>
> "EU SEI FAZER CAFÉ. O COFFEE LiVRE ME AJUDA A VENDER."

A plataforma trabalha para o seller.

### Modelo
- Marketplace **3P com fulfillment Coffee LiVRE** no MVP.
- Motores: **catálogo**, **storefront/CMS**, **pedidos**, **pagamentos**, **logística**.

### Conceitos estratégicos
- LiVRE Entrega
- LiVRE Passport
- Lot Passport
- LiVRE Copiloto
- Escada de Quantidade / Leve Mais, Pague Melhor
- Comparação de Mercado
- Calculadora de Economia
- B2B
- LiVRE LiVE — no roadmap, **somente depois** do core transacional, de pagamento e de logística.

---

## 3. Governança e forma de trabalho

- **ChatGPT = PM/QG. Claude Code = executor.**
- Decisões técnicas reversíveis não precisam voltar ao usuário.
- Escalar ao usuário: capital relevante, propriedade, jurídico, posicionamento de marca ou compromisso estratégico difícil de reverter.
- Unidades aprovadas não são reiniciadas; a próxima unidade é iniciada pelo PM em comando próprio.

---

## 4. Stack e regras técnicas permanentes

- **Stack:** Vite, React, TypeScript, Tailwind, Supabase, Vercel.
- Tabelas do marketplace com prefixo **`lv_`**.
- **Mercado Pago sempre no backend (Edge Functions).** Nunca expor secrets no frontend. Usar secrets próprios **`LV_MP_*`**.
- Mudança de banco é migration versionada. Primeiro aplicar e testar no staging, depois em produção.
- Testes destrutivos ou transacionais só no staging. Ver RAIO-X §17.1.11 para ambientes, trava de ambiente, baseline e seeds.

---

## 5. Estado das unidades

As unidades anteriores estão registradas no RAIO-X, seção 17.1:
- 17.1.1 Unidade 3
- 17.1.2 Unidade 4
- 17.1.3 Unidade 5
- 17.1.5 e 17.1.6 Unidade 6
- 17.1.7 Unidade 6.5 (Calculadora)
- 17.1.9 Unidade 7 (Comparação de mercado, preço em um clique, B2B e admin)
- 17.1.11 Unidade 7.1 (staging e hardening)

### Unidade 8 — Carrinho multiloja, checkout e pedido
**STATUS: APROVADA** · **Commit: `ef85672`** · Detalhe técnico: RAIO-X §17.1.12

**Criado:**
- carrinho multiloja;
- checkout em 6 etapas;
- pedido pai;
- subpedido por seller;
- snapshot de produto, preço, desconto, taxas, piso e lote;
- reserva de estoque no servidor;
- FEFO;
- proteção contra overselling;
- prazo de reserva (TTL) configurável;
- baixa após pagamento aprovado;
- devolução após expiração ou cancelamento;
- máquina de estados;
- eventos e histórico;
- idempotência;
- provider de pagamento simulado;
- provider de frete simulado;
- Meus Pedidos;
- Seller Central / Pedidos;
- Admin / Pedidos.

**Arquitetura validada:**
```
Comprador → carrinho multiloja → checkout → pedido pai → subpedidos → reservas → pagamento → entrega
```

**Cenário validado:** Seller A com 2 × Café Tradicional 500 g e Seller B com 3 × Café Especial 250 g. Resultado:
- 1 checkout;
- 1 pedido pai;
- 2 subpedidos;
- reservas independentes;
- repasses conceituais;
- isolamento RLS;
- compra consolidada para o comprador.

**Testes finais:**

| Teste | Resultado |
|---|---|
| Bancada de pedidos (API/RLS) | 83/83 |
| API existente | 114/114 |
| Navegador | 382/383 (a única falha foi timeout, depois validado como instabilidade) |
| Unitários | 329 |
| Typecheck | OK |
| Build | OK |
| Fidelidade | OK |

**Migrations da U8** (aplicadas em staging e produção):
- `20260914100000`
- `20260914110000`
- `20260914120000`

**Pagamento simulado proibido em produção.** O banco recusa para qualquer papel fora do ambiente marcado como staging.

**Limitações atuais:**
- pagamento real inexistente;
- frete real inexistente;
- CEP manual ou simulado;
- taxa de pagamento ainda não trata o frete integralmente;
- comprador sem recuperação de senha e sem endereço persistido;
- fiscal/NF-e não implementado;
- reembolso real não implementado;
- problema legado do Dashboard da Saporino continua fora do escopo.

---

## 6. Roadmap atual

| Unidade | Tema | Situação |
|---|---|---|
| U8 | Carrinho multiloja, checkout e pedido | **APROVADA** (`ef85672`) |
| **U9** | **Mercado Pago real** | **PRÓXIMA** (iniciada pelo PM em comando separado) |
| U10 | LiVRE Entrega / CD / transportadoras | depois da U9 |
| U11 | Primeiro ciclo real ponta a ponta, controlado | depois da U10 |
| — | Growth / creators / LiVRE LiVE | depois da U11 |

---

## 7. Onde retomar

1. Ler este documento e o RAIO-X inteiros.
2. Conferir no Git que o último commit de unidade é `ef85672` (ou posterior, registrado aqui).
3. Conferir o staging com `node scripts/coffeelivre-staging.mjs verificar`, que deve dizer "STAGING CONFERE COM PRODUÇÃO".
4. Aguardar o comando do PM para a Unidade 9.
