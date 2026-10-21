-- =====================================================================
-- A agenda passa a levar a legenda junto (21/10/2026)
--
-- O QUE ACONTECEU, e foi ao ar. A agenda publicou no Instagram da marca uma
-- peça **sem texto nenhum** — sem legenda, sem hashtag, nada. Para 14 mil
-- seguidores, às 08:00, sem ninguém poder desfazer.
--
-- A análise DAQUELA MESMA ARTE já tinha a legenda pronta, com hashtags, e
-- ele podia lê-la em "Ver Análise". O defeito: a aprovação da agenda faz
-- `content: s.legenda ?? ''`, e `studio_sugestoes.legenda` está NULL em
-- todas as linhas — a agenda nunca foi buscar o texto que já existia.
--
-- É a mesma família do defeito do `media_path`: o dado estava no banco, a
-- peça seguia o fluxo inteiro, e o que faltava só aparecia no fim, publicado.
-- Campanha criada à mão tem texto; a criada pela agenda saiu vazia. Ninguém
-- comparou os dois caminhos.
--
-- A view é o lugar certo do conserto: ela já junta a arte com a análise, e é
-- dela que a agenda lê tudo. Levar a legenda junto significa que ela chega
-- onde a decisão acontece, em vez de depender de alguém lembrar de buscá-la.
-- =====================================================================

drop view if exists public.vw_studio_artes_disponiveis;

create view public.vw_studio_artes_disponiveis as
  select v.id            as video_id,
         v.brand_id,
         b.name          as marca,
         b.tipo          as tipo_marca,
         v.filename      as titulo,
         v.thumbnail_path,
         v.storage_path,
         v.media_type,
         v.created_at,
         a.agendamento,
         a.competitor_text as texto_da_arte,
         a.resumo,
         -- O QUE FALTAVA: o texto pronto, por rede, e as hashtags.
         -- Sem isto a agenda publicava em branco.
         a.legendas,
         a.hashtags,
         (select max(c.published_at) from public.studio_campaigns c
           where c.video_id = v.id and c.published_at is not null) as publicada_em,
         exists (select 1 from public.studio_sugestoes s
                  where s.video_id = v.id and s.status in ('sugerida', 'aprovada')) as na_fila
    from public.studio_videos v
    join public.studio_brand_profiles b on b.id = v.brand_id
    left join public.studio_analyses a on a.video_id = v.id
   where v.status = 'completed';

comment on view public.vw_studio_artes_disponiveis is
  'Artes analisadas, com o que a IA entendeu sobre quando devem sair E o texto pronto para publicar. storage_path e legendas são obrigatórios: sem o primeiro a campanha não publica, sem o segundo publica em branco.';

grant select on public.vw_studio_artes_disponiveis to authenticated;

-- ---------------------------------------------------------------------
-- A trava: campanha agendada NÃO nasce sem texto
-- ---------------------------------------------------------------------
-- Corrigir o caminho da agenda não impede o próximo caminho de repetir o
-- erro. A garantia tem de estar onde a campanha nasce — e publicar vazio
-- nunca é o que alguém quis.
--
-- Rascunho continua podendo ficar vazio: lá o texto ainda está sendo
-- escrito. O que não pode é AGENDAR para publicar sem nada.
create or replace function public.studio_campanha_exige_texto()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'scheduled' and coalesce(btrim(new.content), '') = '' then
    raise exception 'Campanha agendada sem texto. Publicar em branco não é o que alguém quis — escreva a legenda antes de agendar.';
  end if;
  return new;
end $$;

drop trigger if exists trg_studio_campanha_exige_texto on public.studio_campaigns;
create trigger trg_studio_campanha_exige_texto
  before insert or update of status, content on public.studio_campaigns
  for each row execute function public.studio_campanha_exige_texto();

comment on function public.studio_campanha_exige_texto is
  'Impede agendar publicação sem legenda. Em 21/10/2026 a agenda publicou uma peça em branco no Instagram porque ninguém conferia isto.';
