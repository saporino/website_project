-- =====================================================================
-- Dados de retirada e de aviso das duas empresas (08/09/2026)
--
-- O e-mail de "pronto para retirada" precisa dizer ONDE e QUANDO. Sem isto
-- ele sairia com o endereço em branco, e o cliente não teria como vir.
--
-- As duas empresas retiram no mesmo lugar: o CD de Várzea Paulista. São
-- CNPJs diferentes vendendo, mas um galpão só.
-- =====================================================================

update public.companies set
  endereco     = 'R. Juvenal Durigon — Parque Petrópolis',
  cidade       = 'Várzea Paulista',
  uf           = 'SP',
  cep          = '13225-875',
  pickup_hours = 'Segunda a sexta, das 9h às 17h',
  notify_email = 'pedidos@cafesaporino.com.br'
where order_prefix = 'CS';

update public.companies set
  endereco     = 'R. Juvenal Durigon — Parque Petrópolis',
  cidade       = 'Várzea Paulista',
  uf           = 'SP',
  cep          = '13225-875',
  pickup_hours = 'Segunda a sexta, das 9h às 17h',
  notify_email = 'pedidos@coficobrasil.com.br'
where order_prefix = 'CO';
