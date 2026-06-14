# ETL da base publica de CNPJ (Receita Federal / Dados Abertos) -> public.prospects_b2b.
# Filtra em STREAM por UF + CNAEs-alvo + situacao ATIVA (nunca materializa a base inteira).
# Geocodifica por centroide de municipio (offline, via ibge/kelvins).
#
# Uso:  python scripts/etl_cnpj.py --part 1 --uf SP [--limit N] [--no-load]
#   --part   : qual arquivo Estabelecimentos (0..9). Piloto = 1.
#   --uf     : estado alvo (default SP).
#   --limit  : (opcional) para teste rapido, processa so N linhas casadas.
#   --no-load: nao carrega no banco, so conta (dry-run).
import argparse, csv, io, json, sys, unicodedata, urllib.request, zipfile, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
env = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
SUPA = env["VITE_SUPABASE_URL"]; KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

MIRROR = "https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos/2026-05-10/"
KELVINS = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv"

# CNAEs-alvo (7 digitos, sem pontuacao) + descricao curta.
CNAE = {
    "1081301":"Beneficiamento de cafe","1081302":"Torrefacao e moagem de cafe","1082100":"Fabricacao de cafe soluvel",
    "4621400":"Atacado de cafe em grao","4637101":"Atacado de cafe torrado/moido",
    "4711301":"Hipermercado","4711302":"Supermercado","4712100":"Mercearia/minimercado",
    "4724500":"Varejo de hortifruti","4729699":"Varejo de alimentos NE","4721103":"Varejo de laticinios/frios","4729601":"Tabacaria",
    "4721102":"Padaria/confeitaria (com producao)","1091102":"Fabricacao de paes/bolos industriais","1091101":"Fabricacao de paes/biscoitos",
    "4639701":"Atacado de alimentos (mercadorias gerais)","4639702":"Atacado de mercadorias gerais","4691500":"Atacado geral",
    "5611201":"Restaurante","5611203":"Lanchonete/casa de cha/sucos","5611204":"Bar/cafeteria (com servico)",
    "5620101":"Fornecimento de refeicoes (cozinha industrial)","5620102":"Servicos de alimentacao para eventos","5620104":"Cantina/cozinha",
    "5510801":"Hotel","5510802":"Apart-hotel","5590699":"Alojamento NE","5590603":"Pensao/hospedaria",
    "4731800":"Loja de conveniencia/posto",
}
TARGET = set(CNAE)

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()

def download(url, dest, label):
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  (cache) {label}: {dest.stat().st_size//1048576} MB"); return
    print(f"  baixando {label} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "cafesaporino-etl/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        total = int(r.headers.get("Content-Length", 0)); got = 0; t0 = time.time()
        while True:
            chunk = r.read(1 << 20)
            if not chunk: break
            f.write(chunk); got += len(chunk)
            if total and got % (50 << 20) < (1 << 20):
                print(f"    {got//1048576}/{total//1048576} MB ({got*100//total}%)  {got/1048576/(time.time()-t0+0.01):.0f} MB/s")
    print(f"  {label} OK: {dest.stat().st_size//1048576} MB")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--part", type=int, default=1)
    ap.add_argument("--uf", default="SP")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()
    uf = args.uf.upper()
    tmp = Path(tempfile.gettempdir()) / "saporino_cnpj"
    tmp.mkdir(exist_ok=True)

    est_zip = tmp / f"Estabelecimentos{args.part}.zip"
    mun_zip = tmp / "Municipios.zip"
    print("== Downloads ==")
    download(MIRROR + f"Estabelecimentos{args.part}.zip", est_zip, f"Estabelecimentos{args.part}")
    download(MIRROR + "Municipios.zip", mun_zip, "Municipios")

    # RF municipio code -> nome
    print("== Lookups ==")
    rf_muni = {}
    with zipfile.ZipFile(mun_zip) as z, z.open(z.namelist()[0]) as fh:
        for row in csv.reader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";", quotechar='"'):
            if len(row) >= 2: rf_muni[row[0]] = row[1]
    print(f"  {len(rf_muni)} municipios RF")

    # centroides (uf, nome_norm) -> (lat,lng)  via kelvins (mesmo dado do ibge_municipios)
    req = urllib.request.Request(KELVINS, headers={"User-Agent": "cafesaporino-etl/1.0"})
    est_uf = {"35":"SP"}  # so precisamos resolver pelo proprio uf da linha; centroide keyed por (uf,nome)
    cent = {}
    import urllib.request as u2
    with u2.urlopen(urllib.request.Request("https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/estados.csv", headers={"User-Agent":"x"}), timeout=60) as r:
        uf_by_code = {row["codigo_uf"]: row["uf"] for row in csv.DictReader(io.StringIO(r.read().decode("utf-8-sig")))}
    with u2.urlopen(req, timeout=60) as r:
        for m in csv.DictReader(io.StringIO(r.read().decode("utf-8-sig"))):
            u = uf_by_code.get(m["codigo_uf"])
            if u and m["latitude"]:
                cent[(u, norm(m["nome"]))] = (float(m["latitude"]), float(m["longitude"]))
    print(f"  {len(cent)} centroides")

    # stream dos estabelecimentos
    print(f"== Filtrando Estabelecimentos{args.part} (uf={uf}, ATIVA, {len(TARGET)} CNAEs) ==")
    matched = 0; geo_ok = 0; scanned = 0
    batch = []; t0 = time.time()
    stats_cnae = {}

    def flush():
        nonlocal batch
        if not batch or args.no_load: batch = []; return
        body = json.dumps(batch).encode("utf-8")
        # Retry com backoff: em tabela grande o upsert pode estourar timeout/rede pontualmente.
        for attempt in range(5):
            try:
                req = urllib.request.Request(f"{SUPA}/rest/v1/prospects_b2b", data=body, method="POST",
                    headers={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"application/json",
                             "Prefer":"resolution=merge-duplicates,return=minimal"})
                urllib.request.urlopen(req, timeout=300).read(); batch = []; return
            except Exception as e:
                if attempt == 4:
                    print(f"  [flush] falhou apos retries: {e}"); raise
                time.sleep(3 * (attempt + 1))

    with zipfile.ZipFile(est_zip) as z, z.open(z.namelist()[0]) as fh:
        reader = csv.reader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";", quotechar='"')
        for row in reader:
            scanned += 1
            if scanned % 2000000 == 0:
                print(f"  varridas {scanned//1000000}M linhas, casadas {matched} ({(time.time()-t0):.0f}s)")
            if len(row) < 21: continue
            if row[19] != uf: continue
            if row[5] != "02": continue           # situacao ATIVA
            cnae = row[11]
            if cnae not in TARGET: continue
            matched += 1
            stats_cnae[cnae] = stats_cnae.get(cnae, 0) + 1
            muni_name = rf_muni.get(row[20])
            lat = lng = None; gstatus = "pending"
            if muni_name:
                c = cent.get((uf, norm(muni_name)))
                if c: lat, lng, gstatus = c[0], c[1], "municipio"; geo_ok += 1
            cnpj = (row[0].zfill(8) + row[1].zfill(4) + row[2].zfill(2))
            dia = row[10] if len(row) > 10 and len(row[10]) == 8 and row[10] != "00000000" else None
            batch.append({
                "cnpj": cnpj, "cnpj_basico": row[0],
                "nome_fantasia": row[4] or None,
                "cnae_principal": cnae, "cnae_descricao": CNAE.get(cnae),
                "situacao_cadastral": row[5],
                "data_inicio_atividade": f"{dia[:4]}-{dia[4:6]}-{dia[6:]}" if dia else None,
                "tipo_logradouro": row[13] or None, "logradouro": row[14] or None,
                "numero": row[15] or None, "complemento": row[16] or None, "bairro": row[17] or None,
                "municipio_rf_code": row[20], "municipio": muni_name, "uf": uf,
                "cep": row[18] or None,
                "telefone": ((row[21]+row[22]) if len(row) > 22 and row[22] else None),
                "email": (row[27] or None) if len(row) > 27 else None,
                "lat": lat, "lng": lng, "geocode_status": gstatus,
            })
            if len(batch) >= 500: flush()
            if args.limit and matched >= args.limit: break
    flush()

    print("\n== RESULTADO PILOTO ==")
    print(f"  parte processada : Estabelecimentos{args.part}")
    print(f"  linhas varridas  : {scanned}")
    print(f"  PDVs casados (uf={uf}, ATIVA, CNAE-alvo): {matched}")
    print(f"  geocodificados por municipio: {geo_ok}  ({(geo_ok*100//matched) if matched else 0}%)")
    print(f"  tempo: {(time.time()-t0):.0f}s")
    print("  top CNAEs:")
    for c, n in sorted(stats_cnae.items(), key=lambda x: -x[1])[:12]:
        print(f"    {c} {CNAE.get(c,''):40s} {n}")

if __name__ == "__main__":
    main()
