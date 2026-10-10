-- A IDENTIDADE ITALIANA DA MARCA NÃO É UMA AFIRMAÇÃO DE ORIGEM.
--
-- Incidente de 09/10/2026: a Verificação de Marca deu CRITICAL numa peça do Saporino porque
-- a arte mostrava "faixas da bandeira italiana, silhueta de mapa da Itália e o texto 'com
-- jeitinho italiano de ser' na embalagem" — e concluiu que isso viola a proibição de origem
-- italiana. O Vlademir corrigiu: a embalagem REAL tem a bandeira. Não é invenção da arte.
--
-- A regra estava certa; faltava o fato. O guardrail proibia "origem italiana / café italiano
-- / grãos italianos / produzido na Itália" sem nunca dizer que a MARCA é italianizante de
-- nome, rótulo e tom. Sem esse contexto, qualquer peça que mostrasse a embalagem de verdade
-- seria acusada.
--
-- A separação que entra agora:
--   • IDENTIDADE (permitida): nome italiano, verde-branco-vermelho do rótulo oficial, o texto
--     que já está impresso na embalagem, tom de hospitalidade italiana. É o produto real.
--   • ORIGEM (continua proibida): dizer que o café vem da Itália, que os grãos são italianos,
--     que é importado ou produzido lá. O café é torrado em MINAS — afirmar outra coisa é
--     procedência falsa, e isso em alimento não é detalhe de marketing.

update public.studio_brand_profiles
   set guardrails = jsonb_set(
         jsonb_set(
           guardrails,
           '{prohibited_claims}',
           '["o cafe vem da Italia / e importado da Italia",
             "graos italianos ou colhidos na Italia",
             "produzido, torrado ou embalado na Italia",
             "qualquer estudo ou dado cientifico sem fonte confirmada",
             "qualquer origem/regiao aplicada a marca inteira sem autorizacao",
             "qualquer beneficio funcional ou de saude nao aprovado"]'::jsonb
         ),
         '{identidade_italiana}',
         '{
            "o_que_e": "Saporino e uma marca de identidade italiana feita no Brasil: o nome, as cores verde-branco-vermelho do rotulo e o tom de hospitalidade fazem parte da marca.",
            "permitido": [
              "mostrar a embalagem oficial como ela e, com a bandeira e os textos impressos nela",
              "falar em inspiracao, jeito ou tradicao italiana como ESTILO da marca",
              "usar as cores da bandeira quando vierem do rotulo oficial"
            ],
            "proibido": [
              "dizer ou sugerir que o cafe vem da Italia, e importado ou foi produzido la",
              "atribuir origem do GRAO a Italia em texto, selo ou simbolo de procedencia"
            ],
            "porque": "O cafe e torrado em Minas Gerais. Identidade de marca pode ser italiana; procedencia do produto, nao - origem falsa em alimento tem peso legal.",
            "atencao": "Bandeira + mapa da Italia + texto de origem na MESMA peca empilham ate virar leitura de procedencia. Identidade sozinha, tudo bem; conjunto que afirme origem, nao."
          }'::jsonb
       ),
       updated_at = now()
 where name = 'Café Saporino';
