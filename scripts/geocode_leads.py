# Geocodifica prospect_leads sem coordenada (leads de scraper/CSV do Google Places).
# Cascata: lat/lng ja existentes -> endereco (Nominatim) -> centroide do municipio.
# Idempotente: so processa lat IS NULL. Respeita Nominatim (1 req/s + User-Agent).
# Uso: python scripts/geocode_leads.py [--limit N]
import argparse, csv, io, json, time, unicodedata, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
env = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
SUPA = env["VITE_SUPABASE_URL"]; KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
UA = "cafesaporino-geocoder/1.0 (sac@cafesaporino.com.br)"

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()

# centroides (uf, nome_norm) -> (lat,lng) via kelvins
def load_centroids():
    base = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/"
    def get(u):
        with urllib.request.urlopen(urllib.request.Request(base+u, headers={"User-Agent": UA}), timeout=60) as r:
            return list(csv.DictReader(io.StringIO(r.read().decode("utf-8-sig"))))
    uf_by = {row["codigo_uf"]: row["uf"] for row in get("estados.csv")}
    cent = {}
    for m in get("municipios.csv"):
        u = uf_by.get(m["codigo_uf"])
        if u and m["latitude"]:
            cent[(u, norm(m["nome"]))] = (float(m["latitude"]), float(m["longitude"]))
    return cent

STATE_UF = {"sao paulo":"SP","minas gerais":"MG","rio de janeiro":"RJ","parana":"PR","santa catarina":"SC",
    "rio grande do sul":"RS","bahia":"BA","goias":"GO","espirito santo":"ES","distrito federal":"DF",
    "ceara":"CE","pernambuco":"PE","para":"PA","mato grosso":"MT","mato grosso do sul":"MS","maranhao":"MA",
    "paraiba":"PB","rio grande do norte":"RN","alagoas":"AL","piaui":"PI","sergipe":"SE","rondonia":"RO",
    "amazonas":"AM","acre":"AC","amapa":"AP","roraima":"RR","tocantins":"TO"}
def to_uf(state):
    s = (state or "").strip()
    if len(s) == 2: return s.upper()
    return STATE_UF.get(norm(s))

def nominatim(query):
    time.sleep(1.1)
    u = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"format": "jsonv2", "limit": 1, "countrycodes": "br", "q": query})
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "pt-BR"}), timeout=30) as r:
            arr = json.loads(r.read().decode("utf-8"))
            if arr: return float(arr[0]["lat"]), float(arr[0]["lon"])
    except Exception:
        return None
    return None

def rest(method, path, body=None, headers=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if headers: h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{SUPA}/rest/v1/{path}", data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read().decode()
        return json.loads(t) if t else None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--limit", type=int, default=0); args = ap.parse_args()
    cent = load_centroids(); print(f"{len(cent)} centroides")
    rows = rest("GET", "prospect_leads?select=id,company_name,address,city,state&lat=is.null&order=created_at" +
                (f"&limit={args.limit}" if args.limit else ""))
    print(f"leads sem coordenada: {len(rows)}")
    t = {"endereco": 0, "municipio": 0, "failed": 0}
    for i, le in enumerate(rows, 1):
        uf = to_uf(le.get("state")); city = le.get("city"); addr = le.get("address")
        lat = lng = None; gstatus = "failed"; gsrc = None
        if addr and city:
            hit = nominatim(f"{addr}, {city}, {uf or ''}, Brasil")
            if hit: lat, lng, gstatus, gsrc = hit[0], hit[1], "success", "nominatim_endereco"; t["endereco"] += 1
        if lat is None and city and uf:
            c = cent.get((uf, norm(city)))
            if c: lat, lng, gstatus, gsrc = c[0], c[1], "success", "municipio_centroide"; t["municipio"] += 1
        if lat is None: t["failed"] += 1
        patch = {"lat": lat, "lng": lng, "geocode_status": gstatus, "geocode_source": gsrc,
                 "geocoded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")}
        rest("PATCH", f"prospect_leads?id=eq.{le['id']}", patch, {"Content-Type": "application/json", "Prefer": "return=minimal"})
        if i % 20 == 0: print(f"  {i}/{len(rows)}  (end {t['endereco']} / muni {t['municipio']} / fail {t['failed']})")
    print(f"\nResumo: endereco {t['endereco']} | municipio {t['municipio']} | falhas {t['failed']} | total {len(rows)}")

if __name__ == "__main__":
    main()
