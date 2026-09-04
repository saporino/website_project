-- Múltiplos popups promocionais: cada linha de popup_settings é um popup independente
-- (liga/desliga próprio). name = rótulo no admin; sort_order = ordem na biblioteca.
-- O site mostra um popup entre os ligados (rotação aleatória), cada um com "já viu" próprio.
alter table public.popup_settings add column if not exists name text not null default 'Popup';
alter table public.popup_settings add column if not exists sort_order int not null default 0;

-- Logo configuravel por popup (fallback p/ logo Saporino se vazio).
alter table public.popup_settings add column if not exists logo_url text;

-- Tamanho do logo por popup (multiplicador; logos com muita margem precisam maior).
alter table public.popup_settings add column if not exists logo_scale numeric(4,2) not null default 1;
