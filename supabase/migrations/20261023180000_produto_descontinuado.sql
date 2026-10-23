-- DESCONTINUADO ≠ DESATIVADO. Faltava a diferença, e por isso o rodapé mentia.
--
-- O rodapé "Nossos cafés" listava a MESMA consulta da vitrine: só ativo, só não
-- oculto, só com estoque. Resultado: desligar um café o apagava da lista do
-- rodapé, e acabar o estoque também. Mas o rodapé não é vitrine — é a resposta a
-- "que cafés a Saporino faz". Um café sem estoque hoje continua sendo nosso café.
--
-- Agora são três estados independentes, e cada um responde a uma pergunta:
--   is_active         → está à venda agora?
--   hidden_from_store → aparece na vitrine?
--   discontinued      → AINDA FAZ PARTE DO PORTFÓLIO?  ← o novo
--
-- Só o terceiro tira o café do rodapé. Nasce `false` para todo mundo: nenhum
-- produto existente muda de comportamento com esta migration.
alter table public.products
  add column if not exists discontinued boolean not null default false;

comment on column public.products.discontinued is
  'Saiu do portfólio de vez. Diferente de is_active (fora de venda agora) e de estoque zero. Só isto tira o café da lista "Nossos cafés" do rodapé.';

-- Índice parcial: a consulta do rodapé é "do portfólio", e é pública.
create index if not exists products_portfolio_idx
  on public.products (company_id)
  where discontinued = false and kit_of_product_id is null;
