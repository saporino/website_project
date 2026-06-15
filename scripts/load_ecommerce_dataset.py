# Carrega um dataset JÁ EXPORTADO do Apify (JSON) em ecommerce_price_snapshots — SEM rodar de novo.
# Custo zero: reaproveita um run que você já pagou. Normaliza igual à Edge Function.
# Uso: python scripts/load_ecommerce_dataset.py --file caminho.json --marketplace amazon
import argparse, json, math, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
env = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
SUPA = env["VITE_SUPABASE_URL"]; KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

SANE = {"torrado_moido": (15, 200), "graos": (30, 300), "soluvel": (30, 800),
        "capsula": (0, math.inf), "filtro": (0, math.inf), "outro": (0, math.inf)}

def weight_g(title):
    t = title.lower().replace(".", ",")
    m = re.search(r"(\d+(?:,\d+)?)\s*kg", t)
    if m: return float(m.group(1).replace(",", ".")) * 1000
    m = re.search(r"(\d+(?:,\d+)?)\s*g(?![a-z])", t)
    if m: return float(m.group(1).replace(",", "."))
    return None

def classify(title):
    t = title.lower()
    if re.search(r"c[áa]psula|nespresso|dolce gusto", t): return "capsula"
    if re.search(r"filtro|coador|papel", t): return "filtro"
    if re.search(r"sol[úu]vel|instant|cappuccino|capuccino", t): return "soluvel"
    if re.search(r"gr[ãa]os?|em gr[ãa]o|beans", t) and not re.search(r"mo[íi]do", t): return "graos"
    return "torrado_moido"

def num(v):
    if isinstance(v, (int, float)): return v
    if isinstance(v, str):
        try: return float(v.replace(",", "."))
        except: return None
    if isinstance(v, dict) and isinstance(v.get("value"), (int, float)): return v["value"]
    return None

def normalize(raw):
    title = raw.get("title") or raw.get("name") or ""
    price = num(raw.get("price"))
    w = weight_g(title); ut = classify(title)
    ppk = round(price / (w / 1000), 2) if price and w else None
    suspect = False
    if ppk is not None:
        lo, hi = SANE.get(ut, (0, math.inf))
        if ppk < lo or ppk > hi: suspect = True
    return dict(weight_g=w, unit_type=ut, is_arabica=bool(re.search(r"ar[áa]bica", title.lower())),
                price_per_kg=ppk, is_suspect=suspect)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True); ap.add_argument("--marketplace", default="amazon")
    args = ap.parse_args()
    items = json.loads(Path(args.file).read_text(encoding="utf-8"))
    if isinstance(items, dict): items = items.get("items") or [items]

    def get(p, path):
        r = requests_get(path)
        return r
    def requests_get(path):
        req = urllib.request.Request(f"{SUPA}/rest/v1/{path}", headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
        return json.loads(urllib.request.urlopen(req, timeout=30).read())

    company_id = requests_get("companies?select=id&order=created_at&limit=1")[0]["id"]
    from datetime import datetime, timezone
    captured = datetime.now(timezone.utc).isoformat()
    rows = []
    for raw in items:
        title = raw.get("title") or raw.get("name") or ""
        price = num(raw.get("price"))
        sku = str(raw.get("itemId") or raw.get("sku") or raw.get("asin") or raw.get("id") or "")
        if price is None or not sku or not title: continue
        rows.append({
            "company_id": company_id, "captured_at": captured, "marketplace": args.marketplace,
            "search_term": raw.get("searchTerm") or raw.get("search"), "listing_sku": sku, "title": title,
            "thumb_url": raw.get("thumbnail") or raw.get("image") or raw.get("mainImage"),
            "url": raw.get("url") or raw.get("link"), "domain_id": raw.get("category"),
            "price": price, "price_before": num(raw.get("originalPrice")), "discount_pct": raw.get("discountPercentage") or raw.get("discount"),
            "currency": raw.get("currency") or "BRL", "is_sponsored": bool(raw.get("isSponsored")),
            **normalize(raw), "raw": raw,
        })
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(f"{SUPA}/rest/v1/ecommerce_price_snapshots", data=body, method="POST",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"})
    urllib.request.urlopen(req, timeout=120).read()
    valid = [r for r in rows if r["price_per_kg"] is not None and not r["is_suspect"] and r["unit_type"] != "filtro"]
    print(f"Inseridos {len(rows)} anuncios ({args.marketplace}). Na regua R$/kg: {len(valid)}.")

if __name__ == "__main__":
    main()
