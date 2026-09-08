-- =====================================================================
-- MOVIMENTO 1 (conclusão) — credencial de transportadora sai do anônimo
--
-- `shipping_carriers` guarda api_key, api_username, api_password e
-- api_endpoint, e a policy `public read carriers` é USING (true) para
-- {public} — ou seja, legível sem login.
--
-- Alguém já havia percebido metade do problema: `api_password` está revogada
-- para o role `anon`. Mas `api_key`, `api_username` e `api_endpoint`
-- continuavam legíveis por qualquer visitante. Em API moderna, a `api_key` É
-- a credencial — revogar só a senha protege o campo que menos importa.
--
-- Hoje as quatro transportadoras (BBM, COFICO, Jadlog, Total Express) estão
-- com as credenciais NULAS, então nada vazou. Mas a exposição é real e
-- armada: no minuto em que a credencial da Total Express for digitada na tela
-- de administração, ela fica pública.
--
-- Revogação por COLUNA, e só para `anon`: o administrador edita essas
-- credenciais pela tela (role `authenticated`) e precisa continuar lendo-as.
-- Nenhum caminho anônimo lê esta tabela — o checkout cota por
-- superfrete-quote (service role) e por cotar_frete (RPC).
-- =====================================================================

revoke select (api_key, api_username, api_endpoint, api_password)
  on public.shipping_carriers from anon;

comment on table public.shipping_carriers is
  'Transportadoras. As colunas de credencial (api_key, api_username, api_password, api_endpoint) sao revogadas para anon: leitura publica cobre so nome, logo, prazo e preco. Nunca reconceder select dessas colunas ao anon.';
