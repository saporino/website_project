import { useState } from "react";
import { ShoppingCart, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { Product } from "../types";

interface Props {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  isAdded: boolean;
}

export default function ProductDetail({ product, onBack, onAddToCart, isAdded }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<"unica" | "assinatura">("unica");
  const [qty, setQty] = useState(1);
  const price = purchase === "assinatura" ? product.price * 0.8 : product.price;
  const tog = (k: string) => setOpen(p => p === k ? null : k);

  return (
    <div className="bg-white min-h-screen">
      <div className="border-b border-gray-100 px-4 sm:px-6 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#8B2214] font-semibold hover:underline">
          <ArrowLeft className="w-3 h-3" /> Todos os produtos
        </button>
      </div>

      <div className="flex flex-col md:flex-row max-w-5xl mx-auto">
        {/* Imagem */}
        <div className="md:w-1/2 border-r border-gray-50">
          <div className="aspect-square flex items-center justify-center p-10 sm:p-16 bg-white">
            <img
              src={product.image_url || "/saporino-logo.png"}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-2 px-4 pb-4 pt-3 border-t border-gray-50">
            <div className="w-14 h-14 border-2 border-[#8B2214] rounded overflow-hidden p-1.5 bg-white flex-shrink-0">
              <img
                src={product.image_url || "/saporino-logo.png"}
                className="w-full h-full object-contain"
                alt="miniatura"
              />
            </div>
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

          <p className="text-xl font-bold text-gray-900">
            R$ {price.toFixed(2).replace(".", ",")}
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
            <div
              onClick={() => setPurchase("assinatura")}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${purchase === "assinatura" ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <p className="text-xs font-bold text-gray-900 flex items-center gap-2">
                Assinar e economizar
                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">20% OFF</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                R$ {(product.price * 0.8).toFixed(2).replace(".", ",")} por entrega
              </p>
            </div>
          </div>

          {/* Qty + botão */}
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
              onClick={() => { for (let i = 0; i < qty; i++) onAddToCart(product); }}
              disabled={!product.is_active || product.stock <= 0}
              className={`flex-1 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-1.5 ${
                isAdded
                  ? "bg-green-600 text-white"
                  : product.stock > 0 && product.is_active
                    ? "bg-[#8B2214] hover:bg-[#6d1a10] text-white"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {isAdded ? "Adicionado!" : product.stock > 0 ? "Adicionar à sacola" : "Esgotado"}
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