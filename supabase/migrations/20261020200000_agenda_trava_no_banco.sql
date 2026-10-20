-- =====================================================================
-- A agenda ganha trava NO BANCO, não só na tela (20/10/2026)
--
-- O QUE ELE VIU. Dia 19 com cinco peças, duas às 08:00 e duas às 15:00.
-- Eu havia dito que estava corrigido, e ele cobrou. Fui conferir no banco.
--
-- O QUE A CONFERÊNCIA MOSTROU. A correção FUNCIONA: o dia 20 nasceu com
-- exatamente três sugestões, uma por janela. Tudo que passa de três foi
-- criado em 19/10, em duas rodadas (20:29 e 21:18), ANTES da correção. Era
-- resíduo acumulado, não geração nova.
--
-- MAS A CONFERÊNCIA EXPÔS OUTRA COISA, essa sim um defeito de verdade: a
-- regra "uma arte por janela" vivia SÓ no TypeScript da tela. Banco que
-- aceita duplicata transforma regra de negócio em promessa — basta uma aba
-- aberta duas vezes, um clique duplo, uma reexecução, ou um dia em que eu
-- mexa no código e esqueça da regra.
--
-- A trava passa a ser do banco. Duas garantias:
--
--   1. ÍNDICE ÚNICO por (marca, instante). Duas sugestões ativas no mesmo
--      horário da mesma marca deixam de ser possíveis, venha de onde vier.
--   2. A MESMA ARTE não entra duas vezes na fila ativa.
--
-- Ambos são PARCIAIS (`where status in (...)`): sugestão rejeitada ou já
-- publicada não ocupa lugar, e o histórico continua intacto.
--
-- NADA É APAGADO aqui. O resíduo de 19/10 é tratado à parte, com o número
-- na mão e a decisão sendo dele.
-- =====================================================================

-- Antes de criar o índice, é preciso saber se os dados atuais o violam.
-- Criar índice único sobre dado duplicado FALHA — e falhar aqui é melhor do
-- que descobrir em produção, mas falhar sem explicação não ajuda ninguém.
do $$
declare
  repetidos int;
begin
  select count(*) into repetidos from (
    select brand_id, sugerido_para
      from public.studio_sugestoes
     where status in ('sugerida', 'aprovada')
     group by brand_id, sugerido_para
    having count(*) > 1
  ) x;

  if repetidos > 0 then
    raise exception
      'Existem % horários com mais de uma sugestão ativa. O índice único não pode ser criado sobre dado duplicado. Resolva o resíduo antes (ver scripts/agenda-residuo.mjs).', repetidos;
  end if;
end $$;

-- 1. Uma arte por janela: o mesmo instante não recebe duas peças da marca.
create unique index if not exists uq_studio_sugestoes_janela
  on public.studio_sugestoes (brand_id, sugerido_para)
  where status in ('sugerida', 'aprovada');

comment on index public.uq_studio_sugestoes_janela is
  'Impede duas sugestões ativas no mesmo horário da mesma marca. A regra dos 3 por dia (08/15/19) vivia só no TypeScript; aqui ela passa a ser garantida pelo banco.';

-- 2. A mesma arte não entra duas vezes na fila ativa.
create unique index if not exists uq_studio_sugestoes_arte_ativa
  on public.studio_sugestoes (brand_id, video_id)
  where status in ('sugerida', 'aprovada');

comment on index public.uq_studio_sugestoes_arte_ativa is
  'A mesma arte não pode estar agendada duas vezes ao mesmo tempo. Rejeitada ou publicada não ocupa lugar: os índices são parciais.';
