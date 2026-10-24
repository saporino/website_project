# -*- coding: utf-8 -*-
# Mapeia a cadeia do cafe sobre as 1.332 subclasses OFICIAIS da CONCLA/IBGE.
#
# Regra inegociavel: nenhum codigo e escrito a mao. Tudo sai do arquivo do IBGE.
#
# A primeira versao casava por substring e produziu lixo: "ALOJAMENTO DE ANIMAIS
# DOMESTICOS" entrou como hotel, "ARMAZENS GERAIS" como mercearia, "SALAS DE
# ACESSO A INTERNET" como comercio eletronico. Falso positivo numa base de
# prospeccao custa caro -- o representante liga para quem nunca vai comprar.
#
# Agora: fronteira de palavra + lista de EXCLUSAO por segmento.
import json, io, re, sys, unicodedata

d = json.load(io.open(sys.argv[1], encoding='utf-8'))

def sem_acento(s):
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').upper()

SUB = [{'id': x['id'], 'desc': x['descricao'], 'norm': sem_acento(x['descricao'])} for x in d]

def tem(norm, termo):
    """Palavra inteira, nao pedaco. 'BARES' nao casa dentro de 'BARESTAURANTE'."""
    return re.search(r'(?<![A-Z0-9])' + re.escape(termo) + r'(?![A-Z0-9])', norm) is not None

def casa(norm, combos, exclui):
    if any(tem(norm, x) for x in exclui):
        return False
    return any(all(tem(norm, t) for t in termos) for termos in combos)

# (categoria, segmento, forca, combos, exclusoes)
G = [
 # ── VARREDURA DIRETA PELA PALAVRA "CAFE" ────────────────────────────────────
 # Isto existe porque o filtro por sinonimo FALHOU num caso que importa:
 # 1082100 e o CNAE do cafe soluvel, mas a descricao oficial diz "PRODUTOS A
 # BASE DE CAFE" -- a palavra "SOLUVEL" nao aparece. Procurar a palavra CAFE em
 # todas as 1.332 subclasses pega qualquer atividade que a CONCLA nomeie com
 # cafe, sem depender de eu adivinhar o sinonimo que eles usaram.
 ('C. Fabricantes','Atividade que cita CAFE na CONCLA','direto',[['CAFE']],['CAFETERIA']),

 # ── A. COMPRADORES E REVENDEDORES ───────────────────────────────────────────
 ('A. Compradores','Hiper e supermercado','direto',[['HIPERMERCADOS'],['SUPERMERCADOS']],[]),
 ('A. Compradores','Mini, mercearia e armazem','direto',[['MINIMERCADOS'],['MERCEARIAS'],['ARMAZENS']],['WARRANT','GERAIS']),
 ('A. Compradores','Hortifruti, sacolao e quitanda','amplo',[['HORTIFRUTIGRANJEIROS']],[]),
 ('A. Compradores','Loja de conveniencia','direto',[['CONVENIENCIA']],[]),
 ('A. Compradores','Varejo de alimentos em geral','amplo',[['VAREJISTA','ALIMENTICIOS']],[]),
 ('A. Compradores','Varejo de laticinios e frios','amplo',[['LATICINIOS']],[]),
 ('A. Compradores','Doces, balas e chocolates','amplo',[['DOCES','BALAS']],[]),
 ('A. Compradores','Padaria e confeitaria','direto',[['PADARIA'],['CONFEITARIA'],['PANIFICACAO']],[]),
 ('A. Compradores','Posto e tabacaria (ponto de cafe)','amplo',[['COMBUSTIVEIS','AUTOMOTORES'],['TABACARIA']],[]),
 ('A. Compradores','Bar, lanchonete e casa de cha','direto',[['LANCHONETES'],['BARES']],['FABRICACAO']),
 ('A. Compradores','Restaurante','direto',[['RESTAURANTES']],[]),
 ('A. Compradores','Alimentacao coletiva e cantina','direto',[['CANTINAS'],['ALIMENTACAO','PRIVATIVOS'],['ALIMENTOS','PREPARADOS']],[]),
 ('A. Compradores','Buffet, eventos e catering','direto',[['BUFE'],['EVENTOS','RECEPCOES']],[]),
 ('A. Compradores','Hotel e meios de hospedagem','direto',[['HOTEIS'],['APART','HOTEIS'],['ALBERGUES'],['PENSOES'],['ALOJAMENTOS']],
                                                           ['ANIMAIS','ASSISTENCIAIS','ASSISTENCIA','SOCIAL']),
 ('A. Compradores','Vending / maquinas automaticas','direto',[['MAQUINAS','AUTOMATICAS']],[]),
 # "NATURAIS" sozinho trazia fibra textil, adocante e pesquisa cientifica.
 # Produto natural/gourmet nao tem CNAE proprio: cai em varejo de alimentos.
 ('A. Compradores','Produtos naturais e suplementos','amplo',[['SUPLEMENTOS','ALIMENTARES']],[]),

 # ── B. DISTRIBUIDORES E REVENDEDORES ────────────────────────────────────────
 ('B. Distribuidores','Atacado de cafe','direto',[['ATACADISTA','CAFE']],[]),
 ('B. Distribuidores','Atacado de alimentos','direto',[['ATACADISTA','ALIMENTICIOS']],[]),
 ('B. Distribuidores','Atacado de mercadorias em geral','amplo',[['ATACADISTA','GERAL']],[]),
 ('B. Distribuidores','Atacado de embalagens','direto',[['ATACADISTA','EMBALAGENS']],[]),
 ('B. Distribuidores','Atacado de utilidades domesticas','amplo',[['ATACADISTA','DOMESTICAS']],[]),
 ('B. Distribuidores','Atacado de maquinas e equipamentos','amplo',[['ATACADISTA','MAQUINAS']],[]),
 ('B. Distribuidores','Representante comercial / agente','amplo',[['REPRESENTANTES','COMERCIAIS'],['AGENTES','COMERCIO']],[]),

 # ── C. FABRICANTES E FORNECEDORES ───────────────────────────────────────────
 ('C. Fabricantes','Cultivo de cafe','direto',[['CULTIVO','CAFE']],[]),
 ('C. Fabricantes','Beneficiamento de cafe','direto',[['BENEFICIAMENTO','CAFE']],[]),
 ('C. Fabricantes','Torrefacao e moagem de cafe','direto',[['TORREFACAO'],['MOAGEM','CAFE']],[]),
 ('C. Fabricantes','Cafe soluvel e derivados','direto',[['SOLUVEL']],[]),
 ('C. Fabricantes','Embalagem de plastico','direto',[['EMBALAGEM','PLASTICO'],['EMBALAGENS','PLASTICO']],[]),
 ('C. Fabricantes','Embalagem de papel e papelao','direto',[['EMBALAGENS','PAPEL'],['PAPELAO','EMBALAGENS'],['CARTOLINA','EMBALAGENS']],[]),
 ('C. Fabricantes','Sacaria e saco industrial','direto',[['SACOS']],[]),
 ('C. Fabricantes','Filme, chapa e laminado plastico','direto',[['FILMES'],['LAMINADOS','PLASTICO']],[]),
 ('C. Fabricantes','Metalizacao e laminacao','indireto',[['METALIZACAO']],[]),
 ('C. Fabricantes','Artefato de papel (filtro, coador)','indireto',[['ARTEFATOS','PAPEL']],[]),
 ('C. Fabricantes','Rotulo, etiqueta e impressao','direto',[['ETIQUETAS'],['IMPRESSAO','MATERIAL']],[]),
 ('C. Fabricantes','Utensilio de metal / inox','indireto',[['UTENSILIOS','METAL'],['CUTELARIA']],[]),
 ('C. Fabricantes','Utensilio e artefato de plastico','indireto',[['ARTEFATOS','PLASTICO'],['UTENSILIOS','PLASTICO']],[]),
 ('C. Fabricantes','Maquina para alimentos e bebidas','direto',[['MAQUINAS','ALIMENTOS'],['MAQUINAS','BEBIDAS']],[]),
 ('C. Fabricantes','Eletrodomestico (cafeteira)','indireto',[['ELETRODOMESTICOS']],[]),
 ('C. Fabricantes','Equipamento para refrigeracao e ventilacao','amplo',[['REFRIGERACAO']],[]),

 # ── D. PARCEIROS E PRESTADORES ──────────────────────────────────────────────
 ('D. Parceiros','Transporte rodoviario de carga','direto',[['RODOVIARIO','CARGA']],[]),
 ('D. Parceiros','Armazem geral e deposito','direto',[['ARMAZENS','GERAIS'],['DEPOSITOS','MERCADORIAS']],[]),
 ('D. Parceiros','Carga, descarga e movimentacao','direto',[['CARGA','DESCARGA'],['MOVIMENTACAO','MERCADORIAS']],[]),
 ('D. Parceiros','Manutencao de maquinas e equipamentos','direto',[['MANUTENCAO','REPARACAO','MAQUINAS'],['REPARACAO','MANUTENCAO','MAQUINAS']],[]),
 ('D. Parceiros','Aluguel / locacao de maquinas','direto',[['ALUGUEL','MAQUINAS']],[]),
 ('D. Parceiros','Comercio exterior (import/export)','amplo',[['IMPORTACAO'],['EXPORTACAO']],[]),

 # ── LACUNAS ACHADAS AO VALIDAR O CATALOGO CONTRA A LISTA DELE ───────────────
 # Nenhuma foi encontrada pelos filtros originais. Vieram de procurar, um a um,
 # os itens que ele listou e conferir se existe CNAE oficial para cada um.
 #
 # O que NAO entrou, e por que:
 #  · cooperativa de produtores -- as unicas "cooperativas" nomeadas na CONCLA
 #    sao de CREDITO. Cooperativa de cafe classifica-se pela ATIVIDADE que
 #    exerce (cultivo 0134200, beneficiamento 1081301), que e exatamente a
 #    regra que ele escreveu.
 #  · broker/trading/corretor de cafe -- nao existe. Os "corretores" da CONCLA
 #    sao de imoveis e seguros. Broker de cafe cai em representante comercial
 #    de materias-primas agricolas (4611700), ja no catalogo.
 #  · silo, secagem, viveiro, capsula, garrafa termica, xicara -- sem codigo
 #    proprio. Caem em armazem geral, artefatos de plastico/metal e utilidades
 #    domesticas, todos ja cobertos.
 #  · "artigos de cama, mesa e banho" NAO entrou: e textil, nao louca. Seria
 #    falso positivo.
 ('D. Parceiros','Analise, classificacao e laudo','indireto',[['TESTES','ANALISES']],[]),
 ('D. Parceiros','Despacho aduaneiro','direto',[['DESPACHOS']],[]),
 ('C. Fabricantes','Embalagem de vidro','direto',[['EMBALAGENS','VIDRO']],[]),
 ('C. Fabricantes','Artigo de metal para uso domestico','indireto',[['DOMESTICO','METAL']],[]),
 ('B. Distribuidores','Atacado de bebidas','amplo',[['ATACADISTA','BEBIDAS']],[]),
]

catalogo = {}
for cat, seg, forca, combos, exclui in G:
    for s in SUB:
        if casa(s['norm'], combos, exclui):
            e = catalogo.setdefault(s['id'], {'descricao': s['desc'], 'grupos': []})
            t = {'categoria': cat, 'segmento': seg, 'forca': forca}
            if t not in e['grupos']:
                e['grupos'].append(t)

print(f'CNAEs oficiais mapeados: {len(catalogo)} de {len(SUB)} subclasses CONCLA/IBGE\n')
por_cat = {}
for cid, e in catalogo.items():
    for g in e['grupos']:
        por_cat.setdefault(g['categoria'], {}).setdefault(g['segmento'], []).append((cid, e['descricao'], g['forca']))

for cat in sorted(por_cat):
    print(f'\n{"="*76}\n{cat}\n{"="*76}')
    for seg in sorted(por_cat[cat]):
        itens = sorted(por_cat[cat][seg])
        print(f'\n  {seg}  [{itens[0][2]}]  ({len(itens)} CNAEs)')
        for cid, desc, _ in itens:
            print(f'    {cid}  {desc[:64]}')

io.open(sys.argv[2],'w',encoding='utf-8').write(json.dumps(catalogo, ensure_ascii=False, indent=1))
print(f'\n\nTotal: {len(catalogo)} CNAEs oficiais · salvo em {sys.argv[2]}')
