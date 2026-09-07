-- =====================================================================
-- Dimensões de postagem, com o mínimo dos Correios (08/09/2026)
--
-- Dois problemas de uma vez:
--
--   1. Estávamos cotando frete com as medidas do BLOCO de pacotes. O que
--      viaja é o envelope, que é maior. Medida menor que a real vira frete
--      cobrado a menos, e a diferença sai do nosso bolso.
--
--   2. Correios exigem no mínimo 16 cm no maior lado. Nosso bloco de um
--      pacote tem 15 cm — PAC e SEDEX recusam a postagem no guichê. Loggi e
--      Jadlog não exigem, mas o cadastro precisa servir para todos, senão
--      alguém vai despachar com a medida errada num dia corrido.
--
-- Por isso as dimensões de postagem ficam em campos próprios, com piso.
-- =====================================================================

alter table public.packaging_specs
  add column if not exists ship_w_cm numeric(6,1),
  add column if not exists ship_d_cm numeric(6,1),
  add column if not exists ship_h_cm numeric(6,1);

comment on column public.packaging_specs.ship_w_cm is
  'Medida declarada na postagem, ja com folga do envelope e o minimo de 16 cm dos Correios. Diferente do bloco de pacotes, que e so o conteudo.';

-- Ponto de partida: o bloco com folga, e o maior lado forçado a 16 cm.
-- A altura é a dimensão que ganha o piso porque é a que fica mais perto do
-- limite (15 cm) sem alterar o formato do pacote.
update public.packaging_specs set
  ship_w_cm = greatest(coalesce(block_w_cm, 0) + 1, 16),
  ship_d_cm = greatest(coalesce(block_d_cm, 0) + 1, 2),
  ship_h_cm = greatest(coalesce(block_h_cm, 0) + 1, 16)
where ship_w_cm is null;

-- ---------------------------------------------------------------------
-- Trava: nenhuma medida de postagem abaixo do mínimo dos Correios
-- ---------------------------------------------------------------------
-- Fica no banco, e não só na tela, porque quem edita pode ser outra pessoa
-- num dia corrido — e o erro só aparece quando o pacote é recusado no guichê.
alter table public.packaging_specs
  drop constraint if exists packaging_specs_minimo_correios;

alter table public.packaging_specs
  add constraint packaging_specs_minimo_correios check (
    ship_w_cm is null or ship_d_cm is null or ship_h_cm is null
    or (greatest(ship_w_cm, ship_d_cm, ship_h_cm) >= 16
        and least(ship_w_cm, ship_d_cm, ship_h_cm) >= 2
        and ship_w_cm + ship_d_cm + ship_h_cm <= 200)
  );

comment on constraint packaging_specs_minimo_correios on public.packaging_specs is
  'Correios: maior lado >= 16 cm, menor lado >= 2 cm, soma dos lados <= 200 cm. Fora disso a postagem e recusada.';
