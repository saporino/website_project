-- A trava do número comercial passava quando o número era escrito sem o código do país.
--
-- `(11) 93810-0909` vira `11938100909` — onze dígitos. A comparação era contra
-- `5511938100909`, então a mesma linha telefônica, digitada de outro jeito, escapava da
-- trava e podia ser habilitada para enviar. Achado pela bancada, antes de existir envio real.
--
-- Agora a comparação é por IDENTIDADE da linha, não por formato: tira o que não é dígito,
-- tira o 55 do começo quando sobra número brasileiro, e compara o núcleo.

create or replace function public.wa_numero_comercial_nao_envia()
returns trigger language plpgsql as $$
declare v_digitos text;
begin
  if not new.envio_habilitado then return new; end if;

  v_digitos := regexp_replace(coalesce(new.numero_e164, ''), '\D', '', 'g');
  -- 55 + DDD + numero → DDD + numero. Só quando o tamanho confirma que é brasileiro,
  -- para não mutilar um número de outro país que por acaso comece com 55.
  if length(v_digitos) in (12, 13) and left(v_digitos, 2) = '55' then
    v_digitos := substring(v_digitos from 3);
  end if;

  if v_digitos = '11938100909' then
    raise exception 'o numero comercial da COFICO nao envia ate a Coexistencia ser aprovada'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

comment on function public.wa_numero_comercial_nao_envia() is
  'Trava do numero comercial. Compara a LINHA, nao o formato: 5511938100909, 11938100909 e (11) 93810-0909 sao o mesmo numero.';
