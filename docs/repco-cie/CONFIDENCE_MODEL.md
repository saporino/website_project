# CONFIDENCE_MODEL — RepCo C.I.E.
**Não** pedir "dê uma confiança 0-100" ao LLM e usar cru. Confiança é **calculada** a partir de fatores objetivos (§10.4).

## Fatores
- qualidade da fonte (primária > secundária > claim);
- tamanho da amostra (nº de comentários/posts que sustentam);
- frescor (idade da captura);
- cobertura/diversidade de segmentos;
- concordância entre métodos/modelos;
- revisão humana (sim/não);
- precisão histórica do modelo naquela categoria;
- desempenho fora da amostra;
- contradições/evidência contrária;
- viés estimado.

## Fórmula de referência (ajustável)
```
confidence = w1*source_quality + w2*sample_score + w3*freshness
           + w4*coverage + w5*method_agreement + w6*human_review
           - penalty(contradictions) - penalty(bias)
```
Normalizar 0-1. Pesos revisáveis; registrar versão do modelo de confiança.

## Evidence Ladder (mostrar sempre o nível)
| Nível | Exemplo |
|---|---|
| 1. Observação | "42% da amostra mencionou família/avó" |
| 2. Interpretação | "Nostalgia parece relevante nesse conjunto" |
| 3. Previsão | "Conteúdo nostálgico pode elevar shares" |
| 4. Evidência causal | "Em teste controlado, variante nostálgica deu uplift" |

O painel deve exibir o nível e nunca subir de degrau sem experimento.

## Regras
- Confiança sempre acompanhada de amostra e limitações.
- Amostra pequena/enviesada → alerta explícito.
- `HYPOTHESIS` nunca vira `VERIFIED_*` sem experimento (nível 4).
