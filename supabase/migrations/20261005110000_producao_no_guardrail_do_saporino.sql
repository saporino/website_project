-- Conserta a migration anterior no Café Saporino: o guardrail dele não tem `brand_story`, e
-- jsonb_set não cria o objeto pai — o fato da produção entrou no Tropeiro e silenciosamente
-- não entrou aqui. Agora o objeto é criado antes de receber a chave.
--
-- Fato (Vlademir, 05/10/2026): café torrado e moído é torrado em Minas; café em grão, para
-- moer na hora, sai de São Paulo. Torra ≠ origem do grão: a procedência continua na lista
-- que exige aprovação.

update public.studio_brand_profiles
   set guardrails = coalesce(guardrails, '{}'::jsonb) || jsonb_build_object(
         'brand_story',
         coalesce(guardrails -> 'brand_story', '{}'::jsonb) || jsonb_build_object(
           'producao',
           'Café torrado e moído (em pó) é torrado em Minas Gerais. Café em grão, para moer na hora, sai de São Paulo. Pode-se dizer onde o café é TORRADO; a origem (região ou fazenda) do grão precisa de confirmação antes de virar peça.'
         )
       ),
       updated_at = now()
 where name = 'Café Saporino';

-- A lista do Saporino travava qualquer menção a Minas. Com a torra cadastrada, o que precisa
-- de aprovação é a ORIGEM do grão, não o lugar da torra — senão a marca não pode nem dizer
-- um fato que é dela.
update public.studio_brand_profiles
   set guardrails = jsonb_set(
         guardrails,
         '{requires_manual_approval}',
         (
           select coalesce(jsonb_agg(t), '[]'::jsonb)
             from jsonb_array_elements(guardrails -> 'requires_manual_approval') t
            where t #>> '{}' not in ('Minas', 'mineiro', 'mineira', 'café mineiro', 'sabor de Minas')
         ) || '["Origem (região ou fazenda) do grão — onde o café é TORRADO já está aprovado; de onde o grão VEM, não"]'::jsonb
       ),
       updated_at = now()
 where name = 'Café Saporino'
   and jsonb_typeof(guardrails -> 'requires_manual_approval') = 'array';
