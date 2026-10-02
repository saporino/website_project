-- CUSTO DE EMBALAGEM (interno) — o que o fornecedor cobra da COFICO, por milheiro.
--
-- Pedido do Vlademir (02/10/2026): "preciso controlar esses preços dentro do RepCo; é preço
-- interno, não reflete na venda do site da COFICO". O preço de venda ao público é outro e
-- continua fora daqui.
--
-- Preço de embalagem muda sem aviso (matéria-prima): por isso cada linha guarda a data da
-- cotação. Preço velho sem data é o que faz vender no prejuízo.

create table if not exists public.embalagem_custos (
  id             uuid primary key default gen_random_uuid(),
  fornecedor     text not null,
  vendedor       text,                      -- contato que passou a tabela
  linha          text not null,             -- 'stand up', 'sanfonada', '4 soldas'
  descricao      text not null,             -- como o fornecedor nomeia o item
  capacidade     text,                      -- '250 g', '1 kg'
  cor            text,
  preco_milheiro numeric(12,2) not null,    -- R$ por 1.000 unidades
  cotado_em      date not null default current_date,
  observacao     text,
  ativo          boolean not null default true,
  company_id     uuid references public.companies(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists embalagem_custos_linha on public.embalagem_custos (linha, descricao);
comment on table public.embalagem_custos is
  'Custo de embalagem por milheiro (interno). Nao e preco de venda: o site da COFICO nao le esta tabela.';

alter table public.embalagem_custos enable row level security;
drop policy if exists embalagem_custos_admin on public.embalagem_custos;
create policy embalagem_custos_admin on public.embalagem_custos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tabela MAK recebida em 02/10/2026 (vendedora Gabriela Monteiro), transcrita como veio.
-- "SATND UP" e "STAND UP RAFT 500GG" do original foram corrigidos para "STAND UP" e
-- "STAND UP KRAFT 500G" — erro de digitação óbvio, valor mantido.
insert into public.embalagem_custos (fornecedor, vendedor, linha, descricao, capacidade, cor, preco_milheiro, cotado_em)
select 'MAK', 'Gabriela Monteiro', linha, descricao, capacidade, cor, preco, date '2026-10-02'
  from (values
    ('stand up', 'Stand up 250 g (moído e grão) preto',                 '250 g', 'preto',                     830.40),
    ('stand up', 'Stand up 250 g (moído e grão) branca',                '250 g', 'branca',                    910.85),
    ('stand up', 'Stand up 500 g (moído e grão) preto',                 '500 g', 'preto',                    1086.27),
    ('stand up', 'Stand up 500 g (moído e grão) branca',                '500 g', 'branca',                   1086.27),
    ('stand up', 'Stand up 1 kg (moído e grão) preto/branco',           '1 kg',  'preto/branco',             1625.38),
    ('stand up', 'Stand up 100 g branco/preto',                         '100 g', 'branco/preto',              675.90),
    ('stand up', 'Stand up 100 g kraft',                                '100 g', 'kraft',                     675.90),
    ('stand up', 'Stand up kraft 250 g',                                '250 g', 'kraft',                     832.00),
    ('stand up', 'Stand up kraft 500 g',                                '500 g', 'kraft',                    1311.56),
    ('stand up', 'Stand up 50 g preto',                                 '50 g',  'preto',                     338.45),
    ('sanfonada', 'Sanfonada kraft 250 g',                              '250 g', 'kraft',                     635.67),
    ('sanfonada', 'Sanfonada kraft 500 g moído',                        '500 g', 'kraft',                     692.00),
    ('sanfonada', 'Sanfonada kraft 500 g grão',                         '500 g', 'kraft',                     828.78),
    ('sanfonada', 'Sanfonada kraft 1 kg',                               '1 kg',  'kraft',                    1279.38),
    ('sanfonada', 'Sanfonada 100 g preto/branco',                       '100 g', 'preto/branco',              317.03),
    ('sanfonada', 'Sanfonada 250 g moído preto/verde/vermelho/ouro velho', '250 g', 'preto/verde/vermelho/ouro velho', 490.83),
    ('sanfonada', 'Sanfonada 250 g moído e grão preto/verde/vermelho/ouro velho', '250 g', 'preto/verde/vermelho/ouro velho', 532.67),
    ('sanfonada', 'Sanfonada 250 g marrom',                             '250 g', 'marrom',                    405.53),
    ('sanfonada', 'Sanfonada 500 g moído preto/verde/vermelho/ouro velho', '500 g', 'preto/verde/vermelho/ouro velho', 574.51),
    ('sanfonada', 'Sanfonada 500 g marrom',                             '500 g', 'marrom',                    497.26),
    ('sanfonada', 'Sanfonada 500 g grão',                               '500 g', null,                        748.31),
    ('sanfonada', 'Sanfonada 1 kg preto',                               '1 kg',  'preto',                    1102.36),
    ('sanfonada', 'Sanfonada 250 g moído dourado',                      '250 g', 'dourado',                   428.06),
    ('sanfonada', 'Sanfonada 250 g dourado/prata',                      '250 g', 'dourado/prata',             466.97),
    ('sanfonada', 'Sanfonada 500 g moído dourado/prata',                '500 g', 'dourado/prata',             539.11),
    ('sanfonada', 'Sanfonada 1 kg dourada',                             '1 kg',  'dourada',                  1015.46),
    ('sanfonada', 'Sanfonada 250 g dourado e prata',                    '250 g', 'dourado e prata',           465.08),
    ('sanfonada', 'Sanfonada 500 g dourado/prata',                      '500 g', 'dourado/prata',             651.76),
    ('sanfonada', 'Sanfonada 500 g prata',                              '500 g', 'prata',                     481.17),
    ('4 soldas', '4 soldas 250 g branco/preto/marrom/verde/vermelho',   '250 g', 'branco/preto/marrom/verde/vermelho', 642.25),
    ('4 soldas', '4 soldas 500 g branco/preto/marrom/verde/vermelho',   '500 g', 'branco/preto/marrom/verde/vermelho', 829.71),
    ('4 soldas', '4 soldas kraft 500 g',                                '500 g', 'kraft',                     881.95),
    ('4 soldas', '4 soldas kraft 250 g',                                '250 g', 'kraft',                     706.79),
    ('4 soldas', '4 soldas 1 kg preto/branco',                          '1 kg',  'preto/branco',             1181.56),
    ('4 soldas', '4 soldas 5 kg',                                       '5 kg',  null,                       2536.76)
  ) as t(linha, descricao, capacidade, cor, preco)
 where not exists (
   select 1 from public.embalagem_custos c
    where c.fornecedor = 'MAK' and c.descricao = t.descricao and c.cotado_em = date '2026-10-02'
 );
