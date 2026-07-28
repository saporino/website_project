# DECISIONS_REQUIRED_FROM_OWNER — RepCo C.I.E.
Decisões que **dependem do Vlademir** antes de eu implementar. Nada avança sem estas respostas.

## Prioridade / sequência
1. **Ordem de trabalho:** terminar o MASTER_BRIEFING (ITEM 4 Marketing + ITEM 5 Comentários) **antes**, ou pausar e focar no C.I.E. agora?
   - Nota: o **ITEM 5 (análise de comentários)** do MASTER_BRIEFING **já é** o Lote B do C.I.E. — dá pra unificar.

## Infra
2. **Habilitar `pgvector`** (embeddings/busca semântica)? É aditivo e reversível.
3. Manter tudo em **Edge Functions (Deno)** ou aceitar um serviço **Python/FastAPI** só para ingestão pesada de comentários? (Recomendo começar em Deno.)

## Fontes de dados
4. **Criar `YOUTUBE_API_KEY`** (Google Cloud, grátis) para ser a 1ª fonte pública de comentários? (Recomendo: sim.)
5. Confirmar que podemos usar **comentários do IG próprio** (@cafesaporino) para análise.
6. Orçamento mensal-teto para Apify/Claude/Whisper no piloto (ex.: US$50/mês?).

## Privacidade/LGPD
7. Contratar/consultar **advogado** para o teste de legítimo interesse e política de privacidade?
8. **Prazo de retenção** do texto original de comentários (sugestão: guardar só redigido + hash; original por X dias se necessário).

## Marca
9. Aprovar `brand_rules` duras (ex.: proibir "zero amargor"; usar "perfil mais suave" só quando confirmado por laudo).

## Piloto
10. Quais fatias do **piloto de 90 dias** (§23) topa começar (narrativa A/B, educação, creators, recompra)?

## Governança confirmada (não muda)
- Sem instalar/comprar/publicar/enviar mensagem/alterar produção sem aprovação.
- Branch + backup + lotes pequenos + testes + aprovação.
- Nada publica automaticamente; hipótese ≠ fato.
