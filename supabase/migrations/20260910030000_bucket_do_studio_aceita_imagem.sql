-- =====================================================================
-- O bucket do Studio precisa aceitar imagem (10/09/2026)
--
-- Sintoma: ao anexar a embalagem em "Criar imagem", a área continuava
-- mostrando "Anexar embalagem" como se nada tivesse sido escolhido.
--
-- Causa: `studio-videos` só permitia video/mp4, video/quicktime e video/webm.
-- Um PNG era recusado pelo próprio storage, antes de qualquer policy:
--
--   415 invalid_mime_type — "mime type image/png is not supported"
--
-- O upload falhava, o aviso de erro sumia em segundos, o estado do componente
-- continuava vazio e a tela voltava ao começo. Nada chegava ao storage.
--
-- O bucket nasceu para vídeo de concorrente e passou a guardar imagem também:
-- arte de campanha, thumbnail de Reel, post importado do Instagram — e agora
-- ativo de referência. A lista de tipos ficou para trás do uso real; havia
-- PNG e JPG lá dentro que entraram antes da restrição.
--
-- Não é caso de remover a restrição: é caso de a lista refletir o que o bucket
-- de fato guarda. Continua privado e admin-only.
-- =====================================================================

update storage.buckets
   set allowed_mime_types = array[
         'video/mp4','video/quicktime','video/webm',
         'image/png','image/jpeg','image/webp'
       ]
 where id = 'studio-videos';
