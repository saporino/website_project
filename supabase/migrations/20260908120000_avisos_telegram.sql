-- =====================================================================
-- Avisos por Telegram (08/09/2026)
--
-- E-mail de aviso interno se perde na caixa de entrada. Pedido pago precisa
-- chegar no bolso de quem separa, na hora. O Telegram faz isso de graça e
-- sem limite — diferente do WhatsApp, que exige API paga e aprovação da Meta.
--
-- Este canal é INTERNO. O cliente não usa Telegram e nunca vai ver isto.
-- =====================================================================

create table if not exists public.telegram_recipients (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text not null unique,
  label       text,
  -- Vazio = recebe aviso de todas as empresas. Preenchido = só daquela.
  -- Serve para o dia em que quem separa a COFICO não for quem separa a Saporino.
  company_id  uuid references public.companies(id) on delete cascade,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.telegram_recipients is
  'Quem recebe aviso interno no Telegram. chat_id vem do proprio Telegram depois que a pessoa da START no bot — antes disso o Telegram nao deixa o bot mandar mensagem.';

alter table public.telegram_recipients enable row level security;

drop policy if exists tr_admin on public.telegram_recipients;
create policy tr_admin on public.telegram_recipients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
