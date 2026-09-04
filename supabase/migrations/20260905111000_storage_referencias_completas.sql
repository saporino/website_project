-- A4 (correção) — completar a lista de referências do Storage (05/09/2026)
--
-- A primeira versão da view deixou de fora colunas que guardam caminho de arquivo,
-- principalmente studio_videos.storage_path / audio_path / thumbnail_path. O efeito
-- foi grave na direção certa: o dry-run acusou 19 de 19 vídeos do Studio como órfãos,
-- quando todos estão em uso. Foi a simulação que pegou o erro — nenhum arquivo foi
-- apagado. É exatamente por isso que a limpeza nasce em dry-run.
--
-- Regra a manter: coluna nova que aponte para arquivo entra AQUI no mesmo commit.

create or replace view public.vw_storage_references as
  select 'representative_orders'::text as origem, unnest(array[
           invoice_pdf_url, invoice_xml_url, payment_proof_url,
           commission_paid_proof_url, service_invoice_url, delivery_proof_url]) as ref
    from public.representative_orders
  union all select 'representative_order_installments', unnest(array[boleto_url, proof_url])
    from public.representative_order_installments
  union all select 'representative_commissions', proof_url from public.representative_commissions
  union all select 'representative_commission_payouts', proof_url from public.representative_commission_payouts
  union all select 'representative_clients', score_serasa_pdf_url from public.representative_clients
  union all select 'representative_documents', file_url from public.representative_documents
  union all select 'representative_routes', report_pdf_url from public.representative_routes
  union all select 'invoices', unnest(array[invoice_pdf_url, invoice_xml_url]) from public.invoices
  union all select 'chat_messages', attachment_url from public.chat_messages
  union all select 'chat_conversations', avatar_url from public.chat_conversations
  union all select 'promoter_visit_photos', photo_url from public.promoter_visit_photos
  union all select 'route_stops', proof_photo_url from public.route_stops
  union all select 'delivery_stops', unnest(array[pickup_photo_url, delivery_photo_url, canhoto_photo_url])
    from public.delivery_stops
  union all select 'coffee_offer_photos', storage_path from public.coffee_offer_photos
  union all select 'batch_photos', photo_url from public.batch_photos
  union all select 'lot_documents', storage_path from public.lot_documents
  union all select 'green_coffee_lots', unnest(array[nf_purchase_url, nf_url, supplier_certificate_url, quality_report_url])
    from public.green_coffee_lots
  union all select 'products', image_url from public.products
  union all select 'promo_banners', unnest(array[image_url, overlay_image_url]) from public.promo_banners
  union all select 'popup_settings', unnest(array[image_url, logo_url]) from public.popup_settings
  union all select 'companies', logo_url from public.companies
  union all select 'shipping_carriers', logo_url from public.shipping_carriers
  union all select 'studio_brand_profiles', logo_url from public.studio_brand_profiles
  union all select 'orders', label_url from public.orders
  union all select 'shipments', label_url from public.shipments
  -- ---- colunas que faltavam ----
  union all select 'studio_videos', unnest(array[storage_path, audio_path, thumbnail_path, source_url])
    from public.studio_videos
  union all select 'studio_campaigns', media_path from public.studio_campaigns
  union all select 'driver_documents', doc_path from public.driver_documents
  union all select 'fleet_documents', doc_path from public.fleet_documents
  union all select 'fleet_maintenance', doc_path from public.fleet_maintenance
  -- products.additional_images é um array de URLs
  union all select 'products.additional_images', unnest(coalesce(additional_images, '{}'))
    from public.products
  -- green_coffee_lots.photo_urls idem
  union all select 'green_coffee_lots.photo_urls', unnest(coalesce(photo_urls, '{}'))
    from public.green_coffee_lots;

revoke all on public.vw_storage_references from public, anon, authenticated;
