import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Package, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Building2, X, Save, UserPlus, Phone, Mail, MessageCircle } from "lucide-react";

interface RoastingCompany { id:string; name:string; cnpj:string; city:string; state:string; cep:string; company_code:number; active:boolean; notes:string; director_name:string; email:string; whatsapp:string; inscricao_estadual:string; }
interface Contact { id:string; company_id:string; name:string; role:string; email:string; phone:string; whatsapp:string; extension:string; active:boolean; }
interface Batch { id:string; batch_number:string; product_id:string; product_name?:string; roasting_company_id:string; company_name?:string; status:string; quantity_packages:number; production_date:string; expiry_date:string; variety:string; altitude_m:number; farm_name:string; green_weight_kg:number; green_cost_per_kg:number; sca_score:number; sensory_notes:string; cost_per_250g:number; cost_per_500g:number; cost_per_1kg:number; notes:string; }
interface Product { id:string; name:string; stock:number; }

const EMPTY_BATCH = { product_id:"", roasting_company_id:"", status:"active", quantity_packages:0, production_date:"", expiry_date:"", variety:"", altitude_m:0, farm_name:"", green_weight_kg:0, green_cost_per_kg:0, sca_score:0, sensory_notes:"" };
const EMPTY_COMPANY = { name:"", cnpj:"", city:"", state:"", cep:"", company_code:0, director_name:"", email:"", whatsapp:"", inscricao_estadual:"" };
const EMPTY_CONTACT = { company_id:"", name:"", role:"", email:"", phone:"", whatsapp:"", extension:"" };
const STATUS_LABELS:Record<string,string> = { active:"Ativo", consumed:"Consumido", reserved:"Reservado", cancelled:"Cancelado" };
const STATUS_COLORS:Record<string,string> = { active:"bg-green-100 text-green-800", consumed:"bg-gray-100 text-gray-600", reserved:"bg-amber-100 text-amber-800", cancelled:"bg-red-100 text-red-800" };
const ROLES = ["Diretor","Torra Master","Gerente Comercial","Coordenador Logistico","Financeiro","Fiscal","Controle de Qualidade","Outros"];
export default function BatchManagement() {
  const [tab, setTab] = useState<"batches"|"companies">("batches");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [companies, setCompanies] = useState<RoastingCompany[]>([]);
  const [contacts, setContacts] = useState<Record<string,Contact[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch|null>(null);
  const [editingCompany, setEditingCompany] = useState<RoastingCompany|null>(null);
  const [batchForm, setBatchForm] = useState<any>(EMPTY_BATCH);
  const [companyForm, setCompanyForm] = useState<any>(EMPTY_COMPANY);
  const [contactForm, setContactForm] = useState<any>(EMPTY_CONTACT);
  const [showContactForm, setShowContactForm] = useState<string|null>(null);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string|null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string|null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: b }, { data: c }, { data: p }, { data: ct }] = await Promise.all([
      supabase.from("product_batches").select("*, products(name), roasting_companies(name)").order("created_at", { ascending: false }),
      supabase.from("roasting_companies").select("*").order("company_code"),
      supabase.from("products").select("id,name,stock").order("name"),
      supabase.from("roasting_company_contacts").select("*").eq("active", true)
    ]);
    setBatches((b||[]).map((x:any)=>({...x})));
    setCompanies(c||[]);
    setProducts(p||[]);
    const ctMap:Record<string,Contact[]> = {};
    (ct||[]).forEach((x:Contact)=>{ if(!ctMap[x.company_id]) ctMap[x.company_id]=[]; ctMap[x.company_id].push(x); });
    setContacts(ctMap);
    setLoading(false);
  }

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000); }

  async function saveBatch() {
    setSaving(true);
    const basePayload={...batchForm,altitude_m:Number(batchForm.altitude_m)||0,quantity_packages:Number(batchForm.quantity_packages)||0,green_weight_kg:Number(batchForm.green_weight_kg)||0,green_cost_per_kg:Number(batchForm.green_cost_per_kg)||0,sca_score:Number(batchForm.sca_score)||null};
    const {error}=editingBatch
      ?await supabase.from("product_batches").update(basePayload).eq("id",editingBatch.id)
      :await supabase.from("product_batches").insert([{...basePayload, batch_number:''}]);
    setSaving(false);
    if(error){console.error('saveBatch error:', JSON.stringify(error)); showToast("Erro: "+error.message);return;}
    showToast(editingBatch?"Lote atualizado!":"Lote criado!"); setShowBatchForm(false); setEditingBatch(null); setBatchForm(EMPTY_BATCH); loadAll();
  }

  async function deleteBatch(id:string){
    if(!confirm("Excluir este lote?")) return;
    await supabase.from("product_batches").delete().eq("id",id);
    showToast("Lote excluido."); loadAll();
  }

  async function saveCompany(){
    setSaving(true);
    const {error}=editingCompany?await supabase.from("roasting_companies").update(companyForm).eq("id",editingCompany.id):await supabase.from("roasting_companies").insert([companyForm]);
    setSaving(false);
    if(error){showToast("Erro: "+error.message);return;}
    showToast(editingCompany?"Torrefadora atualizada!":"Torrefadora cadastrada!"); setShowCompanyForm(false); setEditingCompany(null); setCompanyForm(EMPTY_COMPANY); loadAll();
  }

  async function saveContact(companyId:string){
    setSaving(true);
    const {error}=await supabase.from("roasting_company_contacts").insert([{...contactForm,company_id:companyId}]);
    setSaving(false);
    if(error){showToast("Erro: "+error.message);return;}
    showToast("Contato adicionado!"); setShowContactForm(null); setContactForm(EMPTY_CONTACT); loadAll();
  }

  async function deleteContact(id:string){
    await supabase.from("roasting_company_contacts").update({active:false}).eq("id",id);
    showToast("Contato removido."); loadAll();
  }

  const filtered=batches.filter(b=>(!filterProduct||b.product_id===filterProduct)&&(!filterStatus||b.status===filterStatus));
  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-[#8B2214] text-white px-4 py-2 rounded-lg text-sm shadow-lg">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-900">Inventario</h2><p className="text-sm text-gray-500">Lotes de producao e torrefadoras</p></div>
        <button onClick={()=>{tab==="batches"?setShowBatchForm(true):setShowCompanyForm(true);}} className="flex items-center gap-2 bg-[#8B2214] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6d1a10]">
          <Plus className="w-4 h-4"/>{tab==="batches"?"Novo Lote":"Nova Torrefadora"}
        </button>
      </div>
      <div className="flex gap-1 border-b border-gray-200">
        {(["batches","companies"] as const).map(k=>(
          <button key={k} onClick={()=>setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===k?"border-[#8B2214] text-[#8B2214]":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {k==="batches"?"Lotes":"Torrefadoras"}
          </button>
        ))}
      </div>

      {tab==="batches" && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <select value={filterProduct} onChange={e=>setFilterProduct(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1">
              <option value="">Todos os produtos</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name} (estoque: {p.stock})</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Todos status</option>
              {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {loading?<div className="text-center py-8 text-gray-400">Carregando...</div>:filtered.length===0?(
            <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
              <p className="text-gray-500 text-sm">Nenhum lote encontrado</p>
            </div>
          ):(
            <div className="space-y-2">
              {filtered.map(b=>(
                <div key={b.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-[#8B2214]"/></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">{b.batch_number||"Sem numero"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                        </div>
                        <p className="text-xs text-gray-500">{b.product_name} · {b.company_name} · {b.quantity_packages} pacotes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.cost_per_500g>0&&<p className="text-xs text-gray-500 hidden sm:block">500g: <span className="font-semibold">R$ {b.cost_per_500g?.toFixed(2)}</span></p>}
                      <button onClick={()=>setExpandedBatch(expandedBatch===b.id?null:b.id)} className="p-1.5 hover:bg-gray-100 rounded">{expandedBatch===b.id?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}</button>
                      <button onClick={()=>{setEditingBatch(b);setBatchForm({...b});setShowBatchForm(true);}} className="p-1.5 hover:bg-gray-100 rounded text-blue-600"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={()=>deleteBatch(b.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                  {expandedBatch===b.id&&(
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><p className="text-gray-400 uppercase tracking-wide">Producao</p><p className="font-medium">{b.production_date||"-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Validade</p><p className="font-medium">{b.expiry_date||"-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Fazenda</p><p className="font-medium">{b.farm_name||"-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Variedade</p><p className="font-medium">{b.variety||"-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Altitude</p><p className="font-medium">{b.altitude_m?b.altitude_m+"m":"-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Peso Verde</p><p className="font-medium">{b.green_weight_kg?b.green_weight_kg+"kg":"-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Custo 250g</p><p className="font-medium">{b.cost_per_250g?"R$ "+b.cost_per_250g?.toFixed(2):"-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Custo 500g</p><p className="font-medium">{b.cost_per_500g?"R$ "+b.cost_per_500g?.toFixed(2):"-"}</p></div>
                      {b.sensory_notes&&<div className="col-span-2 sm:col-span-4"><p className="text-gray-400 uppercase tracking-wide">Notas Sensoriais</p><p className="font-medium">{b.sensory_notes}</p></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab==="companies" && (
        <div className="space-y-2">
          {companies.map(c=>(
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-[#8B2214]"/></div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">Cod: {c.company_code} · {c.cnpj} · {c.city}/{c.state}</p>
                    {c.director_name&&<p className="text-xs text-gray-400">Dir: {c.director_name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 hidden sm:block">{(contacts[c.id]||[]).length} contato(s)</span>
                  <button onClick={()=>setExpandedCompany(expandedCompany===c.id?null:c.id)} className="p-1.5 hover:bg-gray-100 rounded">{expandedCompany===c.id?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}</button>
                  <button onClick={()=>{setEditingCompany(c);setCompanyForm({...c});setShowCompanyForm(true);}} className="p-1.5 hover:bg-gray-100 rounded text-blue-600"><Edit2 className="w-4 h-4"/></button>
                </div>
              </div>
              {expandedCompany===c.id&&(
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs">
                    {c.email&&<span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-gray-400"/>{c.email}
                      <a href={`mailto:${c.email}`} className="p-0.5 hover:bg-gray-200 rounded text-[#8B2214]" title="Enviar email"><Mail className="w-3 h-3"/></a>
                    </span>}
                    {c.whatsapp&&<span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400"/>{c.whatsapp}
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="p-0.5 hover:bg-gray-200 rounded text-green-600" title="Abrir WhatsApp"><MessageCircle className="w-3 h-3"/></a>
                    </span>}
                    {c.inscricao_estadual&&<span className="text-gray-400">IE: {c.inscricao_estadual}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Equipe</p>
                    <button onClick={()=>{setContactForm({...EMPTY_CONTACT,company_id:c.id});setShowContactForm(c.id);}} className="flex items-center gap-1 text-xs text-[#8B2214] font-semibold hover:underline"><UserPlus className="w-3 h-3"/>Adicionar</button>
                  </div>
                  {(contacts[c.id]||[]).length===0?<p className="text-xs text-gray-400 italic">Nenhum contato cadastrado</p>:(
                    <div className="space-y-1.5">
                      {(contacts[c.id]||[]).map(ct=>(
                        <div key={ct.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <div>
                            <span className="text-xs font-semibold text-gray-900">{ct.name}</span>
                            <span className="text-xs text-[#8B2214] ml-2 bg-red-50 px-1.5 py-0.5 rounded">{ct.role}</span>
                            <div className="flex flex-wrap gap-2 mt-0.5">
                              {ct.email&&<span className="flex items-center gap-1 text-[10px] text-gray-400">{ct.email}<a href={`mailto:${ct.email}`} className="hover:text-[#8B2214]" title="Enviar email"><Mail className="w-2.5 h-2.5"/></a></span>}
                              {ct.whatsapp&&<span className="flex items-center gap-1 text-[10px] text-gray-400">WA: {ct.whatsapp}<a href={`https://wa.me/${ct.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="hover:text-green-600" title="Abrir WhatsApp"><MessageCircle className="w-2.5 h-2.5"/></a></span>}
                              {ct.phone&&<span className="text-[10px] text-gray-400">Tel: {ct.phone}{ct.extension?" r."+ct.extension:""}</span>}
                            </div>
                          </div>
                          <button onClick={()=>deleteContact(ct.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><X className="w-3 h-3"/></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showContactForm===c.id&&(
                    <div className="bg-white border border-[#8B2214] rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-700">Novo Contato</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Nome *" value={contactForm.name} onChange={e=>setContactForm({...contactForm,name:e.target.value})} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
                        <select value={contactForm.role} onChange={e=>setContactForm({...contactForm,role:e.target.value})} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                          <option value="">Cargo *</option>
                          {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                        </select>
                        <input type="email" placeholder="Email" value={contactForm.email} onChange={e=>setContactForm({...contactForm,email:e.target.value})} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
                        <input type="text" placeholder="WhatsApp" value={contactForm.whatsapp} onChange={e=>setContactForm({...contactForm,whatsapp:e.target.value})} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
                        <input type="text" placeholder="Telefone" value={contactForm.phone} onChange={e=>setContactForm({...contactForm,phone:e.target.value})} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
                        <input type="text" placeholder="Ramal" value={contactForm.extension} onChange={e=>setContactForm({...contactForm,extension:e.target.value})} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>{setShowContactForm(null);setContactForm(EMPTY_CONTACT);}} className="flex-1 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600">Cancelar</button>
                        <button onClick={()=>saveContact(c.id)} disabled={saving||!contactForm.name||!contactForm.role} className="flex-1 py-1.5 bg-[#8B2214] text-white rounded-lg text-xs font-semibold disabled:opacity-50">{saving?"...":"Salvar"}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showBatchForm&&(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">{editingBatch?"Editar Lote":"Novo Lote"}</h3>
              <button onClick={()=>{setShowBatchForm(false);setEditingBatch(null);setBatchForm(EMPTY_BATCH);}} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Produto *</label>
                <select value={batchForm.product_id} onChange={e=>setBatchForm({...batchForm,product_id:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                  <option value="">Selecionar produto...</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Torrefadora *</label>
                <select value={batchForm.roasting_company_id} onChange={e=>setBatchForm({...batchForm,roasting_company_id:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                  <option value="">Selecionar...</option>
                  {companies.map(c=><option key={c.id} value={c.id}>{c.name} ({c.company_code})</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select value={batchForm.status} onChange={e=>setBatchForm({...batchForm,status:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                  {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select></div>
              {[["quantity_packages","Qtd Pacotes","number"],["production_date","Data de Producao","date"],["expiry_date","Validade","date"],["farm_name","Fazenda","text"],["variety","Variedade","text"],["altitude_m","Altitude (m)","number"],["sca_score","Score SCA","number"],["green_weight_kg","Peso Verde (kg)","number"],["green_cost_per_kg","Custo/kg Verde","number"]].map(([k,l,t])=>(
                <div key={k}><label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
                  <input type={t} step={t==="number"?"0.01":undefined} value={batchForm[k]||""} onChange={e=>setBatchForm({...batchForm,[k]:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent"/></div>
              ))}
              <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Notas Sensoriais</label>
                <input type="text" value={batchForm.sensory_notes||""} onChange={e=>setBatchForm({...batchForm,sensory_notes:e.target.value})} placeholder="Caramelo, nozes..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent"/></div>
              <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Observacoes</label>
                <textarea value={batchForm.notes||""} onChange={e=>setBatchForm({...batchForm,notes:e.target.value})} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#8B2214] focus:border-transparent"/></div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button onClick={()=>{setShowBatchForm(false);setEditingBatch(null);setBatchForm(EMPTY_BATCH);}} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
              <button onClick={saveBatch} disabled={saving||!batchForm.product_id} className="flex-1 py-2 bg-[#8B2214] text-white rounded-lg text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4"/>{saving?"Salvando...":"Salvar Lote"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCompanyForm&&(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">{editingCompany?"Editar Torrefadora":"Nova Torrefadora"}</h3>
              <button onClick={()=>{setShowCompanyForm(false);setEditingCompany(null);setCompanyForm(EMPTY_COMPANY);}} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([["name","Razao Social *","text","sm:col-span-2"],["cnpj","CNPJ","text",""],["inscricao_estadual","Insc. Estadual","text",""],["city","Cidade","text",""],["state","Estado","text",""],["cep","CEP","text",""],["company_code","Codigo","number",""],["director_name","Diretor","text",""],["email","Email","email","sm:col-span-2"],["whatsapp","WhatsApp","text",""]] as const).map(([k,l,t,span])=>(
                <div key={k} className={span}><label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
                  <input type={t} value={companyForm[k]||""} onChange={e=>setCompanyForm({...companyForm,[k]:t==="number"?Number(e.target.value):e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent"/></div>
              ))}
              <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Observacoes</label>
                <textarea value={companyForm.notes||""} onChange={e=>setCompanyForm({...companyForm,notes:e.target.value})} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#8B2214] focus:border-transparent"/></div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button onClick={()=>{setShowCompanyForm(false);setEditingCompany(null);setCompanyForm(EMPTY_COMPANY);}} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
              <button onClick={saveCompany} disabled={saving||!companyForm.name} className="flex-1 py-2 bg-[#8B2214] text-white rounded-lg text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-50">{saving?"Salvando...":"Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}