-- "Torrefação Ponte Velha" é um vendedor FICTÍCIO da demonstração (um dos quatro
-- tradicionais da comparação de mercado da Unidade 7), mas o vendedor e a loja
-- foram criados fora de migration e ficaram com is_demo = false. Seus produtos
-- já são is_demo. Sem a marca, a loja fica fora do seed de demonstração e o
-- staging nasce com uma mediana diferente da de produção.
--
-- Só altera a linha se ela continuar sem dado pessoal (sem CNPJ, e-mail ou telefone).

update public.lv_sellers
   set is_demo = true
 where nome_fantasia = 'Torrefação Ponte Velha'
   and is_demo = false
   and cnpj is null and email is null and telefone is null;

update public.lv_stores s
   set is_demo = true
 where s.slug = 'torrefacao-ponte-velha'
   and s.is_demo = false
   and exists (select 1 from public.lv_sellers v where v.id = s.seller_id and v.is_demo);
