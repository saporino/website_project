-- =====================================================================
-- Saneamento pós-Vertical Slice 001 (05/09/2026)
--   A1. company_order_counters: proteger a sequência de numeração fiscal
--   A2. invoices: leitura por dono, não por "qualquer autenticado"
--   A3. chat-media: leitura por participante da conversa
-- =====================================================================

-- ---------------------------------------------------------------------
-- A1 — company_order_counters
-- ---------------------------------------------------------------------
-- Era a única tabela do schema sem RLS, e `anon`/`authenticated` tinham TODOS os
-- privilégios, inclusive DELETE e TRUNCATE. Zerar essa tabela faria a numeração de
-- pedido voltar do 1 e gerar número repetido — problema fiscal, não estético.
--
-- A escrita legítima vem de UM lugar só: o trigger generate_repco_order_number.
-- Ele era SECURITY INVOKER, então rodava com o papel do representante e seria
-- barrado pela RLS. Passa a ser SECURITY DEFINER para continuar funcionando
-- enquanto o acesso direto fica fechado.

create or replace function public.generate_repco_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_prefix text;
  v_n      integer;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    -- prefixo por empresa: CS = Cafe Saporino, CF = Cafe Fazendinha (fallback RC)
    IF NEW.company_id IS NOT NULL THEN
      SELECT order_prefix INTO v_prefix FROM public.companies WHERE id = NEW.company_id;
      v_prefix := COALESCE(v_prefix, 'RC');
      -- contador atomico por empresa (cada empresa comeca do 1)
      INSERT INTO public.company_order_counters (company_id, last_number)
        VALUES (NEW.company_id, 1)
        ON CONFLICT (company_id) DO UPDATE SET last_number = public.company_order_counters.last_number + 1
        RETURNING last_number INTO v_n;
      NEW.order_number := v_prefix || '-' || LPAD(v_n::text, 5, '0');
    ELSE
      -- pedido sem empresa (nao deveria ocorrer): usa a sequencia global legada
      NEW.order_number := 'RC-' || LPAD(nextval('repco_order_seq')::text, 5, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

alter table public.company_order_counters enable row level security;

revoke all on public.company_order_counters from anon, authenticated;
grant select on public.company_order_counters to authenticated;

-- Só o administrador enxerga o contador; ninguém escreve direto.
-- A escrita acontece exclusivamente dentro do trigger (security definer).
drop policy if exists coc_admin_read on public.company_order_counters;
create policy coc_admin_read on public.company_order_counters
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- A2 — invoices: leitura por vínculo real
-- ---------------------------------------------------------------------
-- O caminho dos arquivos é heterogêneo (nf/, boleto/, comprovante/, canhoto/,
-- commissions/, serasa/, <order_id>/), então uma regra por prefixo seria frágil.
-- A regra correta é outra: você lê o arquivo se ele estiver referenciado em uma
-- linha que já é sua. Isso vale para qualquer prefixo, hoje e no futuro.
--
-- O valor gravado no banco às vezes é o caminho, às vezes a URL pública antiga,
-- por isso a comparação é por sufixo.

create or replace function public.can_access_invoice_file(p_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.representative_orders o
       where o.representative_id = public.my_rep_id()
         and (o.invoice_pdf_url like '%'||p_name
           or o.invoice_xml_url like '%'||p_name
           or o.payment_proof_url like '%'||p_name
           or o.commission_paid_proof_url like '%'||p_name
           or o.service_invoice_url like '%'||p_name
           or o.delivery_proof_url like '%'||p_name)
    )
    or exists (
      select 1 from public.representative_order_installments i
        join public.representative_orders o on o.id = i.order_id
       where o.representative_id = public.my_rep_id()
         and (i.boleto_url like '%'||p_name or i.proof_url like '%'||p_name)
    )
    or exists (
      select 1 from public.representative_commissions c
       where c.representative_id = public.my_rep_id()
         and c.proof_url like '%'||p_name
    )
    or exists (
      select 1 from public.representative_commission_payouts p
       where p.representative_id = public.my_rep_id()
         and p.proof_url like '%'||p_name
    )
    or exists (
      select 1 from public.representative_clients rc
       where rc.representative_id = public.my_rep_id()
         and rc.score_serasa_pdf_url like '%'||p_name
    )
    or exists (
      select 1 from public.invoices inv
        join public.orders ord on ord.id = inv.order_id
       where ord.user_id = auth.uid()
         and (inv.invoice_pdf_url like '%'||p_name or inv.invoice_xml_url like '%'||p_name)
    );
$$;

revoke execute on function public.can_access_invoice_file(text) from public;
grant execute on function public.can_access_invoice_file(text) to authenticated, service_role;

drop policy if exists "st_invoices_auth_read" on storage.objects;
create policy "st_invoices_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and public.can_access_invoice_file(name));

-- A gravação segue aberta a autenticado: o arquivo é enviado ANTES de existir a
-- linha que o referencia, então não há vínculo para checar no momento do upload.
-- A leitura é o que protege. Atualizar e apagar ficam restritos a administrador.
drop policy if exists "st_invoices_auth_update" on storage.objects;
create policy "st_invoices_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'invoices' and public.is_admin());

-- ---------------------------------------------------------------------
-- A3 — chat-media: leitura por participante da conversa
-- ---------------------------------------------------------------------
-- O caminho passa a ser  <conversation_id>/<user_id>/<arquivo>.
-- public.is_chat_member(uuid) já existe e é SECURITY DEFINER.

create or replace function public.chat_media_conversation(p_name text)
returns uuid
language plpgsql immutable
as $$
declare v uuid;
begin
  begin
    v := ((storage.foldername(p_name))[1])::uuid;
  exception when others then
    return null;   -- caminho antigo, sem conversa: ninguém além do admin lê
  end;
  return v;
end;
$$;

revoke execute on function public.chat_media_conversation(text) from public;
grant execute on function public.chat_media_conversation(text) to authenticated, service_role;

drop policy if exists "st_chat_media_auth_read" on storage.objects;
create policy "st_chat_media_member_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and (
      public.is_admin()
      or public.is_chat_member(public.chat_media_conversation(name))
    )
  );

-- Envia quem participa da conversa, e só na própria pasta.
drop policy if exists "st_chat_media_own_insert" on storage.objects;
create policy "st_chat_media_member_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_chat_member(public.chat_media_conversation(name))
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "st_chat_media_own_delete" on storage.objects;
create policy "st_chat_media_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (public.is_admin() or (storage.foldername(name))[2] = auth.uid()::text)
  );
