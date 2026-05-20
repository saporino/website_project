import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Package, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Building2, X, Save, UserPlus, Phone, Mail, MessageCircle } from "lucide-react";
import { CurrencyInput } from "../CurrencyInput";
import { formatBRL } from "../../utils/currency";
import DocumentUploadButton from "./DocumentUploadButton";

interface RoastingCompany { id:string; name:string; cnpj:string; city:string; state:string; cep:string; company_code:number; active:boolean; notes:string; director_name:string; email:string; whatsapp:string; inscricao_estadual:string; }
interface Contact { id:string; company_id:string; name:string; role:string; email:string; phone:string; whatsapp:string; extension:string; active:boolean; }
interface Batch { id:string; batch_number:string; product_id:string; product_name?:string; roasting_company_id:string; company_name?:string; status:string; quantity_packages:number; production_date:string; expiry_date:string; variety:string; altitude_m:number; farm_name:string; green_weight_kg:number; green_cost_per_kg:number; sca_score:number; sensory_notes:string; cost_per_250g:number; cost_per_500g:number; cost_per_1kg:number; notes:string; total_paid_brl?:number|null; ap_percentage?:number|null; price_per_point?:number|null; logistics_cost_brl?:number|null; green_input_to_roast_kg?:number|null; service_price_per_kg?:number|null; roasted_output_kg?:number|null; roast_date?:string|null; packaged_kg?:number|null; packaging_cost_per_kg?:number|null; packaging_date?:string|null; }
interface Product { id:string; name:string; stock:number; weight_grams:number; }

const ALLOWED_BATCH_FIELDS = ['batch_number','product_id','product_name','status','supplier_name','supplier_city','supplier_state','variety','altitude_meters','green_weight_kg','roast_date','roasted_by','roasted_weight_kg','roast_cost','roast_profile','roast_temperature','roast_duration_minutes','pkg_cost_250g','pkg_cost_500g','pkg_cost_1kg','pkg_cost_fardo5kg','label_cost_per_unit','plastic_wrap_cost_per_unit','fuel_cost','toll_cost','hotel_cost','food_cost','other_costs','samples_given_units','samples_unit_size_g','bonus_given_units','bonus_unit_size_g','total_variable_cost','total_bonus_cost','cost_per_100g','cost_per_250g','cost_per_500g','cost_per_1kg','cost_per_fardo5kg','units_produced_250g','units_produced_500g','units_produced_1kg','units_produced_fardo5kg','production_date','expiry_date','nf_purchase_url','supplier_certificate_url','quality_report_url','sensory_notes','sca_score','created_by','roasting_company_id','farm_name','farm_city','farm_state','altitude_m','quantity_packages','nf_url','notes','ap_percentage','price_per_point','total_paid_brl','logistics_cost_brl','logistics_breakdown','green_input_to_roast_kg','service_price_per_kg','roasted_output_kg','packaged_kg','packaging_cost_per_kg','roast_date','packaging_date'] as const;

const buildBatchPayload = (form: any, isNew: boolean, userEdited: boolean) => {
  const payload: any = {};
  for (const k of ALLOWED_BATCH_FIELDS) {
    if (form[k] !== undefined && form[k] !== '') payload[k] = form[k];
  }
  if (isNew && !userEdited) payload.batch_number = null;
  return payload;
};

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
  const [userEditedBatch, setUserEditedBatch] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string|null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string|null>(null);
  const [toast, setToast] = useState("");
  const [showRoastModal, setShowRoastModal] = useState(false);
  const [showPackagingModal, setShowPackagingModal] = useState(false);
  const [roastForm, setRoastForm] = useState<any>({ green_input_to_roast_kg:null, service_price_per_kg:null, roasted_output_kg:null, roast_date:null });
  const [packagingForm, setPackagingForm] = useState<any>({ packaged_kg:null, packaging_cost_per_kg:1.30, quantity_packages:null, packaging_date:null });
  const [transfers, setTransfers] = useState<any[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState<any>({ kind:'green', kg_amount:null, to_lot_id:'', notes:'' });

  useEffect(() => {
    if (editingBatch) {
      setRoastForm({ green_input_to_roast_kg:editingBatch.green_input_to_roast_kg??null, service_price_per_kg:editingBatch.service_price_per_kg??null, roasted_output_kg:editingBatch.roasted_output_kg??null, roast_date:editingBatch.roast_date??null });
      setPackagingForm({ packaged_kg:editingBatch.packaged_kg??null, packaging_cost_per_kg:editingBatch.packaging_cost_per_kg??1.30, quantity_packages:editingBatch.quantity_packages??null, packaging_date:editingBatch.packaging_date??null });
    }
  }, [editingBatch]);

  // Calcular qtd de pacotes automaticamente baseado em embalado_kg e package_weight_grams do produto
  useEffect(() => {
    if (!editingBatch?.product_id || !packagingForm.packaged_kg) return;
    const produto = products.find((p:any) => p.id === editingBatch.product_id);
    if (!produto?.weight_grams || produto.weight_grams <= 0) return;
    const pacotesCalc = Math.round((Number(packagingForm.packaged_kg) * 1000) / produto.weight_grams);
    setPackagingForm((prev:any) => ({ ...prev, quantity_packages: pacotesCalc }));
  }, [packagingForm.packaged_kg, editingBatch?.product_id, products]);

  useEffect(() => { loadAll(); }, []);

  // Preview batch_number client-side when roasting_company changes
  useEffect(() => {
    if (editingBatch || userEditedBatch) return;
    if (!batchForm.roasting_company_id) { setBatchForm((prev:any) => ({ ...prev, batch_number: '' })); return; }
    const roaster = companies.find((r:any) => r.id === batchForm.roasting_company_id);
    const code = roaster?.company_code != null ? String(roaster.company_code) : null;
    if (!code) return;
    const re = new RegExp('^' + code + '-(\\d+)$');
    const max = batches
      .filter((b:any) => b.roasting_company_id === batchForm.roasting_company_id)
      .map((b:any) => { const m = b.batch_number?.match(re); return m ? parseInt(m[1], 10) : 0; })
      .reduce((a:number, n:number) => Math.max(a, n), 0);
    setBatchForm((prev:any) => ({ ...prev, batch_number: code + '-' + String(max + 1).padStart(3, '0') }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchForm.roasting_company_id, editingBatch, userEditedBatch]);

  useEffect(() => { setUserEditedBatch(false); }, [editingBatch]);

  async function loadAll() {
    setLoading(true);
    const [{ data: b }, { data: c }, { data: p }, { data: ct }] = await Promise.all([
      supabase.from("green_coffee_lots").select("*, products(name), roasting_companies(name)").order("created_at", { ascending: false }),
      supabase.from("roasting_companies").select("*").order("company_code"),
      supabase.from("products").select("id,name,stock,weight_grams").order("name"),
      supabase.from("roasting_company_contacts").select("*").eq("active", true)
    ]);
    setBatches((b||[]).map((x:any)=>({...x})));
    setCompanies(c||[]);
    setProducts(p||[]);
    const ctMap:Record<string,Contact[]> = {};
    (ct||[]).forEach((x:Contact)=>{ if(!ctMap[x.company_id]) ctMap[x.company_id]=[]; ctMap[x.company_id].push(x); });
    setContacts(ctMap);
    const { data: tsData, error: tsError } = await supabase.from('lot_transfers').select('*').order('transferred_at', { ascending: false });
    if (!tsError) setTransfers(tsData || []);
    setLoading(false);
  }

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000); }

  async function saveBatch() {
    setSaving(true);
    const payload = buildBatchPayload(batchForm, !editingBatch, userEditedBatch);
    const {error}=editingBatch
      ?await supabase.from("green_coffee_lots").update(payload).eq("id",editingBatch.id)
      :await supabase.from("green_coffee_lots").insert([payload]);
    setSaving(false);
    if(error){console.error('saveBatch error:', JSON.stringify(error)); showToast("Erro: "+error.message);return;}
    showToast(editingBatch?"Lote atualizado!":"Lote criado!"); setShowBatchForm(false); setEditingBatch(null); setBatchForm(EMPTY_BATCH); setUserEditedBatch(false); loadAll();
  }

  async function deleteBatch(id:string){
    if(!confirm("Excluir este lote?")) return;
    await supabase.from("green_coffee_lots").delete().eq("id",id);
    showToast("Lote excluido."); loadAll();
  }

  const saveRoast = async () => {
    if (!editingBatch?.id) { alert('Salve o lote primeiro'); return; }
    const cruIn = Number(roastForm.green_input_to_roast_kg) || 0;
    const out = Number(roastForm.roasted_output_kg) || 0;
    const veCheck = getEffectiveVerde(editingBatch);
    if (cruIn > veCheck.total_kg) { alert(`Cru pra torra (${cruIn}kg) maior que verde disponivel (${veCheck.total_kg.toFixed(2)} kg, incluindo creditos recebidos)`); return; }
    if (out > cruIn) { alert(`Saida do forno (${out}kg) nao pode ser maior que o cru enviado (${cruIn}kg)`); return; }
    setSaving(true);
    const { error } = await supabase.from('green_coffee_lots').update({ green_input_to_roast_kg:roastForm.green_input_to_roast_kg, service_price_per_kg:roastForm.service_price_per_kg, roasted_output_kg:roastForm.roasted_output_kg, roast_date:roastForm.roast_date }).eq('id', editingBatch.id);
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setShowRoastModal(false);
    await loadAll();
    const { data: refreshed } = await supabase.from('green_coffee_lots').select('*').eq('id', editingBatch.id).single();
    if (refreshed) { setEditingBatch(refreshed as any); setBatchForm({...batchForm,...refreshed}); }
  };

  const savePackaging = async () => {
    if (!editingBatch?.id) { alert('Salve o lote primeiro'); return; }
    const emb = Number(packagingForm.packaged_kg) || 0;
    const teCheck = getEffectiveTorrado(editingBatch);
    if (teCheck.total_kg === 0) { alert('Registre a torra ou receba creditos de torrado antes de embalar'); return; }
    if (emb > teCheck.total_kg) { alert(`Embalado (${emb}kg) maior que torrado disponivel (${teCheck.total_kg.toFixed(2)} kg, incluindo creditos)`); return; }
    setSaving(true);
    const { error } = await supabase.from('green_coffee_lots').update({ packaged_kg:packagingForm.packaged_kg, packaging_cost_per_kg:packagingForm.packaging_cost_per_kg, quantity_packages:packagingForm.quantity_packages, packaging_date:packagingForm.packaging_date }).eq('id', editingBatch.id);
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setShowPackagingModal(false);
    await loadAll();
    const { data: refreshed } = await supabase.from('green_coffee_lots').select('*').eq('id', editingBatch.id).single();
    if (refreshed) { setEditingBatch(refreshed as any); setBatchForm({...batchForm,...refreshed}); }
  };

  const getRealBalances = (lote: any) => {
    if (!lote?.id) return { green_remaining:0, roasted_remaining:0, green_value:0, roasted_value:0, cost_per_kg_verde_efetivo:0, cost_per_kg_torrado_bruto:0 };
    const ve = getEffectiveVerde(lote);
    const te = getEffectiveTorrado(lote);
    const out = transfers.filter((t:any) => t.from_lot_id === lote.id);
    const greenOut = out.filter((t:any) => t.kind === 'green').reduce((s:number,t:any) => s + Number(t.kg_amount), 0);
    const roastedOut = out.filter((t:any) => t.kind === 'roasted').reduce((s:number,t:any) => s + Number(t.kg_amount), 0);
    const cru = Number(lote.green_input_to_roast_kg) || 0;
    const greenRemaining = ve.total_kg - cru - greenOut;
    const embalado = Number(lote.packaged_kg) || 0;
    const roastedRemaining = te.total_kg - embalado - roastedOut;
    return {
      green_remaining: greenRemaining,
      roasted_remaining: roastedRemaining,
      green_value: greenRemaining * ve.avg_cost_per_kg,
      roasted_value: roastedRemaining * te.avg_cost_per_kg,
      cost_per_kg_verde_efetivo: ve.avg_cost_per_kg,
      cost_per_kg_torrado_bruto: te.avg_cost_per_kg,
    };
  };
  const getEffectiveVerde = (lote: any) => {
    if (!lote?.id) return { total_kg:0, total_value:0, avg_cost_per_kg:0, own_kg:0, in_kg:0 };
    const incoming = getTransfersIn(lote.id).filter((t:any) => t.kind === 'green');
    const ownKg = Number(lote.green_weight_kg) || 0;
    const ownCostKg = Number(lote.cost_per_kg_verde_efetivo) || 0;
    const ownValue = ownKg * ownCostKg;
    const inKg = incoming.reduce((s:number,t:any) => s + Number(t.kg_amount), 0);
    const inValue = incoming.reduce((s:number,t:any) => s + Number(t.value_amount_brl), 0);
    const totalKg = ownKg + inKg;
    const totalValue = ownValue + inValue;
    return { total_kg:totalKg, total_value:totalValue, avg_cost_per_kg:totalKg>0?totalValue/totalKg:0, own_kg:ownKg, in_kg:inKg };
  };
  const getEffectiveTorrado = (lote: any) => {
    if (!lote?.id) return { total_kg:0, total_value:0, avg_cost_per_kg:0, own_kg:0, in_kg:0 };
    const ve = getEffectiveVerde(lote);
    const cru = Number(lote.green_input_to_roast_kg) || 0;
    const sp = Number(lote.service_price_per_kg) || 0;
    const outForno = Number(lote.roasted_output_kg) || 0;
    const ownTorradoValue = outForno > 0 ? (cru * ve.avg_cost_per_kg + cru * sp) : 0;
    const incoming = getTransfersIn(lote.id).filter((t:any) => t.kind === 'roasted');
    const inKg = incoming.reduce((s:number,t:any) => s + Number(t.kg_amount), 0);
    const inValue = incoming.reduce((s:number,t:any) => s + Number(t.value_amount_brl), 0);
    const totalKg = outForno + inKg;
    const totalValue = ownTorradoValue + inValue;
    return { total_kg:totalKg, total_value:totalValue, avg_cost_per_kg:totalKg>0?totalValue/totalKg:0, own_kg:outForno, in_kg:inKg };
  };
  const getTransfersOut = (loteId:string) => transfers
    .filter((t:any) => t.from_lot_id === loteId)
    .sort((a:any,b:any) => { if(a.kind!==b.kind) return a.kind==='green'?-1:1; return new Date(a.transferred_at).getTime()-new Date(b.transferred_at).getTime(); });
  const getTransfersIn = (loteId:string) => transfers
    .filter((t:any) => t.to_lot_id === loteId)
    .sort((a:any,b:any) => { if(a.kind!==b.kind) return a.kind==='green'?-1:1; return new Date(a.transferred_at).getTime()-new Date(b.transferred_at).getTime(); });
  const getLoteByName = (loteId:string) => batches.find(b => b.id === loteId);

  const saveTransfer = async () => {
    if (!editingBatch?.id) { alert('Salve o lote primeiro'); return; }
    if (!transferForm.to_lot_id) { alert('Selecione o lote destino'); return; }
    if (transferForm.to_lot_id === editingBatch.id) { alert('Lote destino nao pode ser o proprio'); return; }
    const kg = Number(transferForm.kg_amount) || 0;
    if (kg <= 0) { alert('Quantidade invalida'); return; }
    const realBal = getRealBalances(editingBatch);
    let unitCost = 0;
    if (transferForm.kind === 'green') {
      if (kg > realBal.green_remaining) { alert(`Quantidade (${kg}kg) maior que saldo verde disponivel (${realBal.green_remaining.toFixed(2)} kg)`); return; }
      unitCost = realBal.cost_per_kg_verde_efetivo;
    } else {
      if (realBal.cost_per_kg_torrado_bruto === 0) { alert('Este lote ainda nao tem torra registrada'); return; }
      if (kg > realBal.roasted_remaining) { alert(`Quantidade (${kg}kg) maior que saldo torrado disponivel (${realBal.roasted_remaining.toFixed(2)} kg)`); return; }
      unitCost = realBal.cost_per_kg_torrado_bruto;
    }
    setSaving(true);
    const { error } = await supabase.from('lot_transfers').insert({ from_lot_id:editingBatch.id, to_lot_id:transferForm.to_lot_id, kind:transferForm.kind, kg_amount:kg, unit_cost_brl:unitCost, notes:transferForm.notes||null });
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setShowTransferModal(false);
    setTransferForm({ kind:'green', kg_amount:null, to_lot_id:'', notes:'' });
    await loadAll();
  };

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
                    <p className="text-xs text-gray-500">Cód: {c.company_code} · {c.cnpj} · {c.city}/{c.state}</p>
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
              {/* Linha 1: Torrefadora + Lote # */}
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Torrefadora *</label>
                <select value={batchForm.roasting_company_id} onChange={e=>setBatchForm({...batchForm,roasting_company_id:e.target.value})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded">
                  <option value="">Selecionar...</option>
                  {companies.map(c=><option key={c.id} value={c.id}>{c.name} ({c.company_code})</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Lote #{!editingBatch&&<span className="text-gray-400 font-normal ml-1">(auto)</span>}</label>
                <input type="text" value={batchForm.batch_number||""} onChange={e=>{setUserEditedBatch(true);setBatchForm({...batchForm,batch_number:e.target.value});}} placeholder={!batchForm.roasting_company_id?"Selecione uma torrefadora":"Ex: 750-001"} className={`w-full h-[34px] px-3 text-sm border border-gray-300 rounded ${(!editingBatch&&!userEditedBatch)?"bg-gray-50 text-gray-500":"bg-white"}`}/></div>
              {/* Linha 2: Produto + Status */}
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Produto *</label>
                <select value={batchForm.product_id} onChange={e=>setBatchForm({...batchForm,product_id:e.target.value})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded">
                  <option value="">Selecionar produto...</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select value={batchForm.status} onChange={e=>setBatchForm({...batchForm,status:e.target.value})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded">
                  {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select></div>
              {[["quantity_packages","Qtd Pacotes","number"],["production_date","Data de Producao","date"],["expiry_date","Validade","date"],["farm_name","Fazenda","text"],["variety","Variedade","text"],["altitude_m","Altitude (m)","number"],["sca_score","Score SCA","number"]].map(([k,l,t])=>(
                <div key={k}><label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
                  <input type={t} step={t==="number"?"0.01":undefined} value={batchForm[k]||""} onChange={e=>setBatchForm({...batchForm,[k]:e.target.value})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
              ))}
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Peso Verde (kg)</label>
                <div className="flex items-start gap-2">
                  <input type="number" step="0.01" value={batchForm.green_weight_kg||""} onChange={e=>setBatchForm({...batchForm,green_weight_kg:e.target.value})} className="flex-1 w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/>
                  <DocumentUploadButton lotId={editingBatch?.id} kind="compra_verde" label="Comprovante compra do verde"/>
                </div>
              </div>
              {/* Valor total pago + Logistica 4 campos */}
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Valor total pago (R$)</label>
                <div className="flex items-start gap-2">
                  <CurrencyInput value={batchForm.total_paid_brl} onChange={v=>setBatchForm({...batchForm,total_paid_brl:v})} placeholder="27.360,00" className="flex-1 w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/>
                  <DocumentUploadButton lotId={editingBatch?.id} kind="nota_fiscal" label="NF e impostos" allowMultiple={true}/>
                </div>
              </div>
              <div className="sm:col-span-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">Logistica da compra</p>
                <div className="grid grid-cols-2 gap-2">
                  {([['fuel','Combustivel'],['tolls','Pedagio'],['hotel','Hotel'],['food','Comida']] as const).map(([key,label])=>(
                    <div key={key}><label className="block text-xs font-medium text-gray-600 mb-1">{label} (R$)</label>
                      <CurrencyInput
                        value={(batchForm.logistics_breakdown as any)?.[key]??null}
                        onChange={v=>{
                          const bd={...(batchForm.logistics_breakdown??{}), [key]:v};
                          const total=(bd.fuel??0)+(bd.tolls??0)+(bd.hotel??0)+(bd.food??0);
                          setBatchForm({...batchForm,logistics_breakdown:bd,logistics_cost_brl:total});
                        }}
                        placeholder="0,00"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent"
                      /></div>
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold text-gray-800">Total: {formatBRL(batchForm.logistics_cost_brl??0)}</p>
              </div>
              {/* AP% + R$/ponto */}
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">AP % (Aproveitamento)</label>
                <input type="number" step="0.01" value={batchForm.ap_percentage??""} onChange={e=>setBatchForm({...batchForm,ap_percentage:e.target.value===''?null:parseFloat(e.target.value)})} placeholder="Ex: 95" className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">R$/ponto</label>
                <CurrencyInput value={batchForm.price_per_point} onChange={v=>setBatchForm({...batchForm,price_per_point:v})} placeholder="24,00" className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
              {/* Painel cadeia de custos */}
              {editingBatch&&(()=>{
                const peso=Number(editingBatch.green_weight_kg)||0;
                const pago=Number(editingBatch.total_paid_brl)||0;
                const ap=Number(editingBatch.ap_percentage)||0;
                const ppp=Number(editingBatch.price_per_point)||0;
                if(peso===0||pago===0) return null;
                const ve=getEffectiveVerde(editingBatch);
                const te=getEffectiveTorrado(editingBatch);
                const rb=getRealBalances(editingBatch);
                const cKgPuro=pago/peso;
                const cKgEfetivoProprio=(pago+Number(editingBatch.logistics_cost_brl||0))/peso;
                const cKgRef=ap&&ppp?(ap/100)*ppp:null;
                const cruIn=Number(editingBatch.green_input_to_roast_kg)||0;
                const sp=Number(editingBatch.service_price_per_kg)||0;
                const outForno=Number(editingBatch.roasted_output_kg)||0;
                const embalado=Number(editingBatch.packaged_kg)||0;
                const embPrice=Number(editingBatch.packaging_cost_per_kg)||0;
                const showTorra=cruIn>0&&outForno>0&&sp>0;
                const showEmb=embalado>0&&te.total_kg>0;
                const servTotal=cruIn*sp;
                const shrinkage=showTorra?((cruIn-outForno)/cruIn)*100:0;
                const sobraTorrado=te.total_kg-embalado;
                const valorCreditoTorrado=sobraTorrado>0?sobraTorrado*te.avg_cost_per_kg:0;
                const cFinalKg=showEmb?te.avg_cost_per_kg+embPrice:0;
                return(
                  <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                    <p className="font-semibold text-amber-900">Cadeia de custos do lote</p>
                    <div className="border-b border-amber-200 pb-2">
                      <p className="font-medium text-amber-800 mb-1">1. Compra (verde)</p>
                      <div className="grid grid-cols-2 gap-1">
                        <div>Custo/kg puro: <strong>{formatBRL(cKgPuro)}</strong></div>
                        <div>Custo/kg efetivo: <strong>{formatBRL(cKgEfetivoProprio)}</strong></div>
                        {cKgRef!==null&&<div className="col-span-2">Cotacao ref. (AP×R$/ponto): {formatBRL(cKgRef)}/kg</div>}
                        {ve.in_kg>0&&<div className="col-span-2 text-blue-700">Verde recebido: {ve.in_kg.toFixed(1)} kg | Total: {ve.total_kg.toFixed(1)} kg | Custo medio: {formatBRL(ve.avg_cost_per_kg)}/kg</div>}
                      </div>
                    </div>
                    {showTorra&&(
                      <div className="border-b border-amber-200 pb-2">
                        <p className="font-medium text-amber-800 mb-1">2. Torra</p>
                        <div className="grid grid-cols-2 gap-1">
                          <div>Quebra fisica: <strong>{shrinkage.toFixed(2)}%</strong></div>
                          <div>Custo servico: <strong>{formatBRL(servTotal)}</strong></div>
                          <div className="col-span-2">Custo/kg torrado (puro, sem embalagem): <strong>{formatBRL((cruIn*ve.avg_cost_per_kg+servTotal)/outForno)}</strong></div>
                          {te.in_kg>0&&<div className="col-span-2 text-blue-700">Torrado recebido: {te.in_kg.toFixed(1)} kg | Total: {te.total_kg.toFixed(1)} kg | Custo medio: {formatBRL(te.avg_cost_per_kg)}/kg</div>}
                          {sobraTorrado>0&&(<>
                            <div>Sobra torrado: <strong>{sobraTorrado.toFixed(1)} kg</strong></div>
                            <div>Credito torrado: <strong>{formatBRL(valorCreditoTorrado)}</strong></div>
                            <div className="col-span-2 text-xs text-gray-600 italic">(sobra disponivel pra transferir/embalar — sem custo de embalagem ate ser embalada)</div>
                          </>)}
                        </div>
                      </div>
                    )}
                    {showEmb&&(
                      <div className="border-b border-amber-200 pb-2">
                        <p className="font-medium text-amber-800 mb-1">3. Embalagem</p>
                        <div className="grid grid-cols-2 gap-1">
                          <div>Embalado: <strong>{embalado.toFixed(1)} kg</strong></div>
                          <div>Custo embalagem (material): <strong>{formatBRL(embPrice)}/kg</strong></div>
                          <div className="col-span-2 text-xs text-gray-600">{formatBRL(te.avg_cost_per_kg)}/kg torrado + {formatBRL(embPrice)}/kg embalagem = <strong className="text-amber-900">{formatBRL(cFinalKg)}/kg</strong></div>
                          <div className="col-span-2 font-semibold text-amber-900 border-t border-amber-200 pt-1 mt-1">Custo final por kg embalado: {formatBRL(cFinalKg)}</div>
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-amber-800 mb-1">Saldos atuais (apos transferencias)</div>
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <div>Verde sobrando: <strong>{rb.green_remaining.toFixed(1)} kg</strong></div>
                        <div className="text-right"><strong>{formatBRL(rb.green_value)}</strong>
                          {rb.green_remaining>0.001&&<button type="button" onClick={()=>{setTransferForm({kind:'green',kg_amount:rb.green_remaining,to_lot_id:'',notes:''});setShowTransferModal(true);}} className="ml-2 text-xs underline text-amber-900 hover:text-amber-700">Transferir</button>}
                        </div>
                        {rb.roasted_remaining>0&&(<>
                          <div>Torrado solto: <strong>{rb.roasted_remaining.toFixed(1)} kg</strong></div>
                          <div className="text-right"><strong>{formatBRL(rb.roasted_value)}</strong>
                            <button type="button" onClick={()=>{setTransferForm({kind:'roasted',kg_amount:rb.roasted_remaining,to_lot_id:'',notes:''});setShowTransferModal(true);}} className="ml-2 text-xs underline text-amber-900 hover:text-amber-700">Transferir</button>
                          </div>
                        </>)}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {editingBatch&&(()=>{
                const out=getTransfersOut(editingBatch.id);
                const incoming=getTransfersIn(editingBatch.id);
                if(out.length===0&&incoming.length===0) return null;
                return(
                  <div className="sm:col-span-2 border border-blue-200 bg-blue-50 rounded p-3 text-sm space-y-2">
                    <div className="font-semibold text-blue-900">Movimentacoes do lote</div>
                    {out.length>0&&(
                      <div>
                        <div className="font-medium text-blue-800 text-xs mb-1">Transferido para outros lotes:</div>
                        {out.map((t:any)=>{
                          const dest=getLoteByName(t.to_lot_id);
                          return(<div key={t.id} className="text-xs flex justify-between">
                            <span>→ {dest?.batch_number??'?'} | {Number(t.kg_amount).toFixed(1)} kg {t.kind==='green'?'verde':'torrado'}</span>
                            <span>{formatBRL(Number(t.value_amount_brl))}</span>
                          </div>);
                        })}
                      </div>
                    )}
                    {incoming.length>0&&(
                      <div>
                        <div className="font-medium text-blue-800 text-xs mb-1">Creditos recebidos:</div>
                        {incoming.map((t:any)=>{
                          const src=getLoteByName(t.from_lot_id);
                          return(<div key={t.id} className="text-xs flex justify-between">
                            <span>← {src?.batch_number??'?'} | {Number(t.kg_amount).toFixed(1)} kg {t.kind==='green'?'verde':'torrado'}</span>
                            <span>{formatBRL(Number(t.value_amount_brl))}</span>
                          </div>);
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
              {editingBatch&&(
                <div className="sm:col-span-2 border-t pt-3 mt-1 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Operacoes do lote</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={()=>setShowRoastModal(true)} className="px-4 py-2 border border-amber-600 text-amber-700 rounded hover:bg-amber-50 text-sm font-medium">
                      {editingBatch.roasted_output_kg?'Editar torra':'Registrar torra'}
                    </button>
                    <button type="button" onClick={()=>setShowPackagingModal(true)} disabled={!editingBatch.roasted_output_kg} className="px-4 py-2 border border-green-700 text-green-700 rounded hover:bg-green-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed" title={!editingBatch.roasted_output_kg?'Registre a torra primeiro':''}>
                      {editingBatch.packaged_kg?'Editar embalagem':'Registrar embalagem'}
                    </button>
                  </div>
                </div>
              )}
              <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Notas Sensoriais</label>
                <input type="text" value={batchForm.sensory_notes||""} onChange={e=>setBatchForm({...batchForm,sensory_notes:e.target.value})} placeholder="Caramelo, nozes..." className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
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
                  <input type={t} value={companyForm[k]||""} onChange={e=>setCompanyForm({...companyForm,[k]:t==="number"?Number(e.target.value):e.target.value})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
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
      {/* SUB-MODAL: Torra */}
      {showRoastModal&&editingBatch&&(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-base font-semibold">Registrar Torra — {editingBatch.batch_number}</h3>
              <button onClick={()=>setShowRoastModal(false)} className="text-gray-500 hover:text-gray-700 text-lg">×</button>
            </div>
            <div className="p-4 space-y-3">
              {(()=>{
                const ve=getEffectiveVerde(editingBatch);
                return(
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded space-y-1">
                    <div>Verde disponivel: <strong>{ve.total_kg.toFixed(1)} kg</strong> (custo medio {formatBRL(ve.avg_cost_per_kg)}/kg)</div>
                    {ve.in_kg>0&&<div className="text-xs text-blue-700">Proprio: {ve.own_kg.toFixed(1)} kg + Recebido em credito: {ve.in_kg.toFixed(1)} kg</div>}
                  </div>
                );
              })()}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Cru enviado pra torra (kg)</label>
                <input type="number" step="0.01" value={roastForm.green_input_to_roast_kg??''} onChange={e=>setRoastForm({...roastForm,green_input_to_roast_kg:e.target.value===''?null:parseFloat(e.target.value)})} placeholder="Ex: 1053" className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">R$/kg do servico de torra</label>
                <div className="flex items-start gap-2">
                  <CurrencyInput value={roastForm.service_price_per_kg} onChange={v=>setRoastForm({...roastForm,service_price_per_kg:v})} placeholder="Ex: 3,00" className="flex-1 w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/>
                  <DocumentUploadButton lotId={editingBatch?.id} kind="pagamento_torra" label="PIX da torra (Bruno)"/>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Saida do forno (kg torrado)</label>
                <input type="number" step="0.01" value={roastForm.roasted_output_kg??''} onChange={e=>setRoastForm({...roastForm,roasted_output_kg:e.target.value===''?null:parseFloat(e.target.value)})} placeholder="Ex: 850" className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Quebra fisica (%)</label>
                <input type="number" step="0.01"
                  value={roastForm.green_input_to_roast_kg&&roastForm.roasted_output_kg
                    ?(((Number(roastForm.green_input_to_roast_kg)-Number(roastForm.roasted_output_kg))/Number(roastForm.green_input_to_roast_kg))*100).toFixed(2)
                    :''}
                  onChange={e=>{
                    const novaQuebra=parseFloat(e.target.value);
                    const cruIn=Number(roastForm.green_input_to_roast_kg)||0;
                    if(cruIn>0&&!isNaN(novaQuebra)){
                      const novaSaida=Math.round((cruIn*(1-novaQuebra/100))*1000)/1000;
                      setRoastForm({...roastForm,roasted_output_kg:novaSaida});
                    }
                  }}
                  placeholder="Ex: 22"
                  className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/>
                <p className="text-xs text-gray-500 mt-1">Editar a quebra recalcula a saida do forno automaticamente.</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Data da torra</label>
                <input type="date" value={roastForm.roast_date??''} onChange={e=>setRoastForm({...roastForm,roast_date:e.target.value||null})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button type="button" onClick={()=>setShowRoastModal(false)} className="px-4 py-2 border rounded">Cancelar</button>
              <button type="button" onClick={saveRoast} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">{saving?'Salvando...':'Salvar torra'}</button>
            </div>
          </div>
        </div>
      )}
      {/* SUB-MODAL: Embalagem */}
      {showPackagingModal&&editingBatch&&(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-base font-semibold">Registrar Embalagem — {editingBatch.batch_number}</h3>
              <button onClick={()=>setShowPackagingModal(false)} className="text-gray-500 hover:text-gray-700 text-lg">×</button>
            </div>
            <div className="p-4 space-y-3">
              {(()=>{
                const te=getEffectiveTorrado(editingBatch);
                return(
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded space-y-1">
                    <div>Torrado disponivel: <strong>{te.total_kg.toFixed(1)} kg</strong> (custo medio {formatBRL(te.avg_cost_per_kg)}/kg)</div>
                    {te.in_kg>0&&<div className="text-xs text-blue-700">Da torra deste lote: {te.own_kg.toFixed(1)} kg + Recebido em credito: {te.in_kg.toFixed(1)} kg</div>}
                  </div>
                );
              })()}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Embalado (kg)</label>
                <input type="number" step="0.01" value={packagingForm.packaged_kg??''} onChange={e=>setPackagingForm({...packagingForm,packaged_kg:e.target.value===''?null:parseFloat(e.target.value)})} placeholder="Ex: 750" className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Custo embalagem (R$/kg)</label>
                <div className="flex items-start gap-2">
                  <CurrencyInput value={packagingForm.packaging_cost_per_kg} onChange={v=>setPackagingForm({...packagingForm,packaging_cost_per_kg:v})} placeholder="1,30" className="flex-1 w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/>
                  <DocumentUploadButton lotId={editingBatch?.id} kind="pagamento_embalagem" label="Comprovante embalagem"/>
                </div>
              </div>
              {(()=>{
                const produto=products.find((p:any)=>p.id===editingBatch?.product_id);
                const pesoPacote=produto?.weight_grams??500;
                return(
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">
                    Qtd de pacotes <span className="text-xs text-gray-500">(pacote {pesoPacote}g — calc. automatico)</span>
                  </label>
                    <input type="number" step="1" value={packagingForm.quantity_packages??''} onChange={e=>setPackagingForm({...packagingForm,quantity_packages:e.target.value===''?null:parseInt(e.target.value)})} placeholder="Ex: 1500" className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/>
                    {packagingForm.packaged_kg&&pesoPacote&&(
                      <div className="text-xs text-gray-500 mt-1">{Number(packagingForm.packaged_kg).toFixed(1)} kg ÷ {pesoPacote}g = <strong>{Math.round((Number(packagingForm.packaged_kg)*1000)/pesoPacote)} pacotes</strong>. Edite acima para sobrescrever.</div>
                    )}
                  </div>
                );
              })()}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Data da embalagem</label>
                <input type="date" value={packagingForm.packaging_date??''} onChange={e=>setPackagingForm({...packagingForm,packaging_date:e.target.value||null})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button type="button" onClick={()=>setShowPackagingModal(false)} className="px-4 py-2 border rounded">Cancelar</button>
              <button type="button" onClick={savePackaging} disabled={saving} className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50">{saving?'Salvando...':'Salvar embalagem'}</button>
            </div>
          </div>
        </div>
      )}
      {/* SUB-MODAL: Transferencia */}
      {showTransferModal&&editingBatch&&(()=>{
        const rb=getRealBalances(editingBatch);
        const saldoDisponivel=transferForm.kind==='green'?rb.green_remaining:rb.roasted_remaining;
        const unitCost=transferForm.kind==='green'?rb.cost_per_kg_verde_efetivo:rb.cost_per_kg_torrado_bruto;
        const lotesDestino=batches.filter(b=>b.id!==editingBatch.id&&b.status==='active');
        return(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">Transferir saldo do {editingBatch.batch_number}</h3>
                <button onClick={()=>setShowTransferModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select value={transferForm.kind} onChange={e=>setTransferForm({...transferForm,kind:e.target.value})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded">
                      <option value="green">Verde (cru)</option>
                      <option value="roasted">Torrado solto</option>
                    </select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Lote destino</label>
                    <select value={transferForm.to_lot_id} onChange={e=>setTransferForm({...transferForm,to_lot_id:e.target.value})} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded">
                      <option value="">Selecionar lote...</option>
                      {lotesDestino.map((b:any)=>(<option key={b.id} value={b.id}>{b.batch_number}</option>))}
                    </select></div>
                </div>
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  Saldo disponivel: <strong>{saldoDisponivel.toFixed(2)} kg</strong><br/>
                  Custo unitario: <strong>{formatBRL(unitCost)}/kg</strong>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantidade a transferir (kg)</label>
                  <input type="number" step="0.01" value={transferForm.kg_amount??''} onChange={e=>setTransferForm({...transferForm,kg_amount:e.target.value===''?null:parseFloat(e.target.value)})} placeholder={`Ex: ${saldoDisponivel.toFixed(0)}`} className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/>
                  <div className="text-xs text-gray-500 mt-1">Valor da transferencia: <strong>{formatBRL((Number(transferForm.kg_amount)||0)*unitCost)}</strong></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <input type="text" value={transferForm.notes??''} onChange={e=>setTransferForm({...transferForm,notes:e.target.value})} placeholder="Ex: sobra do lote anterior" className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"/></div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <button type="button" onClick={()=>setShowTransferModal(false)} className="px-4 py-2 border rounded">Cancelar</button>
                <button type="button" onClick={saveTransfer} disabled={saving} className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50">{saving?'Salvando...':'Confirmar transferencia'}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
