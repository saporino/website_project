// Calculadora de Economia LiVRE — leitura das regras.
//
// Tudo o que a conta usa sai do banco: regras de tarifa, premissas e as
// mensalidades dos planos. A mensalidade do Coffee LiVRE vem de `lv_plans`
// (a mesma que a vitrine de planos mostra) e é convertida aqui numa regra
// comum, para o motor não precisar saber de onde ela veio.
import { supabase } from '../../../lib/supabase';
import { PREMISSAS_PADRAO, type Premissas, type Regra } from './economia';

export interface PlanoDaCalculadora {
  id: string;
  slug: string;
  nome: string;
  mensalidadeCents: number;
  emEstudo: boolean;
}

export interface DadosDaCalculadora {
  regras: Regra[];
  premissas: Premissas;
  planos: PlanoDaCalculadora[];
}

const CAMPOS = [
  'id', 'plataforma', 'modalidade', 'componente', 'cenario', 'percentual_bps', 'valor_cents', 'valor_micros',
  'minimo_cents', 'preco_min_cents', 'preco_max_cents', 'peso_sobre', 'peso_min_g', 'peso_max_g', 'confiabilidade',
  'natureza', 'rotulo', 'fonte', 'fonte_url', 'verificado_em', 'vigencia_inicio', 'vigencia_fim', 'observacao', 'ordem',
].join(', ');

// bigint chega como número pelo PostgREST quando cabe; o Number() protege
// contra string em qualquer versão.
const numero = (v: unknown) => (v == null ? null : Number(v));

export async function carregarCalculadora(): Promise<DadosDaCalculadora> {
  const [regras, premissas, planos] = await Promise.all([
    supabase.from('lv_tarifas_simulacao').select(CAMPOS).order('plataforma').order('ordem'),
    supabase.from('lv_simulacao_premissas').select('chave, valor'),
    supabase.from('lv_plans').select('id, slug, nome, mensalidade_cents, em_estudo').order('ordem'),
  ]);
  if (regras.error) throw new Error(regras.error.message);

  const lista = ((regras.data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
    ...r,
    percentual_bps: numero(r.percentual_bps),
    valor_cents: numero(r.valor_cents),
    valor_micros: numero(r.valor_micros),
    minimo_cents: numero(r.minimo_cents),
    preco_min_cents: numero(r.preco_min_cents),
    preco_max_cents: numero(r.preco_max_cents),
    peso_min_g: numero(r.peso_min_g),
    peso_max_g: numero(r.peso_max_g),
  })) as unknown as Regra[];

  const valores = new Map(((premissas.data ?? []) as { chave: string; valor: number }[]).map(p => [p.chave, p.valor]));
  const planosDaCalc = ((planos.data ?? []) as { id: string; slug: string; nome: string; mensalidade_cents: number; em_estudo: boolean }[])
    .map(p => ({ id: p.id, slug: p.slug, nome: p.nome, mensalidadeCents: Number(p.mensalidade_cents), emEstudo: p.em_estudo }));

  // Só planos que têm regra de comissão viram modalidade da calculadora.
  const comRegra = new Set(lista.filter(r => r.plataforma === 'coffeelivre').map(r => r.modalidade));
  for (const p of planosDaCalc) {
    if (!comRegra.has(p.slug)) continue;
    lista.push({
      id: `plano-${p.slug}`, plataforma: 'coffeelivre', modalidade: p.slug, componente: 'mensalidade', cenario: null,
      percentual_bps: null, valor_cents: p.mensalidadeCents, valor_micros: null, minimo_cents: null,
      preco_min_cents: null, preco_max_cents: null, peso_sobre: null, peso_min_g: null, peso_max_g: null,
      confiabilidade: 'em_estudo', natureza: 'hipotese_livre', rotulo: `Mensalidade do ${p.nome}`,
      fonte: 'Planos do Coffee LiVRE (lv_plans)', fonte_url: null, verificado_em: null,
      vigencia_inicio: null, vigencia_fim: null,
      observacao: 'Valor ilustrativo da fase de apresentação.', ordem: 5,
    });
  }

  return {
    regras: lista,
    premissas: {
      pesoEmbalagemG: valores.get('peso_embalagem_g') ?? PREMISSAS_PADRAO.pesoEmbalagemG,
      margemProximoBps: valores.get('margem_proximo_piso_bps') ?? PREMISSAS_PADRAO.margemProximoBps,
    },
    planos: planosDaCalc.filter(p => comRegra.has(p.slug)),
  };
}
