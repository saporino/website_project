-- Rep edita o PRÓPRIO contato (e-mail/telefone) com segurança, sem policy de update ampla.
-- SECURITY DEFINER atualiza só a ficha do rep que está chamando (my_rep_id()) e só estes 2 campos.
CREATE OR REPLACE FUNCTION public.repco_update_my_contact(p_email text, p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.representatives
     SET email = NULLIF(btrim(p_email), ''),
         phone = NULLIF(btrim(p_phone), '')
   WHERE id = public.my_rep_id();
END;
$$;
GRANT EXECUTE ON FUNCTION public.repco_update_my_contact(text, text) TO authenticated;
