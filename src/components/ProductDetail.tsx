import { useState, useEffect } from "react";
import { ShoppingCart, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { Product } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Props {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product, options?: { is_subscription?: boolean; subscription_months?: number }) => void;
  isAdded: boolean;
  onOpenAuth: () => void;
}

export default function ProductDetail({ product, onBack, onAddToCart, isAdded, onOpenAuth }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<"unica" | "assinatura">("unica");
  const [qty, setQty] = useState(1);
  const [hasActiveSub, setHasActiveSub] = useState(false);
  const [activeImg, setActiveImg] = useState(product.image_url || "/saporino-logo.png");

  // Ao abrir o produto, rola para o topo.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Build gallery: main + additional (non-empty)
  const gallery = [
    product.image_url || "/saporino-logo.png",
    ...((product.additional_images || []).filter(u => u && u.trim() !== "")),
  ];

  const months = product.subscription_months ?? 6;
  const discountPct = product.subscription_discount_pct ?? 20;
  const discountedPrice = product.price * (1 - discountPct / 100);
  const price = purchase === "assinatura" ? discountedPrice : product.price;

  useEffect(() => {
    if (!user || purchase !== "assinatura") { setHasActiveSub(false); return; }
    supabase
      .from("subscriptions")
      .select("id, selected_coffees, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()
      .then(({ data }) => {
        setHasActiveSub(!!(data && Array.isArray(data.selected_coffees) && data.selected_coffees.includes(product.id)));
      });
  }, [user, purchase, product.id]);

  const tog = (k: string) => setOpen(p => p === k ? null : k);

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) {
      onAddToCart(
        product,
        purchase === "assinatura" ? { is_subscription: true, subscription_months: months } : undefined
      );
    }
  };

  const getButton = () => {
    if (purchase === "assinatura" && !user)
      return { text: "Faça login para assinar", action: onOpenAuth, disabled: false, outline: true };
    if (!product.is_active || product.stock <= 0)
      return { text: "Esgotado", action: () => {}, disabled: true, outline: false };
    return { text: isAdded ? "Adicionado!" : "Adicionar à sacola", action: handleAdd, disabled: false, outline: false };
  };

  const btn = getButton();

  return (
    // O cabeçalho do site é `fixed` e ocupa os primeiros ~92px da tela. Sem
    // esta folga, o "Todos os produtos" nascia DEBAIXO dele: o botão aparecia,
    // mas o clique acertava o cabeçalho e nunca chegava nele. Não era o
    // onBack que estava quebrado — era um botão inalcançável.
    <div className="bg-white min-h-screen pt-24">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100 px-4 sm:px-6 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#8B2214] font-semibold hover:underline">
          <ArrowLeft className="w-3 h-3" /> Todos os produtos
        </button>
      </div>

      <div className="flex flex-col md:flex-row max-w-5xl mx-auto">
        {/* Galeria */}
        <div className="md:w-1/2 border-r border-gray-50">
          {/* Imagem ativa */}
          <div className="relative aspect-square flex items-center justify-center p-10 sm:p-16 bg-white">
            {/* Mesmo selo da vitrine, para o cliente não perder o desconto de
                vista ao abrir o produto. */}
            {(product as any).emPromocao && (
              <div className="absolute top-4 left-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#8B2214] text-white shadow-lg sm:h-16 sm:w-16">
                <span className="text-sm font-bold sm:text-base">
                  −{Math.round((1 - product.price / Number((product as any).precoCheio)) * 100)}%
                </span>
              </div>
            )}
            <img
              src={activeImg}
              alt={product.name}
              onError={e => { e.currentTarget.src = "/saporino-logo.png"; }}
              className="w-full h-full object-contain transition-opacity duration-200"
            />
          </div>
          {/* Miniaturas */}
          <div className="flex gap-2 px-4 pb-4 pt-3 border-t border-gray-50 overflow-x-auto">
            {gallery.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImg(url)}
                className={`w-14 h-14 flex-shrink-0 rounded overflow-hidden p-1 border-2 transition-all ${
                  activeImg === url ? "border-[#8B2214]" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <img
                  src={url}
                  onError={e => { e.currentTarget.src = "/saporino-logo.png"; }}
                  className="w-full h-full object-contain"
                  alt={`foto ${idx + 1}`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="md:w-1/2 px-5 sm:px-8 py-6 flex flex-col gap-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">
              {product.category || "Café Saporino"}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>
          </div>

          {/* Preço cheio riscado ao lado do promocional. Sem ele o cliente não
              tem como saber que está pagando menos. */}
          <p className="flex items-baseline gap-2">
            {(product as any).emPromocao && purchase !== "assinatura" && (
              <span className="text-base text-gray-400 line-through">
                R$ {Number((product as any).precoCheio).toFixed(2).replace(".", ",")}
              </span>
            )}
            <span className="text-xl font-bold text-gray-900">
              R$ {price.toFixed(2).replace(".", ",")}
            </span>
          </p>

          {product.description && (
            <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
          )}

          {/* Accordions */}
          {(product.full_details || product.flavor_notes) && (
            <div className="border-t border-gray-100">
              {product.full_details && (
                <div className="border-b border-gray-100">
                  <button onClick={() => tog("det")} className="w-full flex items-center justify-between py-3 text-sm font-bold text-gray-900 text-left">
                    <span>Detalhes do produto</span>
                    {open === "det" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {open === "det" && (
                    <p className="text-xs text-gray-500 leading-relaxed pb-3 whitespace-pre-line">
                      {product.full_details}
                    </p>
                  )}
                </div>
              )}
              {product.flavor_notes && (
                <div className="border-b border-gray-100">
                  <button onClick={() => tog("sab")} className="w-full flex items-center justify-between py-3 text-sm font-bold text-gray-900 text-left">
                    <span>Notas de sabor</span>
                    {open === "sab" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {open === "sab" && (
                    <p className="text-xs text-gray-500 leading-relaxed pb-3">{product.flavor_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tamanho */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Tamanho</p>
            <span className="px-4 py-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold">
              {product.weight_grams}g
            </span>
          </div>

          {/* Torra */}
          {product.roast_type && (
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Torra</p>
              <span className="text-xs text-gray-500">{product.roast_type}</span>
            </div>
          )}

          {/* Tipo de compra */}
          <div className="flex flex-col gap-2">
            <div
              onClick={() => setPurchase("unica")}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${purchase === "unica" ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <p className="text-xs font-bold text-gray-900">Compra única</p>
              <p className="text-xs text-gray-500 mt-0.5">R$ {product.price.toFixed(2).replace(".", ",")}</p>
            </div>

            {(product.subscription_enabled ?? true) && (
              <div
                onClick={() => setPurchase("assinatura")}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${purchase === "assinatura" ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <p className="text-xs font-bold text-gray-900 flex items-center gap-2">
                  Assinar e economizar
                  <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {discountPct}% OFF
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  R$ {discountedPrice.toFixed(2).replace(".", ",")} por entrega · {months} meses
                </p>
                {hasActiveSub && (
                  <p className="text-[10px] text-[#8B2214] mt-1 font-semibold">
                    Você já tem este café em assinatura ativa
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quantidade + botão */}
          <div className="flex gap-2 items-center">
            <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-8 h-9 text-gray-600 text-lg hover:bg-gray-50 flex items-center justify-center"
              >-</button>
              <span className="w-8 text-center text-sm font-semibold">{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="w-8 h-9 text-gray-600 text-lg hover:bg-gray-50 flex items-center justify-center"
              >+</button>
            </div>
            <button
              onClick={btn.action}
              disabled={btn.disabled}
              className={`flex-1 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-1.5 ${
                btn.disabled
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : btn.outline
                    ? "bg-white border-2 border-[#8B2214] text-[#8B2214] hover:bg-red-50"
                    : isAdded
                      ? "bg-green-600 text-white"
                      : "bg-[#8B2214] hover:bg-[#6d1a10] text-white"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {btn.text}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            Frete grátis acima de R$ 150 · cafesaporino.com.br
          </p>
        </div>
      </div>
    </div>
  );
}