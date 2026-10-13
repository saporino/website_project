-- CLASSIFICAÇÃO DO UNIVERSO DO CAFÉ — tabela paralela, versionada.
--
-- Fase 2 do briefing (13/10/2026). Regra número 8: "executar a nova classificação sobre os
-- 6.208 anúncios existentes em ambiente controlado, SEM SOBRESCREVER os registros originais".
--
-- Por isso a classificação não entra em `ecommerce_price_snapshots`. Ela vive aqui, apontando
-- para a linha original, com a VERSÃO do classificador gravada. Assim:
--   • o dado coletado continua intacto, do jeito que veio da fonte;
--   • dá para rodar uma régua nova sem apagar a anterior e comparar as duas;
--   • todo número de relatório sabe dizer com que versão foi medido.
--
-- A v1 (`unit_type`, `weight_g`, `price_per_kg` no snapshot) continua existindo e alimentando
-- os relatórios atuais até a validação liberar a troca.

create table if not exists public.ecommerce_classificacao (
  snapshot_id   bigint not null references public.ecommerce_price_snapshots(id) on delete cascade,
  versao        smallint not null,

  -- pertence ao universo? relevante | ambiguo | fora_escopo
  relevancia    text not null check (relevancia in ('relevante','ambiguo','fora_escopo')),
  -- o que o item É: define com quem pode ser comparado
  familia       text not null check (familia in ('cafe','bebida_pronta','filtro','coador','equipamento','embalagem','acessorio','fora')),
  -- eixos independentes: um produto é gourmet E arábica E torrado e moído ao mesmo tempo
  apresentacao  text check (apresentacao in ('torrado_moido','graos','soluvel','capsula','sache','verde')),
  classe        text check (classe in ('tradicional','extraforte','superior','gourmet','premium','especial')),
  composicao    text check (composicao in ('arabica','robusta','blend','descafeinado','organico')),
  filtro_numero smallint,
  marca         text,

  peso_unitario numeric(10,2),
  unidades      smallint not null default 1,
  peso_total    numeric(10,2),
  -- falso quando o título é ambíguo demais; sem isto "10x9g" virava 9 g
  peso_confiavel boolean not null default false,
  preco_por_kg  numeric(12,2),

  motivos       text[] not null default '{}',
  -- revisão humana do que ficou ambíguo (regra 3 do briefing)
  revisado_por  uuid references auth.users(id) on delete set null,
  revisado_em   timestamptz,
  correcao      jsonb,

  classificado_em timestamptz not null default now(),
  primary key (snapshot_id, versao)
);

comment on table public.ecommerce_classificacao is
  'Classificacao do anuncio no universo do cafe. Paralela ao snapshot: o dado coletado nunca e sobrescrito.';

create index if not exists ecommerce_classificacao_fila
  on public.ecommerce_classificacao (versao, relevancia, familia);
create index if not exists ecommerce_classificacao_revisao
  on public.ecommerce_classificacao (relevancia) where revisado_em is null;

alter table public.ecommerce_classificacao enable row level security;
drop policy if exists ecommerce_classificacao_admin on public.ecommerce_classificacao;
create policy ecommerce_classificacao_admin on public.ecommerce_classificacao
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Leitura pronta: só o que é comparável, já na última versão da régua.
create or replace view public.vw_cafe_comparavel as
select s.id, s.marketplace, s.captured_at, s.title, s.price, s.url,
       c.familia, c.apresentacao, c.classe, c.composicao, c.marca,
       c.peso_total, c.unidades, c.preco_por_kg, c.filtro_numero
  from public.ecommerce_price_snapshots s
  join public.ecommerce_classificacao c
    on c.snapshot_id = s.id
   and c.versao = (select max(versao) from public.ecommerce_classificacao)
 where c.relevancia = 'relevante';

comment on view public.vw_cafe_comparavel is
  'Anuncios classificados como relevantes na ultima versao. Comparar SEMPRE dentro da mesma familia + apresentacao.';
