-- =====================================================================
-- Studio: separar NOSSAS MARCAS de CONTAS DE CLIENTE (16/10/2026)
--
-- Hoje as seis marcas vivem no mesmo balaio: Saporino, Tropeiro Paulista,
-- Serrão, Café do Amor, COFICO e Coffee LiVRE. Algumas são da casa, outras não,
-- e NADA no sistema diz qual é qual.
--
-- Com cliente de verdade entrando (o primeiro é o Fino Paladar) isso deixa de
-- ser desorganização e vira risco: o dia em que um post do cliente sair na
-- conta da Saporino, o estrago é com o cliente DELE. Já houve um susto assim —
-- a peça da Capital saiu como Saporino.
--
-- A separação é etiqueta no banco, não aba bonita na tela: é dela que a trava
-- de publicação pode partir depois.
-- =====================================================================

alter table public.studio_brand_profiles
  add column if not exists tipo text not null default 'propria',
  add column if not exists cliente_nome text,
  add column if not exists cliente_contato text,
  add column if not exists cliente_desde date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'studio_brand_profiles_tipo_check') then
    alter table public.studio_brand_profiles
      add constraint studio_brand_profiles_tipo_check check (tipo in ('propria', 'cliente'));
  end if;
end $$;

comment on column public.studio_brand_profiles.tipo is
  'propria = marca da casa (Saporino, Tropeiro, COFICO...). cliente = conta de terceiro que a COFICO gerencia como serviço.';
comment on column public.studio_brand_profiles.cliente_nome is
  'Razão social ou nome do cliente dono da conta. Nulo quando tipo = propria.';

-- As seis marcas existentes seguem como 'propria' pelo default. Nenhuma muda de
-- lugar, nenhuma conexão se perde — a coluna nasce preenchida com o que elas já
-- eram na prática.

create index if not exists studio_brand_profiles_tipo_idx
  on public.studio_brand_profiles (tipo, ordem);
