-- Complemento da 20260913170000: o vendedor fictício "Torrefação Ponte Velha"
-- nasceu da candidatura de demonstração da Unidade 6 e tem e-mail no domínio
-- reservado de teste `pontevelha.teste`. A migration anterior exigia e-mail
-- vazio e não alterou nada. Aqui o e-mail é aceito SOMENTE se o domínio terminar
-- em `.teste` ou `.test` (nunca um endereço entregável), sem CNPJ e sem telefone.

update public.lv_sellers
   set is_demo = true
 where nome_fantasia = 'Torrefação Ponte Velha'
   and is_demo = false
   and cnpj is null and telefone is null
   and (email is null or email ~* '@[a-z0-9.-]+\.(teste|test)$');

update public.lv_stores s
   set is_demo = true
 where s.slug = 'torrefacao-ponte-velha'
   and s.is_demo = false
   and exists (select 1 from public.lv_sellers v where v.id = s.seller_id and v.is_demo);
