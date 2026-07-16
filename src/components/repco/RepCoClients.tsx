import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CLIENT_SEGMENTS, SEGMENT_LABEL } from '../../constants/segments';
import type { ClientSegment } from '../../constants/segments';
import { useCompany } from '../../contexts/CompanyContext';
import { lookupCnpj } from '../../lib/cnpjLookup';
import BoletoCombinationPicker from './BoletoCombinationPicker';
import { geocodeClientById } from '../../lib/geocodeClient';
interface RepCoClient {
  id: string; representative_id: string; cnpj: string | null; cpf: string | null;
  nome_completo: string | null; razao_social: string | null; nome_fantasia: string | null;
  situacao_receita: string | null; endereco_completo: string | null; email_comprador: string | null;
  email_xml: string | null; nome_comprador: string | null; whatsapp_comprador: string | null;
  prazo_pagamento: string | null; forma_pagamento: string | null; limite_credito: number;
  cep: string | null; municipio: string | null; uf: string | null; bairro: string | null;
  lat: number | null; lng: number | null;
  credito_score: number | null; score_serasa_pdf_url: string | null; score_serasa_pdf_filename: string | null;
  status: string; segment: ClientSegment | null; inscricao_estadual: string | null;
  desconto_financeiro_pct: number | null; desconto_logistico_pct: number | null; bonificacao_padrao: string | null;
  tem_gondola: boolean | null; geofence_radius_m: number | null;
  last_order_at: string | null; inactivity_snoozed_until: string | null;
  snooze_count: number; snooze_admin_alert: boolean; is_active_client: boolean; created_at: string;
}
interface SalesHistory {
  order_id: string; order_number: string; total_amount: number; original_amount: number | null;
  discount_percentage: number | null; payment_method: string | null; order_status: string;
  order_date: string; invoice_pdf_url: string | null; commission_amount: number | null;
}
const emptyForm = {
  cnpj:'', cpf:'', nome_completo:'', razao_social:'', nome_fantasia:'', situacao_receita:'',
  endereco_completo:'', email_comprador:'', email_xml:'', nome_comprador:'', whatsapp_comprador:'',
  prazo_pagamento:'', forma_pagamento:'', limite_credito:0, segment:'' as ClientSegment|'',
  cep:'', municipio:'', uf:'', bairro:'',
  credito_score:'' as number|'', score_serasa_pdf_url:'', score_serasa_pdf_filename:'',
  inscricao_estadual:'', is_pj:true,
  desconto_financeiro_pct:'' as number|'', desconto_logistico_pct:'' as number|'', bonificacao_padrao:'',
  tem_gondola: null as boolean|null, geofence_radius_m: 100,
};
type ViewMode = 'list'|'detail'|'edit'|'new';
function fmtCNPJ(v:string){return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');}
function fmtCPF(v:string){return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');}
function days(d:string|null){if(!d)return 999;return Math.floor((Date.now()-new Date(d).getTime())/86400000);}
function parsePrazoOffsets(prazo:string|null):number[]{return (prazo||'').match(/\d+/g)?.map(Number).filter(n=>n>0)||[];}
function scoreFaixa(s:number){return s<300?{label:'Ruim',cls:'bg-red-100 text-red-700'}:s<500?{label:'Regular',cls:'bg-orange-100 text-orange-700'}:s<700?{label:'Bom',cls:'bg-amber-100 text-amber-700'}:s<900?{label:'Ótimo',cls:'bg-green-100 text-green-700'}:{label:'Excelente',cls:'bg-emerald-100 text-emerald-700'};}
interface InitialClientData {
  razao_social?: string; endereco_completo?: string; whatsapp_comprador?: string;
  cnpj?: string | null; segment?: string | null;
  lat?: number | null; lng?: number | null; municipio?: string | null; uf?: string | null;
}
export default function RepCoClients({ representativeId, previewMode = false, refreshKey = 0, initialData, onInitialDataConsumed }: { representativeId: string; previewMode?: boolean; refreshKey?: number; initialData?: InitialClientData | null; onInitialDataConsumed?: () => void; }) {
  const { activeCompanyId } = useCompany();
  const [clients,setClients]=useState<RepCoClient[]>([]);
  const [blocked,setBlocked]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState<ViewMode>('list');
  const [sel,setSel]=useState<RepCoClient|null>(null);
  const [hist,setHist]=useState<SalesHistory[]>([]);
  const [loadHist,setLoadHist]=useState(false);
  const [form,setForm]=useState(emptyForm);
  const [saving,setSaving]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [searching,setSearching]=useState(false);
  const [lastCnpj,setLastCnpj]=useState('');
  const [missing,setMissing]=useState<Set<string>>(new Set());
  const [err,setErr]=useState('');
  const [ok,setOk]=useState('');
  const [search,setSearch]=useState('');
  const [gonFilter,setGonFilter]=useState<'all'|'sim'|'nao'>('all');
  useEffect(()=>{if(activeCompanyId)fetchClients();},[representativeId,refreshKey,activeCompanyId]);

  // Quando o rep toca "Editar" no mapa, recebe os dados do lead pré-preenchidos
  useEffect(()=>{
    if(!initialData) return;
    setForm(_=>({
      ...emptyForm,
      razao_social: initialData.razao_social||'',
      endereco_completo: initialData.endereco_completo||'',
      whatsapp_comprador: initialData.whatsapp_comprador||'',
      cnpj: (initialData.cnpj||'').replace(/\D/g,''),
      segment: (initialData.segment||'') as ClientSegment|'',
      municipio: initialData.municipio||'',
      uf: initialData.uf||'',
      is_pj: !!(initialData.cnpj),
    }));
    setView('new');
    setErr('');
    onInitialDataConsumed?.();
  },[initialData]);
  useEffect(()=>{
    function handleRefresh(event: Event){
      const detail=(event as CustomEvent<{representativeId?:string}>).detail;
      if(!detail?.representativeId||detail.representativeId===representativeId)fetchClients();
    }
    window.addEventListener('repco:clients-updated',handleRefresh);
    window.addEventListener('repco:orders-updated',handleRefresh);
    window.addEventListener('focus',handleRefresh);
    return()=>{
      window.removeEventListener('repco:clients-updated',handleRefresh);
      window.removeEventListener('repco:orders-updated',handleRefresh);
      window.removeEventListener('focus',handleRefresh);
    };
  },[representativeId]);
  function notifyProspectionUpdated(leadIds:string[]){
    window.dispatchEvent(new CustomEvent('repco:prospection-updated',{detail:{representativeId,leadIds}}));
  }
  function notifyClientsUpdated(){
    window.dispatchEvent(new CustomEvent('repco:clients-updated',{detail:{representativeId}}));
  }
  async function fetchClients(){
    setLoading(true);
    const{data}=await supabase.from('representative_clients').select('*').eq('representative_id',representativeId).eq('company_id',activeCompanyId).order('razao_social',{ascending:true});
    setClients((data||[]) as RepCoClient[]);setLoading(false);
    const{data:blk}=await supabase.from('vw_repco_clientes_bloqueados').select('client_id,vencido_em');
    const map:Record<string,string>={};(blk||[]).forEach((b:any)=>{map[b.client_id]=b.vencido_em;});setBlocked(map);
  }
  async function fetchHist(clientId:string){
    setLoadHist(true);
    const{data}=await supabase.from('client_sales_history').select('*').eq('client_id',clientId).not('order_id','is',null).order('order_date',{ascending:false});
    setHist((data||[]) as SalesHistory[]);setLoadHist(false);
  }
  function openDetail(c:RepCoClient){setErr('');setSel(c);setView('detail');fetchHist(c.id);}
  function openEdit(c:RepCoClient){
    if (previewMode) { alert('Ação desativada no espelho.'); return; }
    setSel(c);
    setForm({cnpj:c.cnpj||'',cpf:c.cpf||'',nome_completo:c.nome_completo||'',razao_social:c.razao_social||'',
      nome_fantasia:c.nome_fantasia||'',situacao_receita:c.situacao_receita||'',endereco_completo:c.endereco_completo||'',
      email_comprador:c.email_comprador||'',email_xml:c.email_xml||'',nome_comprador:c.nome_comprador||'',
      whatsapp_comprador:c.whatsapp_comprador||'',prazo_pagamento:c.prazo_pagamento||'',
      forma_pagamento:c.forma_pagamento||'',limite_credito:c.limite_credito||0,
      cep:c.cep||'',municipio:c.municipio||'',uf:c.uf||'',bairro:c.bairro||'',
      credito_score:c.credito_score!=null?c.credito_score:'' as number|'',score_serasa_pdf_url:c.score_serasa_pdf_url||'',score_serasa_pdf_filename:c.score_serasa_pdf_filename||'',
      segment:c.segment||'',inscricao_estadual:c.inscricao_estadual||'',is_pj:!c.cpf,
      desconto_financeiro_pct:c.desconto_financeiro_pct!=null?c.desconto_financeiro_pct:'' as number|'',
      desconto_logistico_pct:c.desconto_logistico_pct!=null?c.desconto_logistico_pct:'' as number|'',
      bonificacao_padrao:c.bonificacao_padrao||'',
      tem_gondola:c.tem_gondola,geofence_radius_m:c.geofence_radius_m??100});
    setView('edit');setErr('');
  }
  function openNew(){if (previewMode) { alert('Ação desativada no espelho.'); return; } setForm(emptyForm);setView('new');setErr('');}
  // Busca dados da Receita (BrasilAPI) e preenche o cadastro. Campos já digitados
  // pelo rep (email/whatsapp/comprador) não são sobrescritos. IE não vem do CNPJ federal.
  async function searchCNPJ(cnpjArg?:string){
    const cnpj=(cnpjArg??form.cnpj).replace(/\D/g,'');
    if(cnpj.length!==14){setErr('CNPJ deve ter 14 dígitos.');return;}
    setSearching(true);setErr('');
    try{
      const d=await lookupCnpj(cnpj);
      setLastCnpj(cnpj);
      setForm(p=>({...p,
        razao_social:d.razao_social||p.razao_social,
        nome_fantasia:d.nome_fantasia||p.nome_fantasia,
        situacao_receita:d.situacao||p.situacao_receita,
        municipio:d.cidade||p.municipio,uf:d.uf||p.uf,cep:d.cep||p.cep,bairro:d.bairro||p.bairro,
        endereco_completo:[d.endereco,d.cidade,d.uf,d.cep].filter(Boolean).join(', ')||p.endereco_completo,
        email_comprador:p.email_comprador||d.email,email_xml:p.email_xml||d.email,
        whatsapp_comprador:p.whatsapp_comprador||d.telefone,
        nome_comprador:p.nome_comprador||d.socio,
      }));
      if(d.situacao&&d.situacao!=='ATIVA')setErr(`Atenção: situação na Receita = ${d.situacao}`);
    }catch(e:any){setErr(e?.message||'CNPJ não encontrado. Preencha manualmente.');}
    setSearching(false);
  }
  function uploadSerasaPdf(){
    if (previewMode) { alert('Ação desativada no espelho.'); return; }
    const input=document.createElement('input'); input.type='file'; input.accept='application/pdf,.pdf'; input.style.display='none';
    input.addEventListener('change', async ()=>{
      const file=input.files?.[0]; try{input.remove();}catch{}
      if(!file) return;
      const path=`serasa/${Date.now()}-${file.name}`;
      const {data,error}=await supabase.storage.from('invoices').upload(path,file,{upsert:true});
      if(error||!data){setErr('Erro ao enviar PDF Serasa: '+(error?.message||''));return;}
      setForm(p=>({...p,score_serasa_pdf_url:data.path||path,score_serasa_pdf_filename:file.name}));
      setOk('PDF Serasa anexado'); setTimeout(()=>setOk(''),2500);
    });
    document.body.appendChild(input); input.click();
  }
  async function handleSave(){
    if (previewMode) { setErr('Ação desativada no espelho.'); return; }
    // Passe de campos obrigatórios (conservador: só o que é de fato obrigatório).
    const faltando:{key:string;label:string}[]=[];
    if(form.is_pj&&!form.cnpj) faltando.push({key:'cnpj',label:'CNPJ'});
    if(!form.is_pj&&!form.cpf) faltando.push({key:'cpf',label:'CPF'});
    if(form.is_pj&&!form.razao_social) faltando.push({key:'razao_social',label:'Razão Social'});
    if(!form.is_pj&&!form.nome_completo) faltando.push({key:'nome_completo',label:'Nome completo'});
    if(!form.segment) faltando.push({key:'segment',label:'Segmento'});
    if(form.tem_gondola===null||form.tem_gondola===undefined) faltando.push({key:'tem_gondola',label:'Este cliente tem gôndola?'});
    if(faltando.length){
      setMissing(new Set(faltando.map(f=>f.key)));
      setErr('Preencha antes de salvar: '+faltando.map(f=>f.label).join(', ')+'.');
      window.scrollTo({top:0,behavior:'smooth'});
      return;
    }
    setMissing(new Set());
    setSaving(true);setErr('');
    const p={representative_id:representativeId,company_id:activeCompanyId,
      cnpj:form.is_pj?form.cnpj.replace(/\D/g,''):null,
      cpf:!form.is_pj?form.cpf.replace(/\D/g,''):null,
      nome_completo:!form.is_pj?form.nome_completo:null,
      razao_social:form.razao_social||form.nome_completo||null,nome_fantasia:form.nome_fantasia||null,
      situacao_receita:form.situacao_receita||null,endereco_completo:form.endereco_completo||null,
      email_comprador:form.email_comprador||null,email_xml:form.email_xml||null,
      nome_comprador:form.nome_comprador||null,whatsapp_comprador:form.whatsapp_comprador||null,
      prazo_pagamento:form.prazo_pagamento||null,forma_pagamento:form.forma_pagamento||null,
      cep:form.cep||null,municipio:form.municipio||null,uf:(form.uf||null)&&form.uf.toUpperCase().slice(0,2),bairro:form.bairro||null,
      credito_score:form.credito_score===''?null:Math.max(0,Math.min(1000,Number(form.credito_score))),
      score_serasa_pdf_url:form.score_serasa_pdf_url||null,score_serasa_pdf_filename:form.score_serasa_pdf_filename||null,
      limite_credito:form.limite_credito||0,segment:form.segment||null,
      inscricao_estadual:form.inscricao_estadual||null,status:'active',is_active_client:true,
      desconto_financeiro_pct:form.desconto_financeiro_pct===''?0:Math.max(0,Math.min(100,Number(form.desconto_financeiro_pct))),
      desconto_logistico_pct:form.desconto_logistico_pct===''?0:Math.max(0,Math.min(100,Number(form.desconto_logistico_pct))),
      bonificacao_padrao:form.bonificacao_padrao||null,
      tem_gondola:form.tem_gondola,geofence_radius_m:Number(form.geofence_radius_m)||100};
    let savedId:string|null=null; let error:{message:string}|null=null;
    if(view==='edit'&&sel){
      const r=await supabase.from('representative_clients').update(p).eq('id',sel.id);
      error=r.error; savedId=sel.id;
    } else {
      const r=await supabase.from('representative_clients').insert(p).select('id').single();
      error=r.error; savedId=r.data?.id??null;
    }
    if(error){setErr('Erro: '+error.message);}
    else{
      setOk(view==='edit'?'Atualizado!':'Cadastrado!');fetchClients();notifyClientsUpdated();setView('list');setTimeout(()=>setOk(''),3000);
      // Geocodificação não-bloqueante: só quando ainda não há coordenada (cadastro novo ou
      // edição de cliente sem lat). Best-effort — se falhar, o backfill recolhe depois.
      const hadCoord=view==='edit'&&sel?.lat!=null&&sel?.lng!=null;
      if(savedId&&!hadCoord){
        void geocodeClientById(savedId,{cep:form.cep,endereco_completo:form.endereco_completo,municipio:form.municipio,uf:form.uf});
      }
    }
    setSaving(false);
  }
  async function handleDeleteClient(client: RepCoClient){
    if (previewMode) { alert('Ação desativada no espelho.'); return; }
    const name=client.nome_fantasia||client.razao_social||client.nome_completo||'este cliente';
    if(!confirm(`Excluir "${name}"?\n\nSe ele veio da prospecção, o lead volta para a lista atribuída ao representante. Clientes com pedidos não podem ser excluídos.`))return;
    setDeleting(true);setErr('');
    const { count: orderCount, error: ordersError } = await supabase
      .from('representative_orders')
      .select('id', { count: 'exact', head: true })
      .eq('representative_client_id', client.id);
    if(ordersError){setErr('Não foi possível verificar pedidos vinculados.');setDeleting(false);return;}
    if((orderCount||0)>0){
      // Trava de segurança: por padrão bloqueia. Se o admin liberou em Configurações
      // (modo teste), faz a exclusão forçada em cascata via Edge Function (só admin).
      const { data: flag } = await supabase.from('site_settings').select('value').eq('key','allow_delete_clients_with_orders').maybeSingle();
      if(!flag?.value){ setErr('Este cliente tem pedido vinculado e não pode ser excluído. (Fase de teste: o admin pode liberar em Configurações da Loja → "Exclusão de clientes com pedidos".)'); setDeleting(false); return; }
      const { data:{ session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/repco-delete-client`, {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
        body: JSON.stringify({ client_id: client.id }),
      });
      const r = await res.json().catch(()=>({}));
      if(!res.ok || r.error){ setErr(r.message || r.error || 'Não foi possível excluir o cliente.'); setDeleting(false); return; }
      setOk(`Cliente excluído (com ${r.deleted_orders||0} pedido(s) e arquivos).`);
      setClients(current=>current.filter(c=>c.id!==client.id)); setSel(null); setHist([]); setView('list');
      notifyClientsUpdated(); notifyProspectionUpdated([]); fetchClients(); setDeleting(false); return;
    }

    const { data: linkedLeads, error: linkedLeadsError } = await supabase
      .from('prospect_leads')
      .select('id')
      .eq('representative_client_id', client.id);
    if(linkedLeadsError){setErr('Não foi possível localizar leads vinculados. Nenhum cliente foi excluído.');setDeleting(false);return;}

    const { data: deletedClient, error: deleteError } = await supabase
      .from('representative_clients')
      .delete()
      .eq('id',client.id)
      .eq('representative_id',representativeId)
      .select('id')
      .maybeSingle();
    if(deleteError||!deletedClient){setErr(deleteError?.message?`Não foi possível excluir o cliente: ${deleteError.message}`:'Não foi possível excluir o cliente. Verifique a permissão da policy e se ele pertence ao representante.');setDeleting(false);return;}

    const leadIds=(linkedLeads||[]).map(lead=>lead.id);
    if(leadIds.length>0){
      const { error: leadError } = await supabase
        .from('prospect_leads')
        .update({ representative_client_id:null, status:'assigned', converted_at:null })
        .in('id', leadIds);
      if(leadError){setClients(current=>current.filter(c=>c.id!==client.id));setSel(null);setHist([]);setView('list');setErr('Cliente excluído, mas não foi possível atualizar o lead de prospecção.');setDeleting(false);return;}
    }
    setOk('Cliente excluído. Se havia lead convertido, ele voltou para a prospecção.');
    setClients(current=>current.filter(c=>c.id!==client.id));
    notifyClientsUpdated();
    notifyProspectionUpdated(leadIds);
    fetchClients();
    setSel(null);setHist([]);setView('list');setDeleting(false);
    setTimeout(()=>setOk(''),4000);
  }
  const filtered=clients.filter(c=>{
    if(gonFilter==='sim'&&c.tem_gondola!==true)return false;
    if(gonFilter==='nao'&&c.tem_gondola===true)return false;
    if(!search)return true;
    const t=search.toLowerCase();
    return c.nome_fantasia?.toLowerCase().includes(t)||c.razao_social?.toLowerCase().includes(t)||c.cnpj?.includes(t)||c.nome_comprador?.toLowerCase().includes(t);
  });
  const inp='w-full h-[34px] px-3 text-sm border border-gray-300 rounded focus:outline-none';
  const lbl='block text-xs font-medium text-gray-600 mb-1';
  const ringErr=(k:string)=>missing.has(k)?' ring-2 ring-red-400 border-red-300':'';
  if(loading)return<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"/></div>;
  if(view==='new'||view==='edit') return(
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={()=>setView('list')} className="text-sm text-gray-400 hover:text-gray-600">Voltar</button>
        <h3 className="text-lg font-semibold text-gray-800">{view==='edit'?'Editar cliente':'Novo cliente B2B'}</h3>
      </div>
      {err&&<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
      <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
        {[{v:true,l:'Pessoa Jurídica (CNPJ)'},{v:false,l:'Pessoa Física (CPF)'}].map(opt=>(
          <button key={String(opt.v)} onClick={()=>setForm(p=>({...p,is_pj:opt.v}))}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${form.is_pj===opt.v?'bg-white text-amber-700 shadow-sm':'text-gray-500'}`}>
            {opt.l}
          </button>
        ))}
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        {form.is_pj?(
          <div>
            <label className={lbl}>CNPJ *</label>
            <div className="flex gap-2">
              <input type="text" value={fmtCNPJ(form.cnpj.replace(/\D/g,'').slice(0,14))}
                onChange={e=>{
                  const digits=e.target.value.replace(/\D/g,'').slice(0,14);
                  setForm(p=>({...p,cnpj:digits}));
                  // puxa sozinho assim que completa o CNPJ (sem precisar clicar em Buscar)
                  if(digits.length===14&&digits!==lastCnpj&&!searching)searchCNPJ(digits);
                }}
                placeholder="00.000.000/0000-00" className={`flex-1 ${inp}${ringErr('cnpj')}`}/>
              <button onClick={()=>searchCNPJ()} disabled={searching} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">
                {searching?'...':'Buscar'}
              </button>
            </div>
          </div>
        ):(
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>CPF *</label>
              <input type="text" value={fmtCPF(form.cpf.replace(/\D/g,'').slice(0,11))}
                onChange={e=>setForm(p=>({...p,cpf:e.target.value.replace(/\D/g,'')}))} placeholder="000.000.000-00" className={inp+ringErr('cpf')}/>
            </div>
            <div><label className={lbl}>Nome completo *</label>
              <input type="text" value={form.nome_completo} onChange={e=>setForm(p=>({...p,nome_completo:e.target.value}))} className={inp+ringErr('nome_completo')}/>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {form.is_pj&&<div><label className={lbl}>Razão Social *</label>
            <input type="text" value={form.razao_social} onChange={e=>setForm(p=>({...p,razao_social:e.target.value}))} className={inp+ringErr('razao_social')}/></div>}
          <div><label className={lbl}>{form.is_pj?'Nome Fantasia':'Apelido'}</label>
            <input type="text" value={form.nome_fantasia} onChange={e=>setForm(p=>({...p,nome_fantasia:e.target.value}))} className={inp}/></div>
          <div><label className={lbl}>Segmento *</label>
            <select value={form.segment} onChange={e=>setForm(p=>({...p,segment:e.target.value as ClientSegment}))} className={inp+ringErr('segment')}>
              <option value="">Selecione...</option>
              {CLIENT_SEGMENTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {form.is_pj&&<div><label className={lbl}>Inscrição Estadual</label>
            <input type="text" value={form.inscricao_estadual} onChange={e=>setForm(p=>({...p,inscricao_estadual:e.target.value}))} placeholder="000.000.000.000" className={inp}/></div>}
          <div><label className={lbl}>Nome do Comprador</label>
            <input type="text" value={form.nome_comprador} onChange={e=>setForm(p=>({...p,nome_comprador:e.target.value}))} className={inp}/></div>
          <div><label className={lbl}>WhatsApp</label>
            <input type="text" value={form.whatsapp_comprador} onChange={e=>setForm(p=>({...p,whatsapp_comprador:e.target.value}))} placeholder="(11) 99999-9999" className={inp}/></div>
          <div><label className={lbl}>Email do Comprador</label>
            <input type="email" value={form.email_comprador} onChange={e=>setForm(p=>({...p,email_comprador:e.target.value}))} className={inp}/></div>
          <div><label className={lbl}>Email XML (NF-e)</label>
            <input type="email" value={form.email_xml} onChange={e=>setForm(p=>({...p,email_xml:e.target.value}))} className={inp}/></div>
          <div>
            <BoletoCombinationPicker
              key={`${view}-${sel?.id ?? 'new'}`}
              initialOffsets={parsePrazoOffsets(form.prazo_pagamento)}
              onChange={offs=>setForm(p=>({...p,prazo_pagamento:offs.join('/'),forma_pagamento:offs.length?'boleto':'pix'}))}
            />
          </div>
          <div><label className={lbl}>Limite de Crédito (R$)</label>
            <input type="number" value={form.limite_credito} onChange={e=>setForm(p=>({...p,limite_credito:parseFloat(e.target.value)||0}))} min="0" step="100" className={inp}/></div>
          <div><label className={lbl}>Score do cliente (0–1000)</label>
            <input type="number" min="0" max="1000" value={form.credito_score} onChange={e=>setForm(p=>({...p,credito_score:e.target.value===''?'':Number(e.target.value)}))} placeholder="ex.: 650" className={inp}/>
            {form.credito_score!==''&&<span className={`text-[11px] mt-1 inline-block px-2 py-0.5 rounded-full ${scoreFaixa(Number(form.credito_score)).cls}`}>{scoreFaixa(Number(form.credito_score)).label}</span>}
          </div>
          <div><label className={lbl}>PDF do Serasa</label>
            <button type="button" onClick={uploadSerasaPdf} className="h-[34px] w-full px-3 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50 text-left truncate">
              {form.score_serasa_pdf_filename?`📎 ${form.score_serasa_pdf_filename}`:'Anexar PDF…'}
            </button>
          </div>
        </div>
        {/* Condições comerciais padrão — puxadas automaticamente na Revisão do pedido (o rep pode ajustar por pedido) */}
        <div className="border-t border-gray-200 pt-3 mt-1">
          <p className="text-xs font-semibold text-gray-600 mb-2">Condições comerciais (padrão do cliente)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={lbl}>Desconto financeiro (%)</label>
              <input type="number" min="0" max="100" step="0.5" value={form.desconto_financeiro_pct} onChange={e=>setForm(p=>({...p,desconto_financeiro_pct:e.target.value===''?'':Number(e.target.value)}))} placeholder="0" className={inp}/></div>
            <div><label className={lbl}>Desconto logístico (%)</label>
              <input type="number" min="0" max="100" step="0.5" value={form.desconto_logistico_pct} onChange={e=>setForm(p=>({...p,desconto_logistico_pct:e.target.value===''?'':Number(e.target.value)}))} placeholder="0" className={inp}/></div>
            <div><label className={lbl}>Bonificação combinada</label>
              <input type="text" value={form.bonificacao_padrao} onChange={e=>setForm(p=>({...p,bonificacao_padrao:e.target.value}))} placeholder="ex.: 1 pacote grátis a cada 10" className={inp}/></div>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Descontos abatem no valor da NF e a comissão é sobre o líquido. A bonificação vira item grátis (R$ 0) no pedido, sem comissão.</p>
        </div>
        {/* Gôndola — define se o promotor atende esta loja. Obrigatório, sem padrão. */}
        <div className={`border-t border-gray-200 pt-3 mt-1${missing.has('tem_gondola')?' rounded-lg ring-2 ring-red-400 p-2':''}`}>
          <p className="text-xs font-semibold text-gray-600 mb-2">Este cliente tem gôndola? <span className="text-gray-400 font-normal">(o promotor vai atender esta loja) *</span></p>
          <div className="flex gap-2">
            {[{v:true,l:'Sim'},{v:false,l:'Não'}].map(o=>(
              <button key={String(o.v)} type="button" onClick={()=>setForm(p=>({...p,tem_gondola:o.v}))}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.tem_gondola===o.v?'bg-[#8B2214] text-white border-[#8B2214]':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {o.l}
              </button>
            ))}
          </div>
          {form.tem_gondola===true&&(
            <div className="mt-2">
              <label className={lbl}>Raio da geocerca da loja (metros)</label>
              <input type="number" min="30" max="1000" step="10" value={form.geofence_radius_m}
                onChange={e=>setForm(p=>({...p,geofence_radius_m:parseInt(e.target.value)||100}))} className={inp+' max-w-[160px]'}/>
              <p className="text-[11px] text-gray-400 mt-1">Distância em que o check-in do promotor conta como "na loja". Padrão 100 m.</p>
            </div>
          )}
        </div>
        {form.endereco_completo&&<div><label className={lbl}>Endereço</label>
          <input type="text" value={form.endereco_completo} onChange={e=>setForm(p=>({...p,endereco_completo:e.target.value}))} className={inp}/></div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={lbl}>Cidade</label>
            <input type="text" value={form.municipio} onChange={e=>setForm(p=>({...p,municipio:e.target.value}))} placeholder="ex.: Barueri" className={inp}/></div>
          <div><label className={lbl}>UF</label>
            <input type="text" value={form.uf} onChange={e=>setForm(p=>({...p,uf:e.target.value.toUpperCase().slice(0,2)}))} placeholder="SP" maxLength={2} className={inp}/></div>
          <div><label className={lbl}>CEP</label>
            <input type="text" value={form.cep} onChange={e=>setForm(p=>({...p,cep:e.target.value}))} placeholder="00000-000" className={inp}/></div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-1">Cidade/UF alimentam o mapa de calor de vendas por região (preenchidos pelo CNPJ).</p>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>setView('list')} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-2 text-sm bg-[#8B2214] text-white rounded-lg hover:bg-[#6d1a10] disabled:opacity-50">
          {saving?'Salvando...':view==='edit'?'Salvar alterações':'Cadastrar cliente'}
        </button>
      </div>
    </div>
  );
  if(view==='detail'&&sel) {
    const d=days(sel.last_order_at);
    const total=hist.reduce((s,o)=>s+(o.total_amount||0),0);
    return(
      <div className="space-y-4">
        {err&&<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
        {ok&&<div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{ok}</div>}
        <div className="flex items-center gap-3">
          <button onClick={()=>setView('list')} className="text-sm text-gray-400 hover:text-gray-600">Voltar</button>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800">{sel.nome_fantasia||sel.razao_social||sel.nome_completo}</h3>
            {sel.segment&&<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{SEGMENT_LABEL[sel.segment]}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>openEdit(sel)} className="text-sm bg-[#8B2214] text-white px-3 py-1.5 rounded-lg hover:bg-[#6d1a10]">Editar</button>
            <button onClick={()=>handleDeleteClient(sel)} disabled={deleting} className="text-sm border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50">{deleting?'Excluindo...':'Excluir'}</button>
          </div>
        </div>
        {d>=7&&<div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">{d>=999?'Nunca comprou':`${d} dias sem comprar`}</p>
            {sel.snooze_admin_alert&&<p className="text-xs text-red-500 mt-0.5">Adiado {sel.snooze_count}x — requer atenção</p>}
          </div>
        </div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{hist.length}</p>
            <p className="text-xs text-gray-500">Pedidos realizados</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-700">R$ {total.toLocaleString('pt-BR',{maximumFractionDigits:0})}</p>
            <p className="text-xs text-gray-500">Total comprado</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados cadastrais</p>
          {sel.cnpj&&<div className="flex justify-between text-sm"><span className="text-gray-500">CNPJ</span><span>{fmtCNPJ(sel.cnpj)}</span></div>}
          {sel.cpf&&<div className="flex justify-between text-sm"><span className="text-gray-500">CPF</span><span>{fmtCPF(sel.cpf)}</span></div>}
          {sel.inscricao_estadual&&<div className="flex justify-between text-sm"><span className="text-gray-500">Insc. Estadual</span><span>{sel.inscricao_estadual}</span></div>}
          {sel.nome_comprador&&<div className="flex justify-between text-sm"><span className="text-gray-500">Comprador</span><span>{sel.nome_comprador}</span></div>}
          {sel.whatsapp_comprador&&<div className="flex justify-between text-sm"><span className="text-gray-500">WhatsApp</span>
            <a href={`https://wa.me/55${sel.whatsapp_comprador.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{sel.whatsapp_comprador}</a>
          </div>}
          {sel.email_comprador&&<div className="flex justify-between text-sm"><span className="text-gray-500">Email</span><span className="truncate max-w-[200px]">{sel.email_comprador}</span></div>}
          {sel.endereco_completo&&<div className="flex justify-between text-sm gap-4"><span className="text-gray-500 flex-shrink-0">Endereço</span><span className="text-right text-xs">{sel.endereco_completo}</span></div>}
          {sel.limite_credito>0&&<div className="flex justify-between text-sm"><span className="text-gray-500">Limite crédito</span><span>R$ {sel.limite_credito.toLocaleString('pt-BR')}</span></div>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Histórico de vendas <span className="font-normal normal-case text-gray-400">(somente leitura)</span></p>
          {loadHist?<div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600"/></div>
          :hist.length===0?<div className="text-center py-6 text-gray-400 text-sm">Nenhum pedido ainda</div>
          :hist.map(o=>(

            <div key={o.order_id} className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-800">{o.order_number}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.order_status==='completed'?'bg-green-100 text-green-700':o.order_status==='pending'?'bg-yellow-100 text-yellow-700':'bg-blue-100 text-blue-700'}`}>
                    {o.order_status==='completed'?'Concluído':o.order_status==='pending'?'Pendente':'Novo'}
                  </span>
                  <span className="text-sm font-semibold text-amber-700">R$ {o.total_amount?.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(o.order_date).toLocaleDateString('pt-BR')}</span>
                <div className="flex gap-3">
                  {o.discount_percentage&&o.discount_percentage>0&&<span className="text-green-600">-{o.discount_percentage}% desc.</span>}
                  {o.payment_method&&<span className="uppercase">{o.payment_method==='pix'?'PIX':'Boleto'}</span>}
                  {o.invoice_pdf_url&&<a href={o.invoice_pdf_url} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline">Ver NF</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <ClientTimeline clientId={sel.id} orders={hist} />
      </div>
    );
  }
  return(
    <div className="space-y-4">
      {ok&&<div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{ok}</div>}
      {err&&<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Meus Clientes</h3>
          <p className="text-sm text-gray-500">{clients.filter(c=>c.is_active_client).length} ativos · {clients.filter(c=>!c.is_active_client).length} inativos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#8B2214] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6d1a10]">+ Novo Cliente</button>
      </div>
      <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ ou comprador..."
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"/>
      <div className="flex items-center gap-1.5 text-xs">
        {([['all','Todos'],['sim','Com gôndola'],['nao','Sem gôndola']] as const).map(([v,l])=>(
          <button key={v} onClick={()=>setGonFilter(v)} className={`px-3 py-1.5 rounded-full font-medium border ${gonFilter===v?'bg-[#8B2214] text-white border-[#8B2214]':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>
      {clients.filter(c=>c.snooze_admin_alert).length>0&&(
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm font-medium text-red-700 mb-2">{clients.filter(c=>c.snooze_admin_alert).length} cliente(s) precisam de atenção</p>
          {clients.filter(c=>c.snooze_admin_alert).map(c=>(
            <div key={c.id} className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-700">{c.nome_fantasia||c.razao_social}</span>
              <button onClick={()=>openDetail(c)} className="text-xs text-amber-600 hover:underline">Ver cliente</button>
            </div>
          ))}
        </div>
      )}
      {filtered.length===0?<div className="text-center py-12 text-gray-400"><p className="font-medium">Nenhum cliente encontrado</p></div>
      :<div className="space-y-2">
        {filtered.map(c=>{
          const d=days(c.last_order_at);const inactive=d>=7;
          return(
            <div key={c.id} onClick={()=>openDetail(c)}
              className={`bg-white border rounded-xl p-4 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all ${!c.is_active_client?'opacity-50':c.snooze_admin_alert?'border-red-300':inactive?'border-yellow-200':'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 text-sm">{c.nome_fantasia||c.razao_social||c.nome_completo||'Sem nome'}</span>
                    {c.segment&&<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{SEGMENT_LABEL[c.segment]}</span>}
                    {c.tem_gondola===true&&<span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f0ef] text-[#8B2214] font-medium">Gôndola</span>}
                    {c.tem_gondola===null&&<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Gôndola?</span>}
                    {!c.is_active_client&&<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inativo</span>}
                    {c.snooze_admin_alert&&<span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Atenção</span>}
                    {blocked[c.id]&&<span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Bloqueado · venc. {new Date(blocked[c.id]+'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.cnpj?fmtCNPJ(c.cnpj):c.cpf?fmtCPF(c.cpf):''}
                    {c.nome_comprador&&` · ${c.nome_comprador}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-2 space-y-1">
                  {c.credito_score!=null&&<span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${scoreFaixa(c.credito_score).cls}`} title={`Score: ${scoreFaixa(c.credito_score).label}`}>{c.credito_score}</span>}
                  {inactive&&c.is_active_client&&<p className="text-xs text-red-500">{d>=999?'Nunca comprou':`${d}d sem comprar`}</p>}
                  {c.last_order_at&&!inactive&&<p className="text-xs text-gray-400">{d===0?'hoje':`${d}d atrás`}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// Bloco 5 — Linha do tempo da loja: pedidos + visitas do promotor + rupturas/ocorrências,
// em ordem cronológica. Daqui a 6 meses: "em março teve ruptura do SKU X, virou pedido".
function ClientTimeline({ clientId, orders }: { clientId: string; orders: SalesHistory[] }) {
  const [events, setEvents] = useState<{ ts: string; icon: string; text: string; cls: string }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: visits }, { data: incs }] = await Promise.all([
        supabase.from('promoter_visits').select('arrival_at,departure_at,status,duration_minutes,created_at').eq('representative_client_id', clientId).order('created_at', { ascending: false }).limit(30),
        supabase.from('promoter_incidents').select('opened_at,category,status,converted_to_order_id,products(name)').eq('representative_client_id', clientId).order('opened_at', { ascending: false }).limit(30),
      ]);
      const evs: { ts: string; icon: string; text: string; cls: string }[] = [];
      orders.forEach(o => evs.push({ ts: o.order_date, icon: '🛒', text: `Pedido ${o.order_number} — R$ ${(o.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, cls: 'text-gray-700' }));
      ((visits as any[]) || []).forEach(v => evs.push({
        ts: v.arrival_at || v.created_at, icon: '🧹',
        text: v.status === 'nao_realizada' ? 'Visita do promotor NÃO realizada' : `Visita do promotor${v.duration_minutes != null ? ` (${v.duration_minutes} min)` : ''}${v.status === 'em_atendimento' ? ' — em andamento' : ''}`,
        cls: v.status === 'nao_realizada' ? 'text-red-600' : 'text-gray-700',
      }));
      ((incs as any[]) || []).forEach(i => evs.push({
        ts: i.opened_at, icon: i.category === 'ruptura_total' ? '🚨' : '⚠️',
        text: `${i.category === 'ruptura_total' ? 'RUPTURA TOTAL' : 'Ocorrência'}${i.products?.name ? ` — ${i.products.name}` : ''}${i.converted_to_order_id ? ' · virou pedido ✓' : i.status === 'resolvida' ? ' · resolvida' : ''}`,
        cls: i.category === 'ruptura_total' && i.status !== 'resolvida' ? 'text-red-600 font-medium' : 'text-gray-700',
      }));
      evs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setEvents(evs.slice(0, 40));
    })();
  }, [open, clientId, orders]);
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
        Linha do tempo da loja {open ? '▲' : '▼'}
      </button>
      {open && (events.length === 0
        ? <p className="text-xs text-gray-400">Nada registrado ainda.</p>
        : <div className="space-y-1.5">
            {events.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-white border border-gray-100 rounded-lg px-3 py-2">
                <span>{e.icon}</span>
                <span className={`flex-1 ${e.cls}`}>{e.text}</span>
                <span className="text-gray-400 flex-shrink-0">{new Date(e.ts).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
      )}
    </div>
  );
}
