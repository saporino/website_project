-- AS MINIATURAS DO STUDIO NÃO CARREGAVAM — e a causa era uma incoerência.
--
-- A TABELA `studio_videos` deixa ver por organização:
--     studio_videos_tenant:  is_admin() OR organization_id = ANY(my_studio_orgs())
--
-- O STORAGE do mesmo material exigia outra coisa:
--     st_studio_videos_admin_all:  is_admin()
--
-- Resultado para quem tem acesso à organização mas não é admin: a lista traz os
-- 45 cards, e NENHUMA arte aparece. `createSignedUrls` não levanta erro visível
-- — devolve as entradas sem URL — então a tela mostra 45 quadrados vazios sem
-- dizer por quê. Ele precisava ver as peças para não repetir tema, e via nada.
--
-- A regra passa a ser a óbvia: QUEM PODE VER O REGISTRO PODE VER O ARQUIVO.
-- Não é afrouxamento — é o mesmo critério da tabela, aplicado ao arquivo que a
-- linha aponta. Quem não tem a organização continua sem ver nem card nem arte.
--
-- O casamento é por `storage_path = objects.name`: só é liberado o arquivo que
-- ALGUMA linha visível referencia. Arquivo solto no bucket, sem linha, não é
-- liberado por esta policy.

-- ESCRITA continua restrita a admin. Ver a arte é uma coisa; subir, trocar ou
-- apagar arquivo do Studio é outra, e essa fica onde estava.
drop policy if exists "st_studio_videos_admin_all" on storage.objects;

create policy "st_studio_videos_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'studio-videos' and public.is_admin());

create policy "st_studio_videos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'studio-videos' and public.is_admin())
  with check (bucket_id = 'studio-videos' and public.is_admin());

create policy "st_studio_videos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'studio-videos' and public.is_admin());

-- LEITURA segue a tabela.
create policy "st_studio_videos_le_quem_ve_a_linha" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'studio-videos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.studio_videos v
         where v.storage_path = storage.objects.name
           and v.organization_id = any (public.my_studio_orgs())
      )
    )
  );
