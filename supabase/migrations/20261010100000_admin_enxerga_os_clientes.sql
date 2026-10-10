-- O ADMIN PRECISA ENXERGAR OS CLIENTES DA LOJA.
--
-- Achado de 10/10/2026: `user_profiles` tinha UMA política — "Users fully manage profile",
-- com a regra `auth.uid() = id`. Ou seja, cada pessoa lê e escreve só a própria linha, e o
-- admin também: para ele, a tabela inteira era o próprio perfil.
--
-- O estrago aparecia em dois lugares, e o segundo é pior:
--   • Dashboard: o card Clientes mostrava 0 com 6 perfis cadastrados;
--   • aba Clientes: a lista de clientes da loja estava cega — o admin não conseguia ver
--     quem se cadastrou, nem para atender.
--
-- O que NÃO muda: cliente continua vendo só o dele. Quem passa a enxergar todos é o admin,
-- que é quem atende. Escrita de terceiro fica com o admin também (editar cadastro é tarefa
-- de atendimento); o dono segue mandando no próprio perfil pela política que já existia.
drop policy if exists user_profiles_admin_all on public.user_profiles;
create policy user_profiles_admin_all on public.user_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on policy user_profiles_admin_all on public.user_profiles is
  'Admin enxerga e atende todos os cadastros da loja. Cliente continua restrito ao proprio perfil.';
