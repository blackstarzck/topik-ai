#!/usr/bin/env python3
"""Surgically stage only my hunks in files shared with the concurrent (social-providers)
session. Builds a filtered patch from `git diff <file>` and applies it with
`git apply --cached`. Drops whole concurrent hunks and can drop specific added lines
inside an otherwise-mine hunk (recomputing the hunk header's new-count)."""
import re
import subprocess
import sys

def git_diff(path):
    return subprocess.run(
        ["git", "diff", "--no-color", "--", path],
        capture_output=True, text=True, check=True,
        encoding="utf-8",
    ).stdout

def split_hunks(diff):
    lines = diff.splitlines(keepends=True)
    header = []
    i = 0
    while i < len(lines) and not lines[i].startswith("@@"):
        header.append(lines[i]); i += 1
    hunks = []
    cur = None
    for line in lines[i:]:
        if line.startswith("@@"):
            if cur is not None:
                hunks.append(cur)
            cur = [line]
        else:
            cur.append(line)
    if cur is not None:
        hunks.append(cur)
    return "".join(header), hunks

HUNK_RE = re.compile(r"^@@ -(\d+),(\d+) \+(\d+),(\d+) @@(.*)$")

def filter_added_lines(hunk, drop_substrings):
    """Remove '+' lines containing any drop substring; fix new-count in header."""
    head = hunk[0]
    m = HUNK_RE.match(head.rstrip("\n"))
    o_start, o_len, n_start, n_len, ctx = m.groups()
    n_len = int(n_len)
    body = []
    dropped = 0
    for line in hunk[1:]:
        if line.startswith("+") and not line.startswith("+++") and any(s in line for s in drop_substrings):
            dropped += 1
            continue
        body.append(line)
    n_len -= dropped
    new_head = f"@@ -{o_start},{o_len} +{n_start},{n_len} @@{ctx}\n"
    return [new_head] + body

def main():
    path = sys.argv[1]
    # spec: comma-list of keep-rules. Each rule = "<old_start>" to keep a hunk whole,
    # or "<old_start>:drop=substr1|substr2" to keep but drop matching added lines.
    rules = {}
    for spec in sys.argv[2].split(";"):
        spec = spec.strip()
        if not spec:
            continue
        if ":drop=" in spec:
            key, subs = spec.split(":drop=")
            rules[key] = subs.split("|")
        else:
            rules[spec] = []  # keep whole

    header, hunks = split_hunks(git_diff(path))
    out = [header]
    for hunk in hunks:
        m = HUNK_RE.match(hunk[0].rstrip("\n"))
        o_start = m.group(1)
        if o_start not in rules:
            continue  # drop concurrent hunk
        drop = rules[o_start]
        out.extend(filter_added_lines(hunk, drop) if drop else hunk)

    patch = "".join(out)
    out_path = sys.argv[3]
    with open(out_path, "w", encoding="utf-8", newline="") as fh:
        fh.write(patch)
    sys.stderr.write(f"wrote filtered patch for {path} -> {out_path} (kept old_starts={sorted(rules)})\n")

if __name__ == "__main__":
    main()
