-- Tropeiro Paulista — história oficial da marca e slogan nos guardrails.
--
-- Texto da arte da marca, entregue pelo Vlademir em 22/09/2026: a origem é a CULTURA TROPEIRA
-- PAULISTA (tropeiros, mulas, caminhos, paradas), não "café da roça". Com isso a IA para de
-- inventar história: ou usa este texto, ou não fala de origem.
-- Observação: a descrição do produto no cadastro ainda diz "inspirado no sabor do café da roça";
-- enquanto o Vlademir não decidir, a expressão fica só no cadastro e NÃO entra nos guardrails.

update public.studio_brand_profiles
   set guardrails = guardrails || jsonb_build_object(
         'brand_story', jsonb_build_object(
           'slogan', 'Força e tradição em cada xícara.',
           'origem', 'Inspirado na cultura tropeira paulista, nosso café carrega a força de uma história que ajudou a construir o Brasil.',
           'historia', 'No lombo das mulas, os tropeiros cruzavam caminhos, levavam mercadorias e sonhos, e o café era companheiro em cada parada.',
           'para_quem', 'Café Tropeiro Paulista é feito para quem valoriza tradição, sabor forte e o orgulho das nossas origens.',
           'uso', 'Texto oficial da marca. Pode ser citado inteiro ou em parte; não reescrever os fatos nem criar outra origem.'),
         'requires_manual_approval', (
           select coalesce(jsonb_agg(t), '[]'::jsonb)
             from jsonb_array_elements(guardrails -> 'requires_manual_approval') t
            where t #>> '{}' not ilike '%marca-mãe%')
           || jsonb_build_array('Qualquer origem, região ou história diferente da história oficial (cultura tropeira paulista)')),
       updated_at = now()
 where name = 'Café Tropeiro Paulista';

update public.studio_brand_profiles
   set tone = 'Força, tradição e raiz tropeira paulista: caminhos, paradas e o café como companheiro. Voz direta e calorosa, orgulho paulista.',
       notes = coalesce(notes, '') || ' História oficial e slogan gravados em 22/09/2026 (arte da marca).',
       updated_at = now()
 where name = 'Café Tropeiro Paulista';
