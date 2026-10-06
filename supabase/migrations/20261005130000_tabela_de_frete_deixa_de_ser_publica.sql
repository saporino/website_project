-- A TABELA DE FRETE SAI DO AR PÚBLICO.
--
-- Auditoria de 05/10/2026: `shipping_rates` (441 linhas de preço por zona e faixa de peso),
-- `shipping_rate_tables` (percentual de seguro, GRIS e piso) e `shipping_coverage` estavam
-- liberadas para QUALQUER visitante, sem login. Quem soubesse o endereço do site baixava a
-- política de frete inteira — isso é preço comercial, não dado de catálogo.
--
-- Regra do Vlademir: "o cliente não vê a tabela, ele só vê o frete do CEP do endereço dele,
-- e escolhe entre Correios ou os parceiros cadastrados".
--
-- Por que nada quebra: o cálculo nunca foi no navegador. Ele já mora em `cotar_frete`, que é
-- SECURITY DEFINER — lê a tabela com os poderes da função, não os de quem chamou, e devolve
-- SÓ a linha daquele CEP e peso. O front lia a tabela apenas para descobrir qual está ativa;
-- isso vira a função `tabela_de_frete_ativa()`, que devolve o id e mais nada.

-- ------------------------------------------------- o mínimo que o checkout precisa saber
create or replace function public.tabela_de_frete_ativa()
returns table (id uuid, allow_discount boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.allow_discount
    from public.shipping_rate_tables t
   where t.is_active
   order by t.created_at
   limit 1
$$;
comment on function public.tabela_de_frete_ativa() is
  'Qual tabela de frete esta valendo. Devolve so o id e se aceita desconto - nunca os precos.';
grant execute on function public.tabela_de_frete_ativa() to anon, authenticated;

-- ------------------------------------------------------------- fecha a leitura pública
drop policy if exists shipping_rates_leitura        on public.shipping_rates;
drop policy if exists shipping_rate_tables_leitura  on public.shipping_rate_tables;
drop policy if exists shipping_coverage_leitura     on public.shipping_coverage;

-- Admin continua mandando (as políticas de admin já existem; estas garantem o caso de a
-- tabela ter ficado só com a policy pública).
do $$
declare t text;
begin
  foreach t in array array['shipping_rates','shipping_rate_tables','shipping_coverage'] loop
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format(
      'create policy %I_admin on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;
