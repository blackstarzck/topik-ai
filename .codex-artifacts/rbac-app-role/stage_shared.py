#!/usr/bin/env python3
"""Stage ONLY my hunks/rows in the two docs the concurrent session also edited.
- admin-data-contract.md: keep only the hunk containing my '9.1.1.a' marker.
- admin-doc-update-log.md: my row is entangled with concurrent rows in one hunk,
  so build a line-level insertion patch from HEAD (index) state.
Writes patches and applies them with `git apply --cached`.
"""
import subprocess, os, sys
sys.stdout.reconfigure(encoding="utf-8")

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")

OUT = os.path.dirname(os.path.abspath(__file__))

# ---- File 1: admin-data-contract.md — keep only the hunk with my marker ----
f1 = "docs/specs/admin-data-contract.md"
diff = sh(f"git diff -- {f1}").stdout
lines = diff.splitlines(keepends=True)
i = 0
header = []
while i < len(lines) and not lines[i].startswith("@@"):
    header.append(lines[i]); i += 1
hunks, cur = [], None
for l in lines[i:]:
    if l.startswith("@@"):
        if cur is not None: hunks.append(cur)
        cur = [l]
    else:
        cur.append(l)
if cur is not None: hunks.append(cur)
mine = [h for h in hunks if any("9.1.1.a" in x for x in h)]
assert mine, "could not find my 9.1.1.a hunk"
assert not any("NotificationDispatch" in x or "notification_dispatches" in x for h in mine for x in h), "my hunk unexpectedly contains concurrent content"
patch1 = "".join(header) + "".join("".join(h) for h in mine)
p1 = os.path.join(OUT, "p1_data_contract.patch")
open(p1, "w", encoding="utf-8", newline="\n").write(patch1)

# ---- File 2: admin-doc-update-log.md — line-level insertion after the separator ----
f2 = "logs/admin-doc-update-log.md"
head_lines = sh(f"git show HEAD:{f2}").stdout.split("\n")
sep = head_lines[14].rstrip("\r")  # line 15 = table separator
wt = open(f2, encoding="utf-8").read().split("\n")
myrow = next(x for x in wt if "관리자 app_role 변경 RPC + /system/permissions" in x).rstrip("\r")
patch2 = (
    f"diff --git a/{f2} b/{f2}\n"
    f"--- a/{f2}\n"
    f"+++ b/{f2}\n"
    f"@@ -15,1 +15,2 @@\n"
    f" {sep}\n"
    f"+{myrow}\n"
)
p2 = os.path.join(OUT, "p2_update_log.patch")
open(p2, "w", encoding="utf-8", newline="\n").write(patch2)

print("patch1 hunks kept:", len(mine))
print("patch2 row:", myrow[:80], "...")
# apply both to index
for p in (p1, p2):
    r = sh(f'git apply --cached --recount "{p}"')
    print("apply", os.path.basename(p), "->", "OK" if r.returncode == 0 else "FAIL\n" + r.stderr)
