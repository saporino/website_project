# TAXONOMY_V1 — `coffee_br_v1`
Taxonomia inicial multi-label para Arqueologia Emocional (do relatório §9.2). Versionada; toda label carrega `evidence_span` + `confidence`. Multi-label (um comentário pode ter várias).

| category | sinais exemplo | possível implicação |
|---|---|---|
| `nostalgia_memory` | "casa da minha avó", "meu pai fazia" | pertencimento, transmissão |
| `ritual_habit` | "todo dia cedo", "depois do almoço" | frequência, ocasião, reposição |
| `hidden_decider` | "compro pro meu marido" | comprador ≠ consumidor |
| `identity` | "café de verdade é coado" | tribo, resistência |
| `frustration` | "amargo", "perde o cheiro" | produto/preparo/expectativa |
| `objection` | "caro", "não encontro" | preço, distribuição |
| `latent_desire` | "queria em grãos", "descafeinado" | inovação de produto |
| `company_context` | "com minha mãe", "com colegas" | ocasião social |
| `context_moment` | trabalho, fazenda, frio, trânsito | segmentação por momento |
| `sensory` | aroma, corpo, acidez, doçura | linguagem do produto |
| `trust` | selo, procedência, validade | prova, redução de risco |
| `packaging` | abre/fecha, conserva, tamanho | desenvolvimento de produto |
| `service` | atraso, troca, resposta | operação |
| `repurchase` | "não achei de novo", "compro todo mês" | retenção |
| `comparison` | "melhor que X" | benchmark, posicionamento |

## Campos por label (saída §21)
`category, confidence, evidence_span` (+ `value` quando aplicável, ex. company_context=family).
Mais: `dominant_emotion{label,intensity_1_5}`, `latent_need{label,confidence}`, `purchase_signal`, `objection`, `pii_removed`, `model_version`, `taxonomy_version`, `human_review`.

## Regras de governança da taxonomia
- Versionar (`coffee_br_v1`, v2…); nunca reclassificar histórico silenciosamente.
- Ironia/spam/duplicidade tratados na normalização antes de classificar.
- Reprodutível: mesma entrada + mesma versão → mesma estrutura.
- Revisão humana amostral para calibrar precisão por categoria.
