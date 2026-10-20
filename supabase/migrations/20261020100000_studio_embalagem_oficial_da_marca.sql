-- =====================================================================
-- A embalagem oficial passa a morar na MARCA (20/10/2026)
--
-- O QUE ACONTECEU. Ele pediu três peças de "bom dia" do Tropeiro Paulista e
-- recebeu uma foto genérica de café com uma caixinha de legenda. Gerou a mesma
-- coisa no ChatGPT, com a embalagem anexada, e veio um cartaz de verdade.
--
-- A diferença não era o modelo — os dois são `gpt-image`. Era que o Studio
-- PROÍBE mostrar embalagem quando não há ativo oficial anexado (e essa trava
-- está certa: embalagem inventada é o erro mais caro que existe aqui). Só que
-- a embalagem do Tropeiro existe, está no catálogo de produtos, e ele tinha de
-- anexá-la à mão em toda geração. Esquecer uma vez = peça genérica, cobrada.
--
-- Sete marcas cadastradas, seis sem logo, sem foto e sem cor. O Tropeiro tinha
-- três adjetivos no lugar das cores: 'preto', 'dourado', 'creme'. "Dourado" o
-- modelo lê como marrom de fazenda, e foi exatamente o que saiu.
--
-- A DECISÃO. A embalagem oficial é propriedade da MARCA, não do formulário.
-- Guardada uma vez, entra sozinha em toda peça daquela marca. Quem anexa algo
-- na hora continua mandando — o anexo manual tem precedência, porque pode ser
-- um produto específico da linha.
--
-- Não crio tabela nova: `studio_reference_assets` já registra cada ativo com a
-- sua marca, e é essa a trava que impede a embalagem de uma marca entrar na
-- peça de outra. O que faltava era apontar qual deles é O oficial.
-- =====================================================================

alter table public.studio_brand_profiles
  add column if not exists ativo_oficial_path text;

comment on column public.studio_brand_profiles.ativo_oficial_path is
  'Caminho (no bucket de referências) da embalagem oficial desta marca. Entra automaticamente em toda geração da marca quando nada é anexado à mão. Sem ele, a IA é PROIBIDA de desenhar embalagem identificável — e a peça sai genérica.';

-- Fica registrado QUANDO a embalagem entrou sozinha. Sem isto, daqui a um mês
-- não dá para responder "esta peça saiu com a embalagem porque ele anexou ou
-- porque o sistema anexou?" — e é justamente essa a pergunta ao comparar a
-- qualidade das peças antes e depois.
alter table public.studio_generations
  add column if not exists ativo_automatico boolean not null default false;

comment on column public.studio_generations.ativo_automatico is
  'true quando a embalagem oficial da marca entrou sozinha, sem anexo manual.';

-- A trava de marca que já existe continua valendo: o caminho guardado aqui tem
-- de estar registrado para ESTA marca em studio_reference_assets. Conferir no
-- banco, e não só no código, porque é a embalagem de uma marca aparecendo na
-- peça de outra que custa caro.
create or replace function public.studio_ativo_oficial_confere()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  if new.ativo_oficial_path is null then
    return new;
  end if;

  select brand_id into dono
    from public.studio_reference_assets
   where path = new.ativo_oficial_path
   limit 1;

  -- Ativo que o Studio nunca viu não vira oficial: seria um caminho solto
  -- apontando para qualquer arquivo do bucket.
  if dono is null then
    raise exception 'Este arquivo não está registrado como ativo do Studio.';
  end if;

  if dono is distinct from new.id then
    raise exception 'Este ativo pertence a outra marca. A embalagem de uma marca não entra na peça de outra.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_studio_ativo_oficial_confere on public.studio_brand_profiles;
create trigger trg_studio_ativo_oficial_confere
  before insert or update of ativo_oficial_path on public.studio_brand_profiles
  for each row execute function public.studio_ativo_oficial_confere();
