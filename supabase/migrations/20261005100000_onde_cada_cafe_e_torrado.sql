-- Onde cada café é torrado — fato que faltava no guardrail das marcas.
--
-- O que aconteceu (05/10/2026): uma peça do Tropeiro dizia "se o café é mineiro, o pão de
-- queijo também". A Verificação de Marca marcou CRITICAL porque não havia NENHUMA origem
-- cadastrada — nem no guardrail, nem no produto, nem nos lotes. A regra funcionou.
--
-- O Vlademir corrigiu o fato: hoje o café TORRADO E MOÍDO (em pó) é torrado em Minas Gerais,
-- Tropeiro incluído; o café EM GRÃO da Saporino, para moer na hora, sai de São Paulo.
--
-- CUIDADO QUE ESTA MIGRATION TOMA: "torrado em Minas" não é "grão de Minas". Torra é etapa,
-- origem é procedência do grão — e procedência em peça de alimento tem peso legal. Então
-- entra como fato aprovado APENAS a torra, e a origem do grão continua precisando de
-- confirmação. É o que mantém a peça honesta sem travar a comunicação.

update public.studio_brand_profiles
   set guardrails = jsonb_set(
         jsonb_set(
           guardrails,
           '{approved_product_claims,tropeiro_paulista_tradicional}',
           coalesce(guardrails #> '{approved_product_claims,tropeiro_paulista_tradicional}', '[]'::jsonb)
             || '["Torrado em Minas Gerais"]'::jsonb
         ),
         '{brand_story,producao}',
         '"O Tropeiro Paulista é torrado e moído em Minas Gerais. A marca é paulista pela cultura tropeira — os tropeiros ligavam Minas a São Paulo —, e a torra acontece em Minas. Pode-se dizer que o café é TORRADO EM MINAS; não se pode afirmar a origem (região/fazenda) do grão sem confirmação."'::jsonb
       ),
       updated_at = now()
 where name = 'Café Tropeiro Paulista';

-- A marca-mãe tem as duas pontas: pó torrado em Minas, grão de São Paulo.
update public.studio_brand_profiles
   set guardrails = jsonb_set(
         coalesce(guardrails, '{}'::jsonb),
         '{brand_story,producao}',
         '"Café torrado e moído (em pó) é torrado em Minas Gerais. Café em grão, para moer na hora, sai de São Paulo. Pode-se dizer onde o café é TORRADO; a origem (região/fazenda) do grão precisa de confirmação antes de virar peça."'::jsonb
       ),
       updated_at = now()
 where name = 'Café Saporino';

-- A proibição de inventar procedência continua valendo — só deixou de pegar a torra, que
-- agora é fato cadastrado.
update public.studio_brand_profiles
   set guardrails = jsonb_set(
         guardrails,
         '{requires_manual_approval}',
         '["Torra: o cadastro diz média-escura; a bio do Instagram diz \"Torra média\" — confirmar qual vale",
           "Origem (região ou fazenda) do grão — onde o café é TORRADO já está aprovado; de onde o grão VEM, não",
           "Qualquer história diferente da história oficial (cultura tropeira paulista)"]'::jsonb
       ),
       updated_at = now()
 where name = 'Café Tropeiro Paulista';
