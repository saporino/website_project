# Enriquece leads da base RF (sem nome) com razao social / nome fantasia via OpenCNPJ.
# A RF (Estabelecimentos) nao traz razao social; em vez de baixar o arquivo Empresas (~1.2 GB),
# consultamos por CNPJ apenas os leads PROMOVIDOS (os que o rep trabalha). DB impacto ~zero.
# Idempotente: so processa leads cujo company_name e so-digitos (ou sem nome).
# Uso: python scripts/enrich_leads.py [--limit N]
import argparse, json, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
env = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
SUPA = env["VITE_SUPABASE_URL"]; KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

def rest(method, path, body=None, extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if extra: h.update(extra)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{SUPA}/rest/v1/{path}", data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read().decode(); return json.loads(t) if t else None

def opencnpj(cnpj):
    try:
        req = urllib.request.Request(f"https://api.opencnpj.org/{cnpj}", headers={"User-Agent": "cafesaporino-etl/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--limit", type=int, default=0); args = ap.parse_args()
    rows = rest("GET", "prospect_leads?select=id,cnpj,company_name,trade_name&source=eq.rf_dados_abertos&order=created_at")
    todo = [r for r in rows if r.get("cnpj") and (not r.get("company_name") or str(r["company_name"]).isdigit())]
    if args.limit: todo = todo[:args.limit]
    print(f"leads RF sem nome: {len(todo)} (de {len(rows)} RF)")
    ok = fail = 0
    for i, le in enumerate(todo, 1):
        d = opencnpj(le["cnpj"])
        time.sleep(0.1)  # ~10 req/s (limite OpenCNPJ e 50/s)
        razao = (d or {}).get("razao_social"); fant = (d or {}).get("nome_fantasia")
        if not razao and not fant:
            fail += 1; continue
        patch = {"company_name": razao or fant}
        if fant and not le.get("trade_name"): patch["trade_name"] = fant
        rest("PATCH", f"prospect_leads?id=eq.{le['id']}", patch, {"Content-Type": "application/json", "Prefer": "return=minimal"})
        # espelha no universo (futuros promotes / tooltips do mapa)
        pp = {}
        if razao: pp["razao_social"] = razao
        if fant: pp["nome_fantasia"] = fant
        if pp:
            rest("PATCH", f"prospects_b2b?cnpj=eq.{le['cnpj']}", pp, {"Content-Type": "application/json", "Prefer": "return=minimal"})
        ok += 1
        if i % 50 == 0: print(f"  {i}/{len(todo)} (ok {ok} / sem dado {fail})")
    print(f"\nResumo: enriquecidos {ok} | sem retorno {fail} | total {len(todo)}")

if __name__ == "__main__":
    main()
