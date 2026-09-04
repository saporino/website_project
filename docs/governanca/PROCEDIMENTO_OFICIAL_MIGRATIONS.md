# Procedimento oficial de migrations — RepCo / COFICO

**Vigente desde:** 04/09/2026 (Fase B do ciclo Coffee Network)
**Projeto:** `rsvoazrkxtdrcjnatzcm` · **Histórico oficial:** `supabase_migrations.schema_migrations`

---

## O que mudou

Até 03/09/2026 o schema era aplicado à mão, chamando o RPC `exec_migration`. Não havia histórico: a tabela `supabase_migrations.schema_migrations` não existia, e o Supabase CLI não sabia o que já tinha rodado.

Em 04/09/2026 o histórico foi normalizado:

| Item | Antes | Depois |
|---|---|---|
| Arquivos em `supabase/migrations/` | 67 | 67 (mesmos arquivos, renomeados) |
| Com versão válida de 14 dígitos | 48 | **67** |
| Ignorados pelo CLI por nome inválido | 19 | **0** |
| Versões duplicadas | 6 grupos (25 arquivos) | **0** |
| Linhas em `schema_migrations` | tabela inexistente | **68** |
| Migrations pendentes | indeterminado | **0** |

Os 47 arquivos com nome inválido ou versão duplicada foram renomeados com `git mv`, recebendo o timestamp do **primeiro commit do próprio arquivo no git**. Onde a data do nome já existia, ela foi preservada e apenas a hora foi completada. O conteúdo SQL não foi alterado em nenhum arquivo.

O histórico foi gravado com `supabase migration repair --status applied`, que **registra as versões sem executar o SQL**. Nenhuma migration antiga foi reaplicada.

---

## Regra permanente

**Toda mudança de banco passa a ser um arquivo de migration versionado e aplicado pelo CLI.**

`exec_migration` deixa de ser rotina. Ele permanece disponível para inspeção pontual e emergência, mas desde 04/09/2026 só pode ser chamado com a `service_role` — o acesso de `anon`, `authenticated` e `PUBLIC` foi revogado (Fase A).

---

## Como criar e aplicar uma migration

**1. Criar o arquivo**

```bash
npx supabase migration new nome_curto_em_snake_case
```

Isso gera `supabase/migrations/<timestamp>_nome_curto_em_snake_case.sql`. Nunca criar o arquivo à mão sem timestamp de 14 dígitos: o CLI ignora silenciosamente arquivos fora do padrão.

**2. Escrever o SQL**

Regras que valem para este projeto:

- Idempotente sempre que possível: `create table if not exists`, `drop policy if exists` antes de `create policy`, `alter table ... add column if not exists`.
- Toda tabela nova nasce com `alter table ... enable row level security` e pelo menos uma policy explícita na mesma migration. Tabela sem RLS não passa.
- Toda tabela do domínio de negócio carrega `company_id` quando pertence a uma empresa do ecossistema.
- Nada de `drop table` ou `drop column` sem que o mesmo arquivo documente o motivo em comentário.

**3. Conferir o que está pendente**

```bash
npx supabase migration list --linked
```

A coluna Local mostra o arquivo; a coluna Remote mostra o que produção já tem. Só deve haver diferença nas migrations que você acabou de criar.

**4. Aplicar**

```bash
npx supabase db push --linked
```

O CLI lista o que vai aplicar e pede confirmação. Ele aplica **apenas** as versões ausentes no remoto.

**5. Confirmar**

```bash
npx supabase migration list --linked
```

Zero linhas com Remote vazio.

---

## Situações especiais

**Uma migration foi aplicada por fora e agora o push quer reaplicá-la.**
Marque como aplicada sem executar:

```bash
npx supabase migration repair --status applied <versao>
```

**Uma migration foi registrada por engano e nunca rodou.**

```bash
npx supabase migration repair --status reverted <versao>
```

**Conectividade.** O CLI usa a credencial em cache em `supabase/.temp/pooler-url`. Se ela se perder, é preciso rodar `npx supabase link --project-ref rsvoazrkxtdrcjnatzcm`, que pede a senha do banco. Essa senha é HUMAN-ONLY: está no painel do Supabase, em Project Settings, Database.

---

## O que não fazer

- Não renomear migration já aplicada. A versão é a chave do histórico; renomear cria uma versão nova que o CLI vai tentar aplicar de novo.
- Não editar o conteúdo de migration já aplicada. Corrija com uma migration nova.
- Não usar `supabase db reset` contra o projeto remoto. Ele recria o banco do zero.
- Não voltar a usar `exec_migration` como rotina de deploy de schema.

---

## Verificação de saúde do histórico

```bash
npx supabase migration list --linked
```

Sinais de que algo saiu do lugar: qualquer linha `Skipping migration ...` (arquivo com nome inválido), qualquer linha com Remote vazio que você não acabou de criar, ou qualquer versão duplicada.
