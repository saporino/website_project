// B2B Prospecção — leitura de QUALQUER lista que chegar, antes da padronização.
//
// Todo leitor devolve uma ou mais TABELAS (nome, cabeçalhos, linhas). O importador deixa
// escolher qual usar e mapeia as colunas. Formatos:
//   CSV/TXT/TSV · Excel (.xlsx .xls .xlsm .ods — todas as abas) · JSON / JSON Lines ·
//   XML (o elemento que se repete vira linha) · HTML (cada <table> e os dados embutidos em
//   <script>, como a lista `window.TORREF` da ferramenta de prospecção de torrefações).
// Arquivo desconhecido é identificado pelo conteúdo.

export interface Tabela { nome: string; cabecalhos: string[]; linhas: Record<string, string>[] }

const MAX_PARTES = 3;

/** Valor de célula como texto: listas viram "a · b", objetos viram JSON curto. */
export function comoTexto(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(comoTexto).filter(Boolean).join(' · ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).replace(/\s+/g, ' ').trim();
}

function tabela(nome: string, linhas: Record<string, string>[]): Tabela | null {
  const vistas = new Set<string>();
  const cabecalhos: string[] = [];
  for (const l of linhas.slice(0, 500)) for (const k of Object.keys(l)) if (!vistas.has(k)) { vistas.add(k); cabecalhos.push(k); }
  const uteis = linhas.filter(l => Object.values(l).some(v => v !== ''));
  return uteis.length && cabecalhos.length ? { nome, cabecalhos, linhas: uteis } : null;
}

// ------------------------------------------------------------------ listas (JSON e dados embutidos)
const pareceCabecalho = (linha: unknown[]) =>
  linha.length >= 2 && linha.every(c => typeof c === 'string' && c.trim() !== '' && !/\d{5,}/.test(c) && c.length <= 60);

/** Lista de objetos ou lista de listas → tabela. Objetos aninhados achatam um nível ("contato.email"). */
export function tabelaDeLista(nome: string, lista: unknown[]): Tabela | null {
  const itens = lista.filter(x => x != null);
  if (!itens.length) return null;
  if (itens.every(Array.isArray)) {
    const arr = itens as unknown[][];
    const temCabecalho = pareceCabecalho(arr[0]);
    const largura = Math.max(...arr.slice(0, 500).map(a => a.length));
    const cab = temCabecalho ? (arr[0] as string[]).map(s => s.trim()) : Array.from({ length: largura }, (_, i) => `Coluna ${i + 1}`);
    return tabela(nome, (temCabecalho ? arr.slice(1) : arr).map(a => Object.fromEntries(cab.map((h, i) => [h, comoTexto(a[i])]))));
  }
  if (itens.every(x => typeof x === 'object' && !Array.isArray(x))) {
    return tabela(nome, (itens as Record<string, unknown>[]).map(o => {
      const linha: Record<string, string> = {};
      for (const [k, v] of Object.entries(o)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) linha[`${k}.${k2}`] = comoTexto(v2);
        } else linha[k] = comoTexto(v);
      }
      return linha;
    }));
  }
  return null;
}

/** Procura listas de registros dentro de um JSON qualquer (raiz ou propriedades). */
export function tabelasDeJson(nome: string, dado: unknown, caminho = ''): Tabela[] {
  const out: Tabela[] = [];
  if (Array.isArray(dado)) {
    const t = tabelaDeLista(caminho ? `${nome} › ${caminho}` : nome, dado);
    if (t && t.linhas.length >= 1) out.push(t);
  } else if (dado && typeof dado === 'object') {
    for (const [k, v] of Object.entries(dado as Record<string, unknown>)) {
      if (v && typeof v === 'object') out.push(...tabelasDeJson(nome, v, caminho ? `${caminho}.${k}` : k));
    }
  }
  return out;
}

export function lerJson(nome: string, texto: string): Tabela[] {
  const t = texto.replace(/^﻿/, '').trim();
  try { return tabelasDeJson(nome, JSON.parse(t)); } catch { /* talvez JSON Lines */ }
  const linhas = t.split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } });
  if (linhas.length && linhas.every(Boolean)) { const tb = tabelaDeLista(nome, linhas); return tb ? [tb] : []; }
  throw new Error('JSON inválido.');
}

/** Extrai o literal balanceado ([...] ou {...}) que começa em `inicio`, respeitando strings. */
export function literalBalanceado(texto: string, inicio: number): string | null {
  const abre = texto[inicio];
  const fecha = abre === '[' ? ']' : abre === '{' ? '}' : '';
  if (!fecha) return null;
  let nivel = 0; let aspas: string | null = null;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '\\') i++; else if (c === aspas) aspas = null; continue; }
    if (c === '"' || c === "'") aspas = c;
    else if (c === '[' || c === '{') nivel++;
    else if (c === ']' || c === '}') { nivel--; if (nivel === 0) return texto.slice(inicio, i + 1); }
  }
  return null;
}

/** Dados embutidos em JavaScript: `window.X = [...]`, `const X = [...]`, `X = {...}`. Só aceita JSON válido. */
export function dadosEmbutidos(script: string): Tabela[] {
  const out: Tabela[] = [];
  const re = /(?:window\.|const\s+|let\s+|var\s+)?([A-Za-z_$][\w$.]*)\s*=\s*([[{])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(script))) {
    const lit = literalBalanceado(script, m.index + m[0].length - 1);
    if (!lit || lit.length < 20) continue;
    try {
      const dado = JSON.parse(lit);
      const ts = tabelasDeJson(`Dados embutidos: ${m[1]}`, dado).filter(t => t.linhas.length >= 3);
      out.push(...ts);
      re.lastIndex = m.index + m[0].length - 1 + lit.length;
    } catch { /* não é JSON puro: ignora */ }
  }
  return out;
}

// ------------------------------------------------------------------ HTML
function partesDoTexto(el: Element): string[] {
  const partes: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (t && t !== '·' && t !== '|') partes.push(t);
  }
  return partes;
}

function tabelaHtml(t: Element, nome: string): Tabela | null {
  const trs = Array.from(t.querySelectorAll('tr'));
  if (trs.length < 2) return null;
  const celulas = (tr: Element) => Array.from(tr.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
  const iCab = trs.findIndex(tr => celulas(tr).some(c => c.tagName === 'TH'));
  const linhaCab = iCab >= 0 ? trs[iCab] : trs[0];
  const vistos = new Map<string, number>();
  const cab = celulas(linhaCab).map((c, i) => {
    const base = (c.textContent ?? '').replace(/\s+/g, ' ').trim() || `Coluna ${i + 1}`;
    const n = (vistos.get(base) ?? 0) + 1; vistos.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  const corpo = trs.slice(trs.indexOf(linhaCab) + 1);
  const linhas = corpo.map(tr => {
    const linha: Record<string, string> = {};
    celulas(tr).forEach((td, i) => {
      const h = cab[i] ?? `Coluna ${i + 1}`;
      const partes = partesDoTexto(td);
      linha[h] = partes.join(' · ');
      if (partes.length > 1) partes.slice(0, MAX_PARTES).forEach((p, j) => { linha[`${h} · parte ${j + 1}`] = p; });
      // Links viram colunas próprias: o texto "site" / "e-mail" não serve, o endereço sim.
      const links = Array.from(td.querySelectorAll('a[href]')).map(a => a.getAttribute('href') ?? '');
      const emails = links.filter(l => /^mailto:/i.test(l)).map(l => l.replace(/^mailto:/i, '').split('?')[0]);
      const tels = links.filter(l => /^tel:/i.test(l)).map(l => l.replace(/^tel:/i, ''));
      const webs = links.filter(l => /^https?:\/\//i.test(l));
      if (emails.length) linha[`${h} · e-mail`] = emails.join(' · ');
      if (tels.length) linha[`${h} · telefone`] = tels.join(' · ');
      for (const w of webs) {
        const tipo = /instagram\.com/i.test(w) ? 'instagram' : /facebook\.com/i.test(w) ? 'facebook' : /wa\.me|whatsapp/i.test(w) ? 'whatsapp' : 'site';
        linha[`${h} · ${tipo}`] = linha[`${h} · ${tipo}`] ? `${linha[`${h} · ${tipo}`]} · ${w}` : w;
      }
    });
    return linha;
  });
  return tabela(nome, linhas);
}

function tituloDaTabela(t: Element, i: number): string {
  const legenda = t.querySelector('caption')?.textContent?.trim();
  if (legenda) return legenda;
  let el: Element | null = t;
  for (let passos = 0; el && passos < 12; passos++) {
    let irmao = el.previousElementSibling;
    while (irmao) {
      if (/^H[1-4]$/.test(irmao.tagName)) return (irmao.textContent ?? '').trim();
      const h = irmao.querySelector?.('h1,h2,h3,h4');
      if (h) return (h.textContent ?? '').trim();
      irmao = irmao.previousElementSibling;
    }
    el = el.parentElement;
  }
  return `Tabela ${i + 1}`;
}

export function lerHtml(nome: string, texto: string): Tabela[] {
  const doc = new DOMParser().parseFromString(texto, 'text/html');
  const out: Tabela[] = [];
  Array.from(doc.querySelectorAll('table')).forEach((t, i) => {
    const tb = tabelaHtml(t, tituloDaTabela(t, i));
    if (tb) out.push(tb);
  });
  for (const s of Array.from(doc.querySelectorAll('script'))) {
    const conteudo = s.textContent ?? '';
    if (/json/i.test(s.getAttribute('type') ?? '')) { try { out.push(...tabelasDeJson('Dados embutidos (JSON)', JSON.parse(conteudo))); continue; } catch { /* segue */ } }
    out.push(...dadosEmbutidos(conteudo));
  }
  if (!out.length) throw new Error(`Nenhuma tabela ou lista de dados encontrada em ${nome}.`);
  return out;
}

// ------------------------------------------------------------------ XML
export function lerXml(_nome: string, texto: string): Tabela[] {
  const doc = new DOMParser().parseFromString(texto.replace(/^﻿/, ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido.');
  // Registro = elemento com filhos que se repete sob o mesmo pai (o mais frequente).
  const contagem = new Map<string, { n: number; exemplo: Element }>();
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (!el.children.length || !el.parentElement) continue;
    const chave = `${el.parentElement.tagName}>${el.tagName}`;
    const atual = contagem.get(chave);
    contagem.set(chave, { n: (atual?.n ?? 0) + 1, exemplo: atual?.exemplo ?? el });
  }
  const candidatos = [...contagem.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n - a[1].n);
  if (!candidatos.length) throw new Error('Não encontrei registros repetidos no XML.');
  const out: Tabela[] = [];
  for (const [chave, { exemplo }] of candidatos.slice(0, 3)) {
    const [pai, tag] = chave.split('>');
    const registros = Array.from(doc.getElementsByTagName(tag)).filter(e => e.parentElement?.tagName === pai);
    const linhas = registros.map(r => {
      const linha: Record<string, string> = {};
      for (const a of Array.from(r.attributes)) linha[`@${a.name}`] = a.value;
      for (const f of Array.from(r.children)) {
        if (f.children.length) {
          for (const g of Array.from(f.children)) linha[`${f.tagName}.${g.tagName}`] = comoTexto(g.textContent);
        } else {
          linha[f.tagName] = linha[f.tagName] ? `${linha[f.tagName]} · ${comoTexto(f.textContent)}` : comoTexto(f.textContent);
        }
      }
      return linha;
    });
    const tb = tabela(`Registros <${exemplo.tagName}>`, linhas);
    if (tb) out.push(tb);
  }
  return out;
}

// ------------------------------------------------------------------ CSV e Excel
export async function lerCsv(nome: string, texto: string): Promise<Tabela[]> {
  const Papa = (await import('papaparse')).default;
  const r = Papa.parse<Record<string, unknown>>(texto.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  const tb = tabela(nome, r.data.map(l => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, comoTexto(v)]))));
  return tb ? [tb] : [];
}

export async function lerPlanilha(nome: string, dados: ArrayBuffer): Promise<Tabela[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(dados, { type: 'array' });
  const out: Tabela[] = [];
  for (const aba of wb.SheetNames) {
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, defval: '', raw: false, blankrows: false });
    // O cabeçalho é a primeira linha com 2+ células preenchidas (planilhas costumam ter título em cima).
    const iCab = matriz.findIndex(l => l.filter(c => String(c).trim() !== '').length >= 2);
    if (iCab < 0) continue;
    const vistos = new Map<string, number>();
    const cab = matriz[iCab].map((c, i) => {
      const base = String(c).trim() || `Coluna ${i + 1}`;
      const n = (vistos.get(base) ?? 0) + 1; vistos.set(base, n);
      return n > 1 ? `${base} (${n})` : base;
    });
    const tb = tabela(wb.SheetNames.length > 1 ? `Aba "${aba}"` : nome,
      matriz.slice(iCab + 1).map(l => Object.fromEntries(cab.map((h, i) => [h, comoTexto(l[i])]))));
    if (tb) out.push(tb);
  }
  return out;
}

// ------------------------------------------------------------------ entrada única
const EXT_PLANILHA = /\.(xlsx|xlsm|xlsb|xls|ods)$/i;

export async function lerConteudo(nome: string, dados: ArrayBuffer): Promise<Tabela[]> {
  const n = nome.toLowerCase();
  if (EXT_PLANILHA.test(n)) return lerPlanilha(nome, dados);
  const texto = decodificar(dados);
  if (/\.(json|jsonl|ndjson|geojson)$/.test(n)) return lerJson(nome, texto);
  if (/\.xml$/.test(n)) return lerXml(nome, texto);
  if (/\.(html?|xhtml|mhtml?)$/.test(n)) return lerHtml(nome, texto);
  if (/\.(csv|txt|tsv|tab)$/.test(n)) return lerCsv(nome, texto);
  // Extensão desconhecida: decide pelo conteúdo.
  const inicio = texto.replace(/^﻿/, '').trimStart().slice(0, 200).toLowerCase();
  if (inicio.startsWith('<?xml') && !inicio.includes('<html')) return lerXml(nome, texto);
  if (inicio.startsWith('<')) return lerHtml(nome, texto);
  if (inicio.startsWith('[') || inicio.startsWith('{')) return lerJson(nome, texto);
  return lerCsv(nome, texto);
}

/** UTF-8 quando válido; senão Windows-1252 (planilhas exportadas no Excel brasileiro). */
export function decodificar(dados: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(dados); } catch { return new TextDecoder('windows-1252').decode(dados); }
}

export async function lerArquivo(arquivo: File): Promise<Tabela[]> {
  return lerConteudo(arquivo.name, await arquivo.arrayBuffer());
}

/** Impressão digital do conteúdo (SHA-256): reconhece o mesmo arquivo mesmo renomeado. */
export async function impressaoDigital(dados: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}
