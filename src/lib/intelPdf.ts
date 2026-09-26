// Folha de "Pesquisa de preços" para imprimir/salvar em PDF.
//
// Fica fora do componente de propósito: assim a folha é testável (o teste monta o HTML
// e confere as contas) e o botão da tela só entrega os dados.
//
// A conta que interessa ao fornecedor e ao comprador do mercado:
//   preço ao mercado = preço de prateleira × (1 − margem)
// ou seja, quanto o mercado pode pagar pelo produto para vender naquele preço de gôndola
// mantendo a margem dele. Sem desconto financeiro e sem desconto logístico.

export interface LinhaPreco {
  titulo: string;
  fotoUrl?: string | null;
  precoPrateleira: number;
  precoPorKg?: number | null;
  pesoG?: number | null;
  arabica?: boolean;
  patrocinado?: boolean;
  descontoPct?: number | null;
}

export interface DadosFolha {
  mercado: string;            // "Atacadão", "Supermercado Lopes — Cipava, Osasco/SP"
  atualizadoEm: string | null; // data da coleta, já formatada
  geradoEm: string;
  recorte: string;            // "Torrado e moído · só 100% arábica"
  margens: number[];          // [20, 22.5, 25]
  linhas: LinhaPreco[];
  medianaPorKg: number;
  faixa: [number, number];
  promoPct: number;
  pesosAlvo?: number[];       // gramaturas do nosso pacote para o alvo (padrão 250/500/1000)
}

export const brl = (v: number) =>
  `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * Lê as margens digitadas ("20; 22,5; 25") em números.
 * Separa por ponto e vírgula, barra, quebra de linha ou espaço — NUNCA por vírgula,
 * que em português é casa decimal: dividir nela transformava 22,5 em 22 e 5.
 */
export function lerMargens(texto: string, maximo = 4): number[] {
  return texto.split(/[;/\n\s]+/)
    .map(m => parseFloat(m.replace(',', '.').replace('%', '').trim()))
    .filter(n => Number.isFinite(n) && n > 0 && n < 90)
    .slice(0, maximo);
}

/** Preço que o mercado pode pagar para vender a `prateleira` com aquela margem. */
export const precoAoMercado = (prateleira: number, margemPct: number) =>
  +(prateleira * (1 - margemPct / 100)).toFixed(2);

/** Nome do arquivo (o navegador usa o título da página ao salvar em PDF). */
export function nomeDoArquivo(mercado: string, data: Date) {
  const dia = `${String(data.getDate()).padStart(2, '0')}-${String(data.getMonth() + 1).padStart(2, '0')}-${data.getFullYear()}`;
  const nome = mercado.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${nome}-precos-${dia}`;
}

export function montarFolhaDePrecos(d: DadosFolha, nomeArquivo: string): string {
  const pesos = d.pesosAlvo?.length ? d.pesosAlvo : [250, 500, 1000];
  const cab = `
    <tr>
      <th class="n">#</th><th></th><th>Café / produto</th><th>Peso</th>
      <th class="d">Preço prateleira</th><th class="d">R$/kg</th>
      ${d.margens.map(m => `<th class="d">Paga com margem<br>${pct(m)}</th>`).join('')}
    </tr>`;

  const linhas = d.linhas.map((r, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td class="f">${r.fotoUrl ? `<img src="${esc(r.fotoUrl)}" referrerpolicy="no-referrer" />` : '<span class="sem">&#9749;</span>'}</td>
      <td>
        <div class="t">${esc(r.titulo)}</div>
        ${[r.arabica ? 'arábica' : '', (r.descontoPct || 0) > 0 ? `-${r.descontoPct}%` : '', r.patrocinado ? 'patrocinado' : '']
          .filter(Boolean).length ? `<div class="s">${[r.arabica ? 'arábica' : '', (r.descontoPct || 0) > 0 ? `-${r.descontoPct}%` : '', r.patrocinado ? 'patrocinado' : ''].filter(Boolean).join(' · ')}</div>` : ''}
      </td>
      <td class="peso">${r.pesoG ? `${r.pesoG} g` : '—'}</td>
      <td class="prat">${brl(r.precoPrateleira)}</td>
      <td class="kg">${r.precoPorKg ? brl(r.precoPorKg) : '—'}</td>
      ${d.margens.map(m => `<td class="m">${brl(precoAoMercado(r.precoPrateleira, m))}</td>`).join('')}
    </tr>`).join('');

  // ALVO PARA CONCORRER: se o nosso pacote for parar na gôndola ao preço MEDIANO do mercado,
  // este é o preço máximo que podemos cobrar do mercado — por gramatura e por margem dele.
  const alvo = d.medianaPorKg > 0 ? `
    <div class="alvo">
      <h2>Para concorrer neste mercado</h2>
      <p>Com a gôndola na mediana de <b>${brl(d.medianaPorKg)}/kg</b>, este é o preço máximo de venda ao mercado
      para ele manter a margem dele:</p>
      <table class="mini">
        <tr><th>Margem do mercado</th>${pesos.map(p => `<th class="d">${p >= 1000 ? `${p / 1000} kg` : `${p} g`}</th>`).join('')}</tr>
        ${d.margens.map(m => `<tr><td>${pct(m)}</td>${pesos.map(p => `<td class="d">${brl(precoAoMercado(d.medianaPorKg * (p / 1000), m))}</td>`).join('')}</tr>`).join('')}
      </table>
      <p class="obs">Acima disso, o preço de gôndola sai da mediana e o produto passa a competir na faixa cara.</p>
    </div>` : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(nomeArquivo)}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 17px; margin: 0 0 2px; color: #1f3b57; }
    .sub { font-size: 10.5px; color: #555; margin-bottom: 10px; }
    .kpis { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .kpi { border: 1px solid #dde3ea; border-radius: 6px; padding: 6px 10px; min-width: 104px; }
    .kpi b { display: block; font-size: 14px; }
    .kpi span { font-size: 9px; color: #667; text-transform: uppercase; letter-spacing: .04em; }
    .alvo { border: 1px solid #1f3b57; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
    .alvo h2 { font-size: 12px; margin: 0 0 4px; color: #1f3b57; }
    .alvo p { font-size: 10px; margin: 0 0 6px; color: #333; }
    .alvo .obs { color: #777; margin: 6px 0 0; }
    table.mini { width: auto; border-collapse: collapse; }
    table.mini th, table.mini td { border: 1px solid #dde3ea; padding: 3px 10px; font-size: 10.5px; text-align: left; }
    table.mini th { background: #eef3f8; font-weight: 600; }
    .criterio { border: 1px solid #dde3ea; border-radius: 6px; padding: 7px 10px; font-size: 9.5px; color: #444; margin-bottom: 10px; }
    table.lista { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    table.lista th { background: #1f3b57; color: #fff; font-size: 9px; font-weight: 600; padding: 5px 4px; text-align: left; }
    table.lista th.d, td.d { text-align: right; }
    table.lista th.n { width: 20px; }
    td { border-bottom: 1px solid #eee; padding: 4px; vertical-align: middle; }
    td.n { color: #aaa; font-size: 9px; }
    td.f { width: 40px; }
    td.f img { width: 36px; height: 36px; object-fit: cover; border-radius: 4px; }
    .sem { display: inline-block; width: 36px; height: 36px; background: #f3f3f3; border-radius: 4px; text-align: center; line-height: 36px; }
    .t { font-size: 10.5px; font-weight: 600; }
    .s { font-size: 9px; color: #777; }
    td.peso { font-size: 10px; color: #555; white-space: nowrap; }
    td.prat { text-align: right; white-space: nowrap; font-weight: 700; font-size: 11.5px; background: #fdf6ec; }
    td.kg { text-align: right; white-space: nowrap; font-size: 10.5px; color: #555; }
    td.m { text-align: right; white-space: nowrap; font-size: 10.5px; }
    .rodape { margin-top: 10px; font-size: 8.5px; color: #999; }
  </style></head><body>
  <h1>Pesquisa de preços — ${esc(d.mercado)}</h1>
  <div class="sub"><b>Atualizado em ${esc(d.atualizadoEm || '—')}</b> · ${esc(d.recorte)} · ${d.linhas.length} produtos · PDF gerado em ${esc(d.geradoEm)}</div>
  <div class="kpis">
    <div class="kpi"><span>Produtos</span><b>${d.linhas.length}</b></div>
    <div class="kpi"><span>Mediana R$/kg</span><b>${brl(d.medianaPorKg)}</b></div>
    <div class="kpi"><span>Faixa R$/kg</span><b>${brl(d.faixa[0])} – ${brl(d.faixa[1])}</b></div>
    <div class="kpi"><span>Em promoção</span><b>${d.promoPct}%</b></div>
  </div>
  ${alvo}
  <div class="criterio"><b>Como ler:</b> "Paga com margem" é quanto o mercado pode pagar pelo produto para vendê-lo ao preço de prateleira mantendo aquela margem — preço de prateleira × (1 − margem). Valores sem desconto financeiro e sem desconto logístico. Preços de gôndola coletados publicamente.</div>
  <table class="lista"><thead>${cab}</thead><tbody>${linhas}</tbody></table>
  <div class="rodape">${esc(d.mercado)} · uso interno · COFICO Brasil</div>
  </body></html>`;
}
