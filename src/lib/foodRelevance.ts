// Filtro de relevância: o lead do Google Maps é do ramo de café/alimentos?
// Regras (definidas pelo Vlademir): quem vende café busca alimento/mercearia/comida/bebida/pão/empório.
// Fora: vidro, pneu, bateria, autopeças, gás, elétrica/hidráulica, ovos-puro, açaí/sorvete/adega-puro,
// carros/marcas, construção, etc. Se tiver "café/coffee" no nome/categoria, SEMPRE entra.

// tem café/coffee -> entra sempre (regra do Vlademir)
const COFFEE = /caf[eé]|coffee|torref|torra[cç][aã]o/i;

// sinais de ALIMENTO/BEBIDA/MERCEARIA (o que interessa)
const FOOD = /aliment|comida|merce|mercad|supermerc|hipermerc|atacad|padar|panific|\bp[aã]o\b|confeit|\bdoce|bombonier|biscoit|chocolat|emp[oó]rio|hortifrut|sacol[aã]o|quitanda|bebida|refriger|[aá]gua mineral|\bsucos?\b|restaurante|lanchon|pizzar|hamburgu|churrascar|marmit|cafeter|rotiss|delicatess|\bfrios\b|congelad|latic[ií]nio|secos e molhados|conveni[eê]nci|gourmet|tempero|cereai|food service|horeca|buffet|catering|refei[cç][aã]o|cozinha industrial|alimenta[cç]|\bcasa de bolos?\b/i;

// bloqueio CLARO (não-alimento) — só derruba se NÃO tiver sinal de alimento junto
const BLOCK = /vidro|vidra[cç]|alum[ií]nio|\bpneus?\b|autope[cç]|auto pe[cç]|\bpe[cç]as\b|bateria|el[eé]tric|hidr[aá]ul|\bg[aá]s\b|\bgesso\b|ferrag|ferrament|constru[cç]|\btintas?\b|\bmadeira|m[oó]vei|farm[aá]ci|drogari|[oó]tica|pet ?shop|\bpet\b|veterin|\broupas?\b|confec[cç]|cal[cç]ad|cosm[eé]tic|papelari|inform[aá]tic|\bcelular|eletr[oô]nic|\bmoto\b|autom[oó]v|ve[ií]cul|oficina|borrach|\bqu[ií]mic|higiene|prefeitura|cart[oó]rio|imobili|contabil|advoc|\bseguros?\b|dpaschoal|\bovos?\b|espetinho|marmorari|serralher|concession|joalher|rel[oó]gio|m[aá]quinas|equipament|embalagens?|constru[cç][aã]o/i;

// "só doçura/bebida-específica": sorvete, açaí, adega, picolé, gelato -> fora se não tiver alimento junto
const ONLY_TREAT = /sorvet|a[cç]a[ií]|gelat|adega|picol[eé]|churrasqu/i;

export function isFoodRelevant(name?: string | null, googleCategory?: string | null): boolean {
  const t = `${name || ''} ${googleCategory || ''}`.toLowerCase();
  if (COFFEE.test(t)) return true;                    // café/coffee -> sempre entra
  if (ONLY_TREAT.test(t) && !FOOD.test(t)) return false; // sorvete/açaí/adega puro -> fora
  if (BLOCK.test(t) && !FOOD.test(t)) return false;   // não-alimento claro -> fora
  if (FOOD.test(t)) return true;                      // sinal de alimento -> entra
  return false;                                        // sem sinal de alimento -> fora (alta precisão)
}
