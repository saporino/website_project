import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Package, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Building2, X, Save } from "lucide-react";

interface RoastingCompany { id: string; name: string; cnpj: string; city: string; state: string; company_code: number; active: boolean; notes: string; }
interface Batch {
  id: string; batch_number: string; product_id: string; product_name?: string;
  roasting_company_id: string; company_name?: string;
  status: string; quantity_packages: number;
  production_date: string; expiry_date: string;
  variety: string; altitude_m: number;
  farm_name: string; farm_city: string; farm_state: string;
  green_weight_kg: number; green_cost_per_kg: number;
  roast_date: string; roast_profile: string; sca_score: number; sensory_notes: string;
  cost_per_250g: number; cost_per_500g: number; cost_per_1kg: number;
  nf_url: string; notes: string;
}
interface Product { id: string; name: string; stock: number; }

const EMPTY_BATCH = { product_id:"", roasting_company_id:"", status:"active", quantity_packages:0, production_date:"", expiry_date:"", variety:"", altitude_m:0, farm_name:"", farm_city:"", farm_state:"", green_weight_kg:0, green_cost_per_kg:0, roast_date:"", roast_profile:"", sca_score:0, sensory_notes:"", nf_url:"", notes:"" };
const EMPTY_COMPANY = { name:"", cnpj:"", city:"", state:"", cep:"", company_code:0, notes:"" };
const STATUS_LABELS: Record<string,string> = { active:"Ativo", consumed:"Consumido", reserved:"Reservado", cancelled:"Cancelado" };
const STATUS_COLORS: Record<string,string> = { active:"bg-green-100 text-green-800", consumed:"bg-gray-100 text-gray-600", reserved:"bg-amber-100 text-amber-800", cancelled:"bg-red-100 text-red-800" };

export default function BatchManagement() {
  const [tab, setTab] = useState<"batches"|"companies">("batches");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [companies, setCompanies] = useState<RoastingCompany[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch|null>(null);
  const [editingCompany, setEditingCompany] = useState<RoastingCompany|null>(null);
  const [batchForm, setBatchForm] = useState<any>(EMPTY_BATCH);
  const [companyForm, setCompanyForm] = useState<any>(EMPTY_COMPANY);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string|null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: b }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("product_batches").select("*, products(name), roasting_companies(name)").order("created_at", { ascending: false }),
      supabase.from("roasting_companies").select("*").order("company_code"),
      supabase.from("products").select("id,name,stock").order("name")
    ]);
    setBatches((b||[]).map((x:any) => ({ ...x, product_name: x.products?.name, company_name: x.roasting_companies?.name })));
    setCompanies(c||[]);
    setProducts(p||[]);
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function saveBatch() {
    setSaving(true);
    const payload = { ...batchForm, altitude_m: Number(batchForm.altitude_m)||0, quantity_packages: Number(batchForm.quantity_packages)||0, green_weight_kg: Number(batchForm.green_weight_kg)||0, green_cost_per_kg: Number(batchForm.green_cost_per_kg)||0, sca_score: Number(batchForm.sca_score)||null };
    const { error } = editingBatch
      ? await supabase.from("product_batches").update(payload).eq("id", editingBatch.id)
      : await supabase.from("product_batches").insert([payload]);
    setSaving(false);
    if (error) { showToast("Erro: " + error.message); return; }
    showToast(editingBatch ? "Lote atualizado!" : "Lote criado!");
    setShowBatchForm(false); setEditingBatch(null); setBatchForm(EMPTY_BATCH);
    loadAll();
  }

  async function deleteBatch(id: string) {
    if (!confirm("Excluir este lote?")) return;
    await supabase.from("product_batches").delete().eq("id", id);
    showToast("Lote excluido."); loadAll();
  }

  async function saveCompany() {
    setSaving(true);
    const { error } = editingCompany
      ? await supabase.from("roasting_companies").update(companyForm).eq("id", editingCompany.id)
      : await supabase.from("roasting_companies").insert([companyForm]);
    setSaving(false);
    if (error) { showToast("Erro: " + error.message); return; }
    showToast(editingCompany ? "Torrefadora atualizada!" : "Torrefadora cadastrada!");
    setShowCompanyForm(false); setEditingCompany(null); setCompanyForm(EMPTY_COMPANY);
    loadAll();
  }

  const filtered = batches.filter(b =>
    (!filterProduct || b.product_id === filterProduct) &&
    (!filterStatus || b.status === filterStatus)
  );

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-[#8B2214] text-white px-4 py-2 rounded-lg text-sm shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventario</h2>
          <p className="text-sm text-gray-500">Lotes de producao e torrefadoras</p>
        </div>
        <button onClick={() => { tab === "batches" ? setShowBatchForm(true) : setShowCompanyForm(true); }}
          className="flex items-center gap-2 bg-[#8B2214] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6d1a10]">
          <Plus className="w-4 h-4" />
          {tab === "batches" ? "Novo Lote" : "Nova Torrefadora"}
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([["batches","Lotes"],["companies","Torrefadoras"]] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===k ? "border-[#8B2214] text-[#8B2214]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "batches" && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1">
              <option value="">Todos os produtos</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock})</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Todos status</option>
              {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nenhum lote encontrado</p>
              <button onClick={() => setShowBatchForm(true)} className="mt-3 text-[#8B2214] text-sm font-semibold hover:underline">Criar primeiro lote</button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(b => (
                <div key={b.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#8B2214]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">{b.batch_number || "Sem numero"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                        </div>
                        <p className="text-xs text-gray-500">{b.product_name} · {b.company_name} · {b.quantity_packages} pacotes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2 hidden sm:block">
                        {b.cost_per_500g > 0 && <p className="text-xs text-gray-500">Custo 500g: <span className="font-semibold text-gray-800">R$ {b.cost_per_500g?.toFixed(2)}</span></p>}
                        {b.sca_score > 0 && <p className="text-xs text-amber-600">SCA: {b.sca_score}</p>}
                      </div>
                      <button onClick={() => setExpandedBatch(expandedBatch === b.id ? null : b.id)} className="p-1.5 hover:bg-gray-100 rounded">
                        {expandedBatch === b.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button onClick={() => { setEditingBatch(b); setBatchForm({...b}); setShowBatchForm(true); }} className="p-1.5 hover:bg-gray-100 rounded text-blue-600"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteBatch(b.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {expandedBatch === b.id && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><p className="text-gray-400 uppercase tracking-wide">Producao</p><p className="font-medium">{b.production_date || "-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Validade</p><p className="font-medium">{b.expiry_date || "-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Fazenda</p><p className="font-medium">{b.farm_name || "-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Variedade</p><p className="font-medium">{b.variety || "-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Altitude</p><p className="font-medium">{b.altitude_m ? b.altitude_m+"m" : "-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Peso Verde</p><p className="font-medium">{b.green_weight_kg ? b.green_weight_kg+"kg" : "-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Custo/250g</p><p className="font-medium">{b.cost_per_250g ? "R$ "+b.cost_per_250g?.toFixed(2) : "-"}</p></div>
                      <div><p className="text-gray-400 uppercase tracking-wide">Custo/1kg</p><p className="font-medium">{b.cost_per_1kg ? "R$ "+b.cost_per_1kg?.toFixed(2) : "-"}</p></div>
                      {b.sensory_notes && <div className="col-span-2 sm:col-span-4"><p className="text-gray-400 uppercase tracking-wide">Notas Sensoriais</p><p className="font-medium">{b.sensory_notes}</p></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "companies" && (
        <div className="space-y-2">
          {companies.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#8B2214]" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">Cod: {c.company_code} · CNPJ: {c.cnpj} · {c.city}/{c.state}</p>
                </div>
              </div>
              <button onClick={() => { setEditingCompany(c); setCompanyForm({...c}); setShowCompanyForm(true); }} className="p-1.5 hover:bg-gray-100 rounded text-blue-600"><Edit2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {showBatchForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">{editingBatch ? "Editar Lote" : "Novo Lote"}</h3>
              <button onClick={() => { setShowBatchForm(false); setEditingBatch(null); setBatchForm(EMPTY_BATCH); }} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Produto *</label>
                <select value={batchForm.product_id} onChange={e => setBatchForm({...batchForm, product_id:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                  <option value="">Selecionar produto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Torrefadora *</label>
                <select value={batchForm.roasting_company_id} onChange={e => setBatchForm({...batchForm, roasting_company_id:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                  <option value="">Selecionar torrefadora...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company_code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select value={batchForm.status} onChange={e => setBatchForm({...batchForm, status:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                  {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd Pacotes</label>
                <input type="number" min="0" value={batchForm.quantity_packages} onChange={e => setBatchForm({...batchForm, quantity_packages:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data Producao</label>
                <input type="date" value={batchForm.production_date} onChange={e => setBatchForm({...batchForm, production_date:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Validade</label>
                <input type="date" value={batchForm.expiry_date} onChange={e => setBatchForm({...batchForm, expiry_date:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fazenda</label>
                <input type="text" value={batchForm.farm_name} onChange={e => setBatchForm({...batchForm, farm_name:e.target.value})} placeholder="Nome da fazenda" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Variedade</label>
                <input type="text" value={batchForm.variety} onChange={e => setBatchForm({...batchForm, variety:e.target.value})} placeholder="Bourbon, Catuai..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Altitude (m)</label>
                <input type="number" value={batchForm.altitude_m} onChange={e => setBatchForm({...batchForm, altitude_m:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Score SCA</label>
                <input type="number" step="0.1" min="0" max="100" value={batchForm.sca_score} onChange={e => setBatchForm({...batchForm, sca_score:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Peso Verde (kg)</label>
                <input type="number" step="0.1" value={batchForm.green_weight_kg} onChange={e => setBatchForm({...batchForm, green_weight_kg:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Custo/kg Verde (R$)</label>
                <input type="number" step="0.01" value={batchForm.green_cost_per_kg} onChange={e => setBatchForm({...batchForm, green_cost_per_kg:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notas Sensoriais</label>
                <input type="text" value={batchForm.sensory_notes} onChange={e => setBatchForm({...batchForm, sensory_notes:e.target.value})} placeholder="Caramelo, nozes, frutas vermelhas..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observacoes</label>
                <textarea value={batchForm.notes} onChange={e => setBatchForm({...batchForm, notes:e.target.value})} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button onClick={() => { setShowBatchForm(false); setEditingBatch(null); setBatchForm(EMPTY_BATCH); }} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveBatch} disabled={saving || !batchForm.product_id} className="flex-1 py-2 bg-[#8B2214] text-white rounded-lg text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar Lote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompanyForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">{editingCompany ? "Editar Torrefadora" : "Nova Torrefadora"}</h3>
              <button onClick={() => { setShowCompanyForm(false); setEditingCompany(null); setCompanyForm(EMPTY_COMPANY); }} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-3">
              {([["name","Nome *","text","Razao social"],["cnpj","CNPJ","text","00.000.000/0001-00"],["city","Cidade","text",""],["state","Estado","text","MG"],["cep","CEP","text","00000-000"],["company_code","Codigo (ex: 750)","number","750"]] as const).map(([k,l,t,ph]) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
                  <input type={t} value={companyForm[k]||""} onChange={e => setCompanyForm({...companyForm, [k]: t==="number" ? Number(e.target.value) : e.target.value})} placeholder={ph} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button onClick={() => { setShowCompanyForm(false); setEditingCompany(null); setCompanyForm(EMPTY_COMPANY); }} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
              <button onClick={saveCompany} disabled={saving || !companyForm.name} className="flex-1 py-2 bg-[#8B2214] text-white rounded-lg text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
