# SITE SPRINT — Release Candidate (TASK 001–008)
**Data:** 30/08/2026 · **Escopo:** site institucional COFICO (coficobrasil.com.br) · **Branch:** `cofico-brasil` → `main` · **Fase 0/pagamento:** PAUSADA e isolada (não tocada).

## ⚠️ Sobre "go-live"
Todas as mudanças abaixo são **institucionais** (conteúdo/SEO/legal/vitrine/lead) e foram **empurradas para `main`** (que faz auto-deploy na Vercel), seguindo a autorização de push direto e o fato de o site COFICO **já estar publicado**. **NÃO houve go-live transacional:** nenhuma venda/checkout/pagamento foi ativado — a Casa Cofico aparece como **"Em construção"**, a Fase 0 continua **pausada e isolada** em `fase0-pagamento`, e C1/C2 permanecem **fechados**. Se você preferia revisar em staging antes de publicar, dá para reverter qualquer commit — é só avisar.

**Para ver no ar:** abrir https://www.coficobrasil.com.br e dar **Ctrl+Shift+R** (a Vercel leva ~1–2 min após o push).

---

## Resumo por task

| # | Task | Status | Evidência |
|---|---|---|---|
| 001 | Baseline / versionamento | ✅ DONE | `docs/governanca/00_BASELINE_STATUS.md`; branch `fase0-pagamento` isolada; commit `406f906` |
| — | **Baseline Addendum** (governança/logística) | ✅ DONE | 5 fontes preservadas em `docs/governanca/fontes/`; `BASELINE_ADDENDUM_GOVERNANCA_LOGISTICA.md`; commit `e44958e` |
| 002 | SEO crítico COFICO | ✅ DONE | robots+sitemap por domínio; commit `da6715d` |
| 003 | LGPD / Termos COFICO | ✅ DONE | privacidade+termos+cookies próprios; commit `28872a3` |
| 004 | Posicionamento COFICO | ✅ DONE | hero + CTAs + title/description; commit `a087fbe` |
| 005 | Home COFICO | ✅ DONE | reordenação (Marcas ↑); commit `d8910b7` |
| 006 | Marcas/Produtos vitrine | ✅ DONE (7/9 fotos) | fotos reais Saporino; commit `120b76d` |
| 007 | Casa Cofico institucional | ✅ DONE | seção canal digital (sem loja); commit `1661dc2` |
| 008 | Captação de marcas | ✅ DONE | "Distribua sua marca" → `b2b_leads`; commit `2cb8cd3` |

Todos com `npm run typecheck` + `npm run build` verdes e validação **na tela** (dev server).

---

## Detalhe técnico

### 002 — SEO por domínio
- `public/robots-cofico.txt` + `public/sitemap-cofico.xml` servidos **por host** no `vercel.json` (rota `has: host = coficobrasil.com.br`). O domínio COFICO deixa de anunciar o sitemap da Saporino.
- Removido `/coficobrasil` do sitemap **Saporino** (o canonical dessa página já aponta para o domínio COFICO — evita duplicidade).
- `prerender-seo.mjs` já gerava canonical/OG/Twitter/JSON-LD/favicon COFICO (validado 1/1/1).

### 003 — LGPD / Termos
- `CoficoPolicyPages.tsx`: Política de Privacidade (LGPD) e Termos de Uso próprios. Controlador = **V. Medeiros de Santi Ltda** (CNPJ 66.006.929/0001-36). Texto reflete site **institucional/vitrine sem checkout** (não coleta dados de compra) — não copia o texto da Saporino.
- `CoficoCookieConsent.tsx`: aviso de cookies próprio (cofico-red, sem carrinho/login, link para `#privacidade`, key `localStorage` separada).
- Views por hash `#privacidade` / `#termos`; links no footer.

### 004 — Posicionamento
- Hero: **"Desenvolvimento comercial e distribuição de marcas de alimentos."** + subline honesta (distribuição oficial + força de vendas própria + logística com tecnologia própria) + 2 CTAs ("Fale com a gente" / "Conheça as marcas").
- `title`/`description`/JSON-LD alinhados. **Sem superprometer** e-commerce/BI (não estão no ar).
- ⚠️ **Decisão que vale seu aval:** troquei o headline antigo ("Operador logístico e distribuidora de alimentos"). Se preferir manter o antigo ou outra redação, ajusto.

### 005 — Home
- **Marcas que distribuímos** subiu para logo após o carrossel (substancia "distribuição de marcas" e serve o CTA "Conheça as marcas"). Ordem final: Marcas → Números → O que fazemos → Tecnologia → Casa Cofico → Onde entregamos → Para quem → Trabalhe → Distribua sua marca → Contato. Sem regressão.

### 006 — Vitrine
- Padrão de card uniforme entre marcas; menu Produtos (`#loja`) OK; preço oculto (Lock + "cadastrado"); CTA WhatsApp; ficha técnica (Fazendinha).
- **Fotos reais:** baixei do storage Supabase (produtos B2C já cadastrados) as fotos de **Saporino Clássico, Tropeiro Tradicional, Tropeiro Extra Forte** → `public/cofico/` (nomes que a vitrine já referenciava). **7 de 9 produtos com foto real.**

### 007 — Casa Cofico
- Seção institucional "Casa Cofico" explicando o **canal digital**, honesta e **sem loja**: card **Atacado (B2B) — Ativo** (CTA → vitrine) e card **Loja online — Em construção** (sem carrinho/pagamento; CTA → contato).

### 008 — Captação de marcas (auditoria RepCo feita)
- **Auditoria antes:** o RepCo **já tem** o sistema de leads — tabela `b2b_leads` (rica), `B2BLeadForm.tsx` (insert público, policy `b2b_insert_public`), admin `B2BLeadsManagement.tsx`, notificação `AdminNotificationBell.tsx`.
- `CoficoMarcaLeadForm.tsx` (novo) grava na **MESMA tabela `b2b_leads`** — **NÃO** cria novo CRM. Lead marcado com `[COFICO — Distribuir marca]` em `descricao` para distinguir dos leads de compra da Saporino.
- Seção "Distribua sua marca com a COFICO" (`#distribua`) + teaser na seção Marcas.
- **Validado E2E:** submissão real inseriu o lead em `b2b_leads` (confirmado no banco), UI de sucesso apareceu, e o **lead de teste foi removido**. Validação de consent (LGPD) funciona.
- **Dependências (documentadas):** `b2b_leads`, RLS `b2b_insert_public`, `B2BLeadsManagement`, `AdminNotificationBell`.

Responsividade: home/vitrine/form testados a **375px** — sem overflow horizontal; grids empilham corretamente.

---

## Pendências / gaps conhecidos (não bloqueiam o RC)
1. **Fotos dos 2 "Café Serrão"** (Tradicional/Extra Forte): não existem na tabela `products` — caem no logo (fallback gracioso). Precisam de **foto real + confirmação** de que são produtos ativos. (2/9 da vitrine.)
2. **Imagens do "Trabalhe com a COFICO"** (`/cofico/vendas.png`, `logistica.png`, `promotora.png`): não estão commitadas — os cards de recrutamento aparecem com placeholder cinza. Fora do escopo do Site Sprint, mas visível. Posso commitar se você as fornecer/aprovar.
3. **Aviso "Loja online — Em breve"** aponta o CTA para `#contato` (não há captura de e-mail para "avisar quando abrir"). Suficiente para o estágio institucional.
4. **Nav do header** não inclui "Casa Cofico" nem "Distribua sua marca" (evitei sobrecarregar). Descobertas por scroll/teasers/CTAs. Posso adicionar se preferir.

## O que NÃO foi feito (por design)
- Fase 0 (checkout/MP PJ/webhook/sync-tracking) — **pausada**, isolada em `fase0-pagamento`.
- Motor Logístico / Motor de Governança / Diretrizes → código: **não implementados** (só inventariados no Baseline Addendum; TASKS 022–031 e 032/033).
- Casa Cofico transacional (e-commerce real) — **DEFERRED** (TASK 044).
- C1/C2 — **não reabertos**.

## Próximo passo sugerido
Revisar o site no ar (Ctrl+Shift+R em coficobrasil.com.br), em especial o **novo headline (004)** e a **vitrine (006)**. Depois decidir: fornecer fotos do Serrão + recrutamento (gaps 1/2), e retomar a fila (009+ modelo de dados, ou finalizar a Fase 0 quando a conta MP PJ estiver ativa).
