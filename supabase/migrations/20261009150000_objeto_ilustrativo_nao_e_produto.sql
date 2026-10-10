-- OBJETO ILUSTRATIVO NÃO É PRODUTO. LOGO RECRIADO CONTINUA SENDO PROBLEMA.
--
-- Decisão do Vlademir (09/10/2026): numa peça gerada por IA, o copo com grãos é "só
-- ilustrativo — são postagens, nada a ver" com o produto real. Está certo: copo de cenário
-- é linguagem normal de campanha, e travar isso como CRITICAL só ensina a ignorar alerta.
--
-- O que NÃO muda: o logotipo aplicado naquele copo foi desenhado pelo gerador, com
-- tipografia parecida mas diferente da oficial. Logo recriado é o risco de verdade — cada
-- peça assim coloca uma segunda versão da marca circulando, e quem vê não sabe qual é a boa.
--
-- Então o guardrail passa a separar CENÁRIO de MARCA:
--   • objeto de cenário (copo, caneca, xícara genérica, prato, mesa) sem a marca aplicada:
--     livre, é ilustração;
--   • QUALQUER superfície que receba o logo, o nome escrito ou a embalagem: asset oficial,
--     nunca recriado — nem "parecido".

update public.studio_brand_profiles
   set guardrails = jsonb_set(
         coalesce(guardrails, '{}'::jsonb),
         '{objetos_de_cena}',
         '{
            "livre": "Copo, caneca, xicara, prato, colher, mesa e cenario SEM marca aplicada sao ilustracao de campanha. Podem ser gerados e nao precisam ser asset oficial - nao representam produto a venda.",
            "exige_asset_oficial": "Assim que um objeto recebe o LOGO, o NOME escrito ou vira a EMBALAGEM da marca, ele deixa de ser cenario: ai so o asset oficial vale, aplicado em pos-producao.",
            "nunca": "Gerar logotipo por IA, ainda que parecido. Tipografia aproximada e o que coloca uma segunda versao da marca no mundo.",
            "como_fazer": "Gere o fundo, a luz e o cenario livremente; cole o logo/embalagem oficial depois.",
            "gravidade": "Objeto de cena sem marca: nao e alerta. Logo, nome ou embalagem recriados: CRITICO."
          }'::jsonb
       ),
       updated_at = now()
 where ativa_no_studio;

-- ------------------------------------------------------------------------------------
-- O LOGO OFICIAL DESCRITO EM PALAVRAS.
--
-- Mesmo incidente, outra ponta: a Verificação acusou o logo do copo de ser "recriado", e o
-- Vlademir mostrou o arquivo oficial — era o mesmo logo. A análise só recebe TEXTO dos
-- guardrails, então ela não tinha como reconhecer o logo olhando a arte: sem descrição, todo
-- logo vira suspeito e o alerta perde o valor.
--
-- Descrever em palavras é o que permite distinguir "é o nosso" de "é uma imitação".
update public.studio_brand_profiles
   set guardrails = jsonb_set(
         guardrails,
         '{logo_oficial}',
         '{
            "arquivo": "https://www.cafesaporino.com.br/saporino-logo.png",
            "descricao": "A palavra SAPORINO em letras maiusculas desenhadas a mao, brancas, dentro de uma forma arredondada vermelha de contorno irregular (parece um carimbo ou pincelada). Algumas letras tem um tracinho sublinhado embaixo. Sem moldura, sem sombra, sem outro texto.",
            "como_verificar": "Se a peca mostra esse conjunto - letra manuscrita branca, forma vermelha irregular, sublinhados - e o logo OFICIAL: nao acuse de recriacao.",
            "quando_acusar": "So quando a tipografia for claramente outra, a forma for retangulo/circulo regular, aparecer texto extra dentro do logo, ou a palavra estiver escrita em fonte de computador."
          }'::jsonb
       ),
       updated_at = now()
 where name = 'Café Saporino';
