-- =====================================================================
-- Embalagem de envio: dimensões e tara (08/09/2026)
--
-- O frete agora é cobrado por faixa de peso de verdade, então o peso
-- declarado precisa ser o BRUTO: café + envelope. Cadastrar só o peso
-- líquido subestima o frete — foi exatamente o erro encontrado na loja
-- do concorrente durante o levantamento de mercado.
--
-- As dimensões vêm do arranjo real dos pacotes de 11 × 7 × 15 cm dentro
-- do envelope de segurança usado na expedição.
-- =====================================================================

create table if not exists public.packaging_specs (
  id            uuid primary key default gen_random_uuid(),
  -- Quantos pacotes de 500 g vão dentro.
  units         integer not null unique,
  -- Bloco formado pelos pacotes, em cm.
  block_w_cm    numeric(6,1),
  block_d_cm    numeric(6,1),
  block_h_cm    numeric(6,1),
  -- Envelope de segurança indicado, em cm.
  envelope      text,
  -- Peso do envelope vazio, em gramas. É isto que entra no peso bruto.
  tare_g        integer not null,
  -- Linha estimada por extrapolação, ainda não confirmada na balança.
  is_estimate   boolean not null default false,
  notes         text
);

comment on table public.packaging_specs is
  'Dimensoes do bloco e peso do envelope por quantidade de pacotes. O frete usa peso BRUTO (cafe + envelope): declarar so o liquido subestima o frete.';

insert into public.packaging_specs (units, block_w_cm, block_d_cm, block_h_cm, envelope, tare_g, is_estimate, notes) values
  (1,  11, 7,  15, '20 × 30 cm', 12, true,
   'Estimado: o levantamento comeca em 2 unidades. Conferir na balanca.'),
  (2,  22, 7,  15, '30 × 40 cm', 20, false,
   'Dois lado a lado. Envelope 26x36 serve; 30x40 e o coringa, com folga para bolha e nota.'),
  (3,  33, 7,  15, '35 × 45 cm', 32, false,
   'Tres em fileira. A largura chega a 33 cm, entao 32x40 fica no limite — 35x45 e mais seguro.'),
  (4,  22, 14, 15, '40 × 50 cm', 50, false,
   'Bloco 2 na frente e 2 atras. Espessura sobe para 14 cm.'),
  (10, 55, 14, 15, '60 × 60 cm', 95, true,
   'Fardo de 5 kg, extrapolado do arranjo de 4 (cinco de largura, dois de profundidade). Conferir envelope e balanca antes de vender.')
on conflict (units) do nothing;

-- ---------------------------------------------------------------------
-- Peso bruto de um envio
-- ---------------------------------------------------------------------
-- Entre duas faixas cadastradas, usa a maior mais próxima; acima da última,
-- extrapola pela tara por unidade da última faixa. Melhor errar para mais:
-- tara subestimada vira frete cobrado a menos, que sai do nosso bolso.
create or replace function public.peso_bruto_kg(p_unidades integer, p_g_por_unidade integer default 500)
returns numeric
language plpgsql
stable
as $$
declare
  v_tara integer;
  v_ult  record;
begin
  if coalesce(p_unidades, 0) <= 0 then return 0; end if;

  select tare_g into v_tara from public.packaging_specs
   where units >= p_unidades order by units limit 1;

  if v_tara is null then
    select units, tare_g into v_ult from public.packaging_specs order by units desc limit 1;
    v_tara := ceil(v_ult.tare_g::numeric / v_ult.units * p_unidades);
  end if;

  return round((p_unidades * p_g_por_unidade + v_tara)::numeric / 1000.0, 3);
end $$;

comment on function public.peso_bruto_kg is
  'Peso bruto em kg (cafe + envelope) para uma quantidade de pacotes. E este peso que vai para a cotacao de frete.';

grant execute on function public.peso_bruto_kg(integer, integer) to anon, authenticated, service_role;

alter table public.packaging_specs enable row level security;

drop policy if exists ps_leitura on public.packaging_specs;
create policy ps_leitura on public.packaging_specs for select to anon, authenticated using (true);

drop policy if exists ps_admin on public.packaging_specs;
create policy ps_admin on public.packaging_specs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
