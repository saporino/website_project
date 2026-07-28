# MIGRATION_AND_ROLLBACK_PLAN — RepCo C.I.E.
Preservar o que funciona. Toda mudança: **branch → backup → lote pequeno → teste → aprovação → merge**.

## Estratégia de branch
- Trabalho do C.I.E. no branch **`repco-cie`** (este). Documentação já aqui.
- Código só depois de aprovação, em sub-lotes (A, B, C, D do MVP).
- Merge em `main` = deploy Vercel; portanto só após `typecheck`+`build`+testes verdes + ok do dono.

## Backup antes de qualquer DDL
- Supabase tem backup automático (point-in-time no plano). Confirmar janela.
- Antes de criar tabelas `cie_*`: snapshot lógico das tabelas afetadas (nenhuma tabela existente é alterada no MVP — só criação aditiva).
- Migrações registradas em `supabase/migrations/` + aplicadas via `exec_migration`.

## Aditividade (chave do baixo risco)
- **Não** alterar/renomear tabelas existentes no MVP. Só **criar** `cie_*` e habilitar `pgvector`.
- UI nova atrás de `feature_flags.cie_enabled` — desligada = produto atual intacto.

## Rollback por lote
| Lote | Rollback |
|---|---|
| A (tabelas/pgvector/flag) | `drop table cie_*`; desabilitar flag; extensão pode ficar (inócua) |
| B (comentários) | desligar flag; dados ficam isolados; sem impacto no Studio |
| C (evidência/painel) | esconder aba via flag |
| D (experimento/memória) | desligar flag; campanhas do Studio seguem normais |

## Gatilhos de rollback
erro em produção · custo acima do orçamento · qualquer regressão no Studio/RepCo · incidente de dados.

## Itens de produção a religar no go-live (do backlog existente)
- Religar trava de exclusão de cliente com pedidos (hoje OFF em teste).
- RLS multi-tenant por `company_id` antes de terceiros.
