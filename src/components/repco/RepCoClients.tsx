import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CLIENT_SEGMENTS, SEGMENT_LABEL } from '../../constants/segments';
import type { ClientSegment } from '../../constants/segments';

interface RepCoClient {
  id: string; representative_id: string; cnpj: string; razao_social: string | null;
  nome_fantasia: string | null; situacao_receita: string | null; endereco_completo: string | null;
  email_comprador: string | null; email_xml: string | null; nome_comprador: string | null;
  whatsapp_comprador: string | null; prazo_pagamento: string | null; forma_pagamento: string | null;
  limite_credito: number; status: string; segment: ClientSegment | null; created_at: string;
  inscricao_estadual: string | null;
}
const emptyForm = { cnpj:'',razao_social:'',nome_fantasia:'',situacao_receita:'',endereco_completo:'',email_comprador:'',email_xml:'',nome_comprador:'',whatsapp_comprador:'',prazo_pagamento:'',forma_pagamento:'',limite_credito:0,segment:'' as ClientSegment|'',inscricao_estadual:'' };

export function RepCoClients({ repId }: { repId: string }) {
  const [clients,setClients]=useState<RepCoClient[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState(emptyForm);
  const [saving,setSaving]=useState(false);
  const [searching,setSearching]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [expandedId,setExpandedId]=useState<string|null>(null);

  useEffect(()=>{fetchClients();},[repId]);

  async function fetchClients(){
    setLoading(true);
    const{data}=await supabase.from('representative_clients').select('*').eq('representative_id',repId).eq('status','active').order('razao_social',{ascending:true});
    setClients(data||[]);setLoading(false);
  }

  async function searchCNPJ(){
    const cnpj=form.cnpj.replace(/\D/g,'');
    if(cnpj.length!==14){setError('CNPJ deve ter 14 dígitos.');return;}
    setSearching(true);setError('');
    try{
      const res=await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if(!res.ok)throw new Error();
      const d=await res.json();
      setForm(p=>({...p,cnpj,razao_social:d.razao_social||'',nome_fantasia:d.nome_fantasia||'',situacao_receita:d.descricao_situacao_cadastral||'',endereco_completo:[d.logradouro,d.numero,d.complemento,d.bairro,d.municipio,d.uf,d.cep].filter(Boolean).join(', ')}));
    }catch{setError('CNPJ não encontrado na Receita Federal.');}
    setSearching(false);
  }

  async function handleSave(){
    if(!form.cnpj||!form.razao_social){setError('CNPJ e Razão Social são obrigatórios.');return;}
    if(!form.segment){setError('Selecione o segmento do cliente.');return;}
    setSaving(true);setError('');
    const{error:err}=await supabase.from('representative_clients').insert({representative_id:repId,cnpj:form.cnpj.replace(/\D/g,''),razao_social:form.razao_social,nome_fantasia:form.nome_fantasia,situacao_receita:form.situacao_receita,endereco_completo:form.endereco_completo,email_comprador:form.email_comprador||null,email_xml:form.email_xml||null,nome_comprador:form.nome_comprador||null,whatsapp_comprador:form.whatsapp_comprador||null,prazo_pagamento:form.prazo_pagamento||null,forma_pagamento:form.forma_pagamento||null,limite_credito:form.limite_credito||0,segment:form.segment||null,inscricao_estadual:form.inscricao_estadual||null,status:'active'});
    if(err)setError('Erro: '+err.message);
    else{setSuccess('Cliente cadastrado!');setForm(emptyForm);setShowForm(false);fetchClients();setTimeout(()=>setSuccess(''),3000);}
    setSaving(false);
  }

  const fmt=(v:string)=>v.replace(/\D/g,'').slice(0,14).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');

  if(loading)return<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]"/></div>;

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="text-2xl font-bold text-gray-900">Meus Clientes</h3><p className="text-sm text-gray-500">{clients.length} cliente{clients.length!==1?'s':''}</p></div>
        <button onClick={()=>{setShowForm(!showForm);setError('');setForm(emptyForm);}} className="flex items-center gap-2 bg-[#a4240e] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#8a1f0c] transition-colors">{showForm?'✕ Cancelar':'+ Novo Cliente'}</button>
      </div>
      {error&&<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success&&<div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}
      {showForm&&(
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-gray-800">Novo Cliente B2B</h4>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs font-medium text-gray-600 mb-1">CNPJ *</label><input type="text" value={fmt(form.cnpj)} onChange={e=>setForm(p=>({...p,cnpj:e.target.value.replace(/\D/g,'')}))} placeholder="00.000.000/0000-00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none"/></div>
            <div className="flex items-end"><button onClick={searchCNPJ} disabled={searching} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">{searching?'Buscando...':'Buscar'}</button></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{k:'razao_social',l:'Razão Social *'},{k:'nome_comprador',l:'Nome do Comprador'},{k:'whatsapp_comprador',l:'WhatsApp'},{k:'email_comprador',l:'Email Comprador'},{k:'email_xml',l:'Email XML (NF-e)'}].map(({k,l})=>(
              <div key={k}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><input type="text" value={(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none"/></div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Inscrição Estadual</label>
              <input type="text" value={form.inscricao_estadual} onChange={e=>setForm(p=>({...p,inscricao_estadual:e.target.value}))} placeholder="000.000.000.000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none"/>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Segmento *</label>
              <select value={form.segment} onChange={e=>setForm(p=>({...p,segment:e.target.value as ClientSegment}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none">
                <option value="">Selecione...</option>{CLIENT_SEGMENTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Prazo de Pagamento</label>
              <select value={form.prazo_pagamento} onChange={e=>setForm(p=>({...p,prazo_pagamento:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none">
                <option value="">Selecione...</option>{['a_vista','7d','14d','21d','28d','30d','45d','60d'].map(v=><option key={v} value={v}>{v==='a_vista'?'À Vista':v}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pagamento</label>
              <select value={form.forma_pagamento} onChange={e=>setForm(p=>({...p,forma_pagamento:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none">
                <option value="">Selecione...</option><option value="a_vista">À Vista</option><option value="boleto">Boleto</option><option value="pix">PIX</option>
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Limite de Crédito (R$)</label><input type="number" value={form.limite_credito} onChange={e=>setForm(p=>({...p,limite_credito:parseFloat(e.target.value)||0}))} min="0" step="100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none"/></div>
          </div>
          {form.endereco_completo&&<div><label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label><input type="text" value={form.endereco_completo} onChange={e=>setForm(p=>({...p,endereco_completo:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent outline-none"/></div>}
          <div className="flex justify-end gap-2"><button onClick={()=>{setShowForm(false);setForm(emptyForm);setError('');}} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm bg-[#a4240e] text-white rounded-xl font-semibold hover:bg-[#8a1f0c] disabled:opacity-50">{saving?'Salvando...':'Cadastrar Cliente'}</button></div>
        </div>
      )}
      {clients.length===0&&!showForm?(
        <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">🏪</p><p className="font-medium">Nenhum cliente cadastrado ainda</p><p className="text-sm mt-1">Clique em "+ Novo Cliente" para começar</p></div>
      ):(
        <div className="space-y-2">
          {clients.map(c=>(
            <div key={c.id} onClick={()=>setExpandedId(expandedId===c.id?null:c.id)} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#a4240e]/40 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-gray-900 text-sm">{c.nome_fantasia||c.razao_social||'Sem nome'}</span>{c.segment&&<span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">{SEGMENT_LABEL[c.segment]??c.segment}</span>}</div><p className="text-xs text-gray-500 mt-0.5">{fmt(c.cnpj)}{c.nome_comprador&&` • ${c.nome_comprador}`}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{c.status==='active'?'Ativo':'Inativo'}</span>
              </div>
              {expandedId===c.id&&<div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-600">{c.whatsapp_comprador&&<div><span className="font-medium">WhatsApp:</span> {c.whatsapp_comprador}</div>}{c.email_comprador&&<div><span className="font-medium">Email:</span> {c.email_comprador}</div>}{c.inscricao_estadual&&<div><span className="font-medium">Insc. Estadual:</span> {c.inscricao_estadual}</div>}{c.forma_pagamento&&<div><span className="font-medium">Pagamento:</span> {c.forma_pagamento}</div>}{c.prazo_pagamento&&<div><span className="font-medium">Prazo:</span> {c.prazo_pagamento}</div>}{c.limite_credito>0&&<div><span className="font-medium">Limite:</span> R$ {c.limite_credito.toFixed(2)}</div>}{c.endereco_completo&&<div className="col-span-2"><span className="font-medium">Endereço:</span> {c.endereco_completo}</div>}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
