-- B2B Prospecção — celular antigo sem o 9 (regra da Anatel), nas fichas que já estão no banco.
--
-- A base da Receita é antiga: muito celular ainda vem com 8 dígitos, ex. (17) 9615-2432.
-- Número local começando com 6, 7, 8 ou 9 é celular e ganhou o 9 na frente → (17) 99615-2432.
-- Fixo começa com 2 a 5 e não muda. Mesma regra do padronizador (src/lib/b2b/normalizar.ts).
-- Celular corrigido passa a ter WhatsApp, se a ficha ainda não tiver um.

update public.b2b_empresas
   set telefone = substr(telefone, 1, 2) || '9' || substr(telefone, 3),
       whatsapp = coalesce(whatsapp, substr(telefone, 1, 2) || '9' || substr(telefone, 3))
 where telefone ~ '^[0-9]{2}[6-9][0-9]{7}$';

update public.b2b_empresas
   set whatsapp = substr(whatsapp, 1, 2) || '9' || substr(whatsapp, 3)
 where whatsapp ~ '^[0-9]{2}[6-9][0-9]{7}$';

update public.b2b_contatos
   set telefone = substr(telefone, 1, 2) || '9' || substr(telefone, 3)
 where telefone ~ '^[0-9]{2}[6-9][0-9]{7}$';
