// Coffee LiVRE — preços e comparação de mercado.
//
// Só leitura, de propósito: preço de produto é do vendedor e vem do
// catálogo. Aqui a equipe vê as regras da comparação e o histórico de
// alterações — quem mudou, de quanto para quanto, por qual caminho e com
// que recomendação do Copiloto por trás.
import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { CHAVES_DE_EQUIVALENCIA, MARGEM_MEDIANA_BPS, MINIMO_AMOSTRA, ROTULO_DO_ATRIBUTO } from '../../../pages/coffeelivre/comparacao';

interface Linha {
  id: string;
  preco_anterior_cents: number | null;
  preco_novo_cents: number;
  origem: string;
  motivo: string | null;
  recomendacao: Record<string, unknown> | null;
  desfeito_em: string | null;
  created_at: string;
  lv_products: { titulo: string; lv_stores: { nome: string } | null } | null;
}

const reais = (c: number | null | undefined) => (c == null ? '—' : `R$ ${(Number(c) / 100).toFixed(2).replace('.', ',')}`);
const ORIGEM: Record<string, string> = {
  manual: 'Edição manual', copiloto: 'LiVRE Copiloto', promocao: 'Promoção', automatico: 'Automático', desfazer: 'Desfazer', admin: 'Equipe',
};

export default function LivrePrecos() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('lv_price_history')
      .select('id, preco_anterior_cents, preco_novo_cents, origem, motivo, recomendacao, desfeito_em, created_at, lv_products(titulo, lv_stores(nome))')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) toast.error('Não foi possível ler o histórico de preços.');
        setLinhas((data as unknown as Linha[]) ?? []);
      });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900">Preços e comparação</h3>
        <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
          Somente leitura. O preço é do vendedor e vem do catálogo; a comparação usa só dados públicos da vitrine.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">Regras da comparação de mercado</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Comparação direta: mesma gramatura e mesmos {CHAVES_DE_EQUIVALENCIA.map(c => ROTULO_DO_ATRIBUTO[c]).join(', ')}. Café com ABIC só se compara com ABIC.</li>
          <li>Semelhantes (mesma classificação, ou mesmo formato) aparecem para contexto e não entram na mediana.</li>
          <li>Mediana só com pelo menos {MINIMO_AMOSTRA} equivalentes de outras lojas; abaixo disso a tela diz que a amostra é insuficiente.</li>
          <li>Até {MARGEM_MEDIANA_BPS / 100}% da mediana é competitivo e não gera recomendação. Acima, sugere logo abaixo da mediana, nunca abaixo do piso; diferenciais (origem, certificação, pontuação) justificam preço acima.</li>
          <li>Nada muda sem o vendedor confirmar. O servidor recusa preço abaixo do piso e registra toda troca.</li>
        </ul>
      </div>

      {!linhas ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Nenhuma alteração de preço registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Quando</th><th className="p-3">Produto</th><th className="p-3">Preço</th><th className="p-3">Origem</th><th className="p-3">Motivo</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map(l => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="p-3 text-xs text-gray-500">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-3">
                      <p className="font-medium text-gray-900">{l.lv_products?.titulo ?? '—'}</p>
                      <p className="text-xs text-gray-500">{l.lv_products?.lv_stores?.nome}</p>
                    </td>
                    <td className="p-3 whitespace-nowrap">{reais(l.preco_anterior_cents)} → <b>{reais(l.preco_novo_cents)}</b>{l.desfeito_em && <span className="ml-1 text-xs text-gray-400">(desfeita)</span>}</td>
                    <td className="p-3">{ORIGEM[l.origem] ?? l.origem}</td>
                    <td className="p-3 text-xs text-gray-600">{l.motivo ?? '—'}</td>
                    <td className="p-3">
                      {l.recomendacao && (
                        <button onClick={() => setAberta(aberta === l.id ? null : l.id)} className="text-xs font-semibold text-[#8B2214] hover:underline">
                          {aberta === l.id ? 'Fechar' : 'Recomendação'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {aberta === l.id && l.recomendacao && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="p-3 text-xs text-gray-700">
                        Tipo: <b>{String(l.recomendacao.tipo)}</b> · opção escolhida: <b>{String(l.recomendacao.opcao)}</b> ·
                        sugestão {reais(l.recomendacao.sugestao_cents as number | null)} · mediana {reais(l.recomendacao.mediana_pacote_cents as number | null)} ·
                        {' '}{String(l.recomendacao.equivalentes)} equivalentes · distância {l.recomendacao.distancia_bps == null ? '—' : `${(Number(l.recomendacao.distancia_bps) / 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
