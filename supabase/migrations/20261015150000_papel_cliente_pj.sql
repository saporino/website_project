-- O papel `cliente_pj` precisa existir no catálogo `roles` antes de ser atribuído.
--
-- A bancada `auditoria-cliente-pj.mjs` pegou isto: `user_roles.role_code` tem FK
-- para `roles(code)`, e sem a linha aqui o cadastro inteiro revertia com
-- "violates foreign key constraint user_roles_role_code_fkey". Catorze
-- verificações falhavam por esta única causa.
insert into public.roles (code, label, description, created_at)
values (
  'cliente_pj',
  'Cliente PJ',
  'Empresa cliente com acesso ao próprio perfil no portal da COFICO. Vê apenas a própria ficha e os próprios pedidos; não acessa Admin nem RepCo, e não altera condições comerciais.',
  now()
)
on conflict (code) do nothing;
