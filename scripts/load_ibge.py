# Carrega centroides de municipio (IBGE) na tabela public.ibge_municipios.
# Fonte: kelvins/municipios-brasileiros (dado publico, ~5570 linhas).
# Uso: python scripts/load_ibge.py
import csv, io, json, sys, unicodedata, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
env = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
SUPA = env["VITE_SUPABASE_URL"]
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

MUNI_URL = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv"
EST_URL = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/estados.csv"

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()

def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "cafesaporino-etl/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8-sig"))))

print("Baixando estados e municipios IBGE...")
estados = {row["codigo_uf"]: row["uf"] for row in fetch_csv(EST_URL)}
munis = fetch_csv(MUNI_URL)
rows = []
for m in munis:
    uf = estados.get(m["codigo_uf"])
    if not uf:
        continue
    rows.append({
        "codigo_ibge": m["codigo_ibge"],
        "uf": uf,
        "nome": m["nome"],
        "nome_norm": norm(m["nome"]),
        "lat": float(m["latitude"]) if m["latitude"] else None,
        "lng": float(m["longitude"]) if m["longitude"] else None,
    })
print(f"{len(rows)} municipios prontos.")

def post_batch(batch):
    body = json.dumps(batch).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPA}/rest/v1/ibge_municipios",
        data=body, method="POST",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    urllib.request.urlopen(req, timeout=120).read()

B = 1000
for i in range(0, len(rows), B):
    post_batch(rows[i:i+B])
    print(f"  carregados {min(i+B, len(rows))}/{len(rows)}")
print("IBGE centroides carregados.")
