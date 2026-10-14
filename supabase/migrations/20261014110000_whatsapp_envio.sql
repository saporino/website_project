-- Envio de mensagem pela central — o que o BANCO precisa garantir.
--
-- Duas colunas e uma regra. A regra é a que importa: enviar é *opt-in por número*. Um número
-- novo nasce sem poder enviar, e só passa a enviar quando alguém liga de propósito. Assim o
-- número comercial não começa a mandar mensagem porque alguém esqueceu de desligar algo.

-- Idempotência do envio. O wamid só existe DEPOIS que a Meta responde — então ele não serve
-- para impedir o clique duplo, que acontece antes. A chave vem do navegador, é única, e a
-- segunda tentativa esbarra no banco em vez de virar duas mensagens para o cliente.
alter table public.wa_mensagens add column if not exists chave_envio text;
create unique index if not exists wa_mensagens_chave_envio
  on public.wa_mensagens (chave_envio) where chave_envio is not null;
comment on column public.wa_mensagens.chave_envio is
  'Chave de idempotencia do envio, gerada no navegador. Impede que clique duplo vire duas mensagens.';

-- Enviar é opt-in, por número. Fail closed: o padrão é NÃO poder.
alter table public.wa_numeros add column if not exists envio_habilitado boolean not null default false;
comment on column public.wa_numeros.envio_habilitado is
  'Este numero pode ENVIAR? Padrao false. O numero comercial so liga depois da Coexistencia aprovada.';

-- O número de teste da Meta pode enviar. É para isso que ele existe.
update public.wa_numeros set envio_habilitado = true
 where phone_number_id = '1386100787926214' and ambiente = 'teste';

-- Trava de última instância, no banco e não no código: o número comercial da COFICO não
-- envia, ponto. Se alguém ligar o campo por engano — ou por script — o banco recusa.
-- Sai daqui no dia em que a Coexistência for aprovada, por migration explícita.
create or replace function public.wa_numero_comercial_nao_envia()
returns trigger language plpgsql as $$
begin
  if new.envio_habilitado and regexp_replace(coalesce(new.numero_e164,''), '\D', '', 'g') = '5511938100909' then
    raise exception 'o numero comercial nao envia ate a Coexistencia ser aprovada'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists wa_numeros_comercial on public.wa_numeros;
create trigger wa_numeros_comercial before insert or update on public.wa_numeros
  for each row execute function public.wa_numero_comercial_nao_envia();

-- Quem pode enviar nesta conversa? Uma resposta só, usada pela função de borda — para a
-- regra não existir em dois lugares e divergir.
create or replace function public.wa_pode_enviar(p_conversa uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare v record;
begin
  select cv.id, cv.company_id, cv.ultima_entrada_em, n.id as numero_id, n.phone_number_id,
         n.envio_habilitado, n.ativo, n.ambiente, ct.telefone_e164
    into v
    from public.wa_conversas cv
    join public.wa_numeros  n  on n.id  = cv.numero_id
    join public.wa_contatos ct on ct.id = cv.contato_id
   where cv.id = p_conversa;

  if v is null then
    return jsonb_build_object('pode', false, 'motivo', 'conversa_inexistente');
  end if;
  -- Permissão: a mesma dos outros caminhos. Representante e promotor não entram.
  if not (public.is_admin() or public.has_role('atendimento', v.company_id)) then
    return jsonb_build_object('pode', false, 'motivo', 'sem_permissao');
  end if;
  if not v.ativo or not v.envio_habilitado then
    return jsonb_build_object('pode', false, 'motivo', 'numero_nao_envia');
  end if;
  -- Janela de 24 h conferida NO BANCO, com o relógio do banco: o do navegador pode estar
  -- errado, e é justamente o que decide se a Meta aceita ou recusa a mensagem.
  if v.ultima_entrada_em is null or v.ultima_entrada_em <= now() - interval '24 hours' then
    return jsonb_build_object('pode', false, 'motivo', 'janela_fechada');
  end if;
  return jsonb_build_object(
    'pode', true, 'company_id', v.company_id, 'numero_id', v.numero_id,
    'phone_number_id', v.phone_number_id, 'telefone', v.telefone_e164,
    'ambiente', v.ambiente,
    'janela_minutos', floor(extract(epoch from (v.ultima_entrada_em + interval '24 hours' - now())) / 60)::int);
end $$;
comment on function public.wa_pode_enviar(uuid) is
  'Permissao + numero habilitado + janela de 24h, em uma resposta so. A funcao de borda nao repete a regra.';
revoke all on function public.wa_pode_enviar(uuid) from public, anon;
grant execute on function public.wa_pode_enviar(uuid) to authenticated;
