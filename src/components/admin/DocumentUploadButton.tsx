import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";
import { Paperclip, X, FileText, Loader } from "lucide-react";

interface Props {
  lotId: string | null | undefined;
  kind: "compra_verde" | "pagamento_torra" | "pagamento_embalagem" | "nota_fiscal";
  label: string;
  allowMultiple?: boolean;
}

export default function DocumentUploadButton({ lotId, kind, label, allowMultiple = true }: Props) {
  const { activeCompanyId } = useCompany();
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!lotId) { setDocs([]); return; }
    const { data } = await supabase
      .from("lot_documents")
      .select("*")
      .eq("lot_id", lotId)
      .eq("kind", kind)
      .order("uploaded_at", { ascending: false });
    setDocs(data || []);
  };

  useEffect(() => { load(); }, [lotId, kind]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lotId) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${lotId}/${kind}/${timestamp}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("lot-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("lot_documents").insert({
        lot_id: lotId, kind, storage_path: path, file_name: file.name, company_id: activeCompanyId,
      });
      if (dbErr) throw dbErr;
      await load();
    } catch (err: any) {
      alert(`Erro no upload: ${err.message || err}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("lot-documents").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (doc: any) => {
    if (!confirm(`Remover ${doc.file_name}?`)) return;
    await supabase.storage.from("lot-documents").remove([doc.storage_path]);
    await supabase.from("lot_documents").delete().eq("id", doc.id);
    await load();
  };

  if (!lotId) {
    return (
      <button type="button" disabled
        className="h-[22px] w-[32px] px-1.5 flex items-center justify-center border border-gray-200 rounded-sm text-gray-300 cursor-not-allowed leading-none"
        title="Salve o lote primeiro pra anexar documentos">
        <Paperclip className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`h-[22px] px-1.5 gap-0.5 flex items-center justify-center border rounded-sm leading-none text-[11px] ${docs.length > 0 ? "border-green-500 bg-green-50 text-green-700" : "border-gray-300 text-gray-500 w-[32px]"}`}
        title={`${label} — ${docs.length} anexo(s)`}>
        <Paperclip className="w-3 h-3" />
        {docs.length > 0 && <span className="font-semibold">{docs.length}</span>}
      </button>
      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 w-72 bg-white border border-gray-300 rounded shadow-lg p-2">
          <div className="flex justify-between items-center mb-2 pb-1 border-b">
            <div className="text-sm font-medium text-gray-800">{label}</div>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {docs.length === 0 && (
            <div className="text-xs text-gray-500 italic py-2 text-center">Nenhum anexo</div>
          )}
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 p-1 hover:bg-gray-50 rounded">
              <button type="button" onClick={() => openDoc(doc.storage_path)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline truncate flex-1 text-left">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{doc.file_name}</span>
              </button>
              <button type="button" onClick={() => deleteDoc(doc)}
                className="text-red-500 hover:text-red-700 shrink-0" title="Remover">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {(allowMultiple || docs.length === 0) && (
            <label className="block mt-2 text-center text-sm bg-blue-600 hover:bg-blue-700 text-white rounded py-1.5 cursor-pointer">
              {uploading
                ? <Loader className="w-4 h-4 animate-spin inline" />
                : "+ Adicionar arquivo"}
              <input type="file" onChange={handleUpload} disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
