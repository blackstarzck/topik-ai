#!/usr/bin/env python3
"""Read-only Supabase Management API query helper.
Usage:
  python dbq.py "<SQL>"            -> prints JSON to stdout
  python dbq.py -f path/to.sql    -> runs SQL from file
Reads SUPABASE_ACCESS_TOKEN from .env.local. ONLY for read-only introspection.
"""
import sys, os, json, urllib.request, re
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = "fglggyfvzjdsbyckinqa"

def load_token():
    p = os.path.join(ROOT, ".env.local")
    with open(p, "r", encoding="utf-8-sig") as f:
        for line in f:
            if line.strip().startswith("SUPABASE_ACCESS_TOKEN"):
                return line.split("=", 1)[1].strip()
    raise SystemExit("token not found")

def run(sql):
    token = load_token()
    url = f"https://api.supabase.com/v1/projects/{REF}/database/query"
    data = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "curl/8.4.0")
    req.add_header("Accept", "*/*")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.read().decode("utf-8")

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        raise SystemExit("need SQL or -f file")
    if args[0] == "-f":
        with open(args[1], "r", encoding="utf-8") as f:
            sql = f.read()
    else:
        sql = args[0]
    out = run(sql)
    sys.stdout.write(out)
