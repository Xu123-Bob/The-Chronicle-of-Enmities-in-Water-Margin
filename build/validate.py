# -*- coding: utf-8 -*-
import os, sys, re, json
sys.path.insert(0, "build")
from roster import HEROES, OFFICIALS, COMMONERS
from relations import RELATIONS

# 名 → id
NAME2ID = {}
ALL = []
for rank, star, nick, name, extras in HEROES:
    cid = "h%03d" % rank
    ALL.append({"id": cid, "name": name})
    for a in [name, nick] + extras:
        NAME2ID.setdefault(a, cid)
for cid, name, aliases in OFFICIALS + COMMONERS:
    ALL.append({"id": cid, "name": name})
    for a in [name] + aliases:
        NAME2ID.setdefault(a, cid)
print("nodes:", len(ALL), "names:", len(NAME2ID))

chapters = {i: open("corpus/txt/%d.txt" % i, encoding="utf-8").read() for i in range(0, 121)}

from scoped import SCOPED

PAT = {c["id"]: re.compile("|".join(sorted(set([a for a, v in NAME2ID.items() if v == c["id"]]), key=len, reverse=True))) for c in ALL}

def present(cid, ch):
    if PAT[cid].search(chapters[ch]):
        return True
    for p, (lo, hi) in SCOPED.get(cid, []):
        if lo <= ch <= hi and re.search(p, chapters[ch]):
            return True
    return False

issues = []
for k, (f, t, ty, ch, note) in enumerate(RELATIONS):
    if f not in NAME2ID:
        issues.append("BAD_FROM %s" % f); continue
    if t not in NAME2ID:
        issues.append("BAD_TO %s" % t); continue
    fi, ti = NAME2ID[f], NAME2ID[t]
    if not present(fi, ch):
        issues.append("NO_ACTOR ch%d %s in %s" % (ch, f, ty))
    if not present(ti, ch):
        issues.append("NO_TARGET ch%d %s in %s" % (ch, t, ty))

open("build/issues.txt", "w", encoding="utf-8").write("\n".join(issues))
print("relations:", len(RELATIONS), "issues:", len(issues))
