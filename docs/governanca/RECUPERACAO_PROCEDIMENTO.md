# Recuperação — o que está protegido, o que não está, e como voltar

**Escrito em 23/10/2026.** Substitui a suposição de que "o Supabase faz backup"
por uma descrição do que ele faz e do que não faz.

---

## O que descobrimos, e muda o plano

A tela de backups do Supabase avisa, com todas as letras:

> *"Storage objects are not included. Database backups do not include objects
> stored via the Storage API."*

Traduzindo para o que isso significa aqui: **restaurar um backup traz a ficha
do pedido e não traz a nota fiscal dele.** O banco guarda quem é o cliente,
qual pedido, qual valor; os papéis que provam o que aconteceu ficam de fora.

Por isso a proteção é em **duas pernas**, e elas se recuperam de maneiras
diferentes.

---

## Perna 1 — o banco

| | |
|---|---|
| Quem faz | Supabase, automático |
| Frequência | diária, por volta da meia-noite da região |
| Retenção observada | 8 dias (13 a 20/10 na conferência de 20/10/2026) |
| Point in time | existe como aba no painel |
| Restaurar para projeto novo | existe (`Restore to new project`, em beta) |
| **Já foi testado?** | **NÃO** — ver "o que falta", abaixo |

**Onde:** painel do Supabase → Database → Backups.

## Perna 2 — os arquivos do Storage

| | |
|---|---|
| Quem faz | `scripts/backup-storage.mjs`, à mão ou agendado |
| Cobertura | **13 buckets, 207 arquivos, 298,7 MB** (medido em 23/10/2026) |
| Primeira cópia | feita em 23/10/2026, 207 de 207, zero divergência |
| Cópias seguintes | incrementais — a segunda rodada levou **4 segundos** |
| Destino | `C:\Users\vlade\OneDrive\Documents\BACKUP_STORAGE_SAPORINO` |

**O que há nesses arquivos:** nota fiscal, boleto, comprovante, canhoto de
entrega, documento de representante, documento de lote, foto de visita, foto
de produto e as artes do Studio. São os papéis que não se refazem.

```bash
node scripts/backup-storage.mjs --medir    # só mede
node scripts/backup-storage.mjs            # copia o que falta
```

**O script nunca apaga nada.** Arquivo que sumiu da origem continua na cópia e
é apontado no relatório — sumiço é exatamente a situação em que a cópia vale.

> ⚠️ O destino fica dentro do OneDrive, então a cópia sobe para a nuvem
> sozinha. Isso é bom (vira cópia fora da máquina) e é preciso saber: são
> documentos fiscais e dados de cliente indo para a conta pessoal dele.

---

## Como voltar, se precisar

### Caso A — perdi dados do banco (apagou sem querer, migration ruim)

1. Painel → Database → Backups → escolher a data **anterior ao problema**.
2. **Restaurar para PROJETO NOVO**, nunca por cima da produção. O projeto novo
   é descartável e custa pouco por algumas horas.
3. Conferir no projeto novo, com os números do dia:
   ```sql
   select count(*) from information_schema.tables where table_schema='public';
   select count(*) from representative_orders;
   select count(*) from orders;
   ```
4. Tirar do projeto novo **só o que faltava** e trazer para produção.
5. Apagar o projeto novo.

**Por que não restaurar direto por cima:** a restauração volta o banco INTEIRO
para aquela data. Tudo que aconteceu depois desaparece. Quase sempre o que se
quer é uma tabela, não o dia inteiro.

### Caso B — perdi arquivos do Storage

Estão na cópia local, com o mesmo caminho da origem:

```
BACKUP_STORAGE_SAPORINO/invoices/canhoto/<id-do-pedido>/<arquivo>
```

Subir de volta pelo painel do Supabase ou pela API, no mesmo caminho. O
`_manifesto.json` diz quando cada arquivo foi copiado.

### Caso C — perdi o projeto inteiro

Banco pela restauração (Caso A), arquivos pela cópia (Caso B), código pelo
GitHub, e as funções com `npx supabase functions deploy`. As **migrations
estão versionadas** — 196 arquivos —, então a estrutura se refaz do git.

---

## O que falta, e é honesto dizer

| Pendência | Por quê |
|---|---|
| **A restauração nunca foi testada** | Precisa criar um projeto Supabase temporário. É custo novo, ainda que pequeno e por poucas horas — por isso espera autorização. |
| **A cópia do Storage não é automática** | Hoje alguém roda o comando. Agendar exige uma máquina ligada ou um serviço. |
| **Não há cópia fora do computador dele** | O OneDrive sincroniza, o que já é alguma coisa, mas as duas cópias estão sob a mesma conta. |

**Backup nunca restaurado não é backup — é esperança.** A perna 2 foi criada e
conferida hoje; a perna 1 continua não testada, e isso é o próximo passo
quando houver autorização para o projeto temporário.
