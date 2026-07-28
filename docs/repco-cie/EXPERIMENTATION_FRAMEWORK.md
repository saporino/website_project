# EXPERIMENTATION_FRAMEWORK — RepCo C.I.E.
Do sinal à decisão comprovada. **Não otimizar só por views** — priorizar venda incremental, recompra, margem.

## Estrutura da hipótese (§13.1)
```
HIPÓTESE: <afirmação testável>
BASE: comentários/histórico/benchmark
EXPLICAÇÕES ALTERNATIVAS: ator, música, mídia paga, duração, horário, tema
PÚBLICO: <segmento>
VARIANTE A (controle) / VARIANTE B (tratamento)
MÉTRICA PRINCIPAL: ex. shares por 1.000 views
SECUNDÁRIAS: retenção, comentários pessoais, visitas, clique, compra
JANELA / CRITÉRIO DE SUCESSO / CRITÉRIO DE PARADA
RESULTADO / APRENDIZADO → Market Memory
```

## Tipos de experimento
conteúdo A/B, landing page, preço, kit, frete, embalagem, título, foto, CTA, influenciador, público, canal, cupom, reposição, atendimento, exposição em loja.

## Métricas a priorizar (§13.3)
venda incremental · lead · distribuição · **recompra** · margem · retenção · custo por comprador · qualidade da audiência.

## Medição honesta
- grupo tratado × **controle**;
- uplift **incremental** (não vaidade);
- registrar custo e opt-out;
- mediana, não só média.

## Ligações no produto
- Origem do experimento: hipótese vinda do Evidence Graph / comentários.
- Execução: campanha no **Studio** + UTM/cupom + landing.
- Resultado: eventos de e-commerce/RepCo.
- Aprendizado: `cie_market_memory` com validade temporal.

## Exemplo (piloto Saporino)
> H: conteúdos em que alguém serve café à família geram mais shares/1k views que produto isolado.
> A: produto isolado · B: ritual servindo à família · métrica: shares/1k views · janela: 14 dias · controle: sim.
