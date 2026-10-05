# -*- coding: utf-8 -*-
import os, re, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roster import HEROES, OFFICIALS, COMMONERS

TXT = "corpus/txt"
chapters = {}
for i in range(0, 121):
    chapters[i] = open(os.path.join(TXT, "%d.txt" % i), encoding="utf-8").read()

# 限定回目的代称（原著多称"那妇人""婆惜"等）
from scoped import SCOPED

cache = {}
def chap_counts(pattern):
    if pattern in cache:
        return cache[pattern]
    pat = re.compile(pattern)
    res = {i: len(pat.findall(t)) for i, t in chapters.items()}
    cache[pattern] = res
    return res

def count_for(aliases, scoped):
    pat = "|".join(sorted(set(aliases), key=len, reverse=True))
    cc = chap_counts(pat)
    per = dict(cc)
    for p, (lo, hi) in scoped:
        sc = chap_counts(p)
        for i in range(lo, hi + 1):
            per[i] = per.get(i, 0) + sc.get(i, 0)
    mentions = sum(per.values())
    chs = sorted([i for i, v in per.items() if v > 0])
    return mentions, chs

chars = []
def add(cid, name, nick, star, rank, group, aliases):
    al = list(set([name] + list(aliases)))
    m, ch = count_for(al, SCOPED.get(cid, []))
    chars.append({
        "id": cid, "name": name, "nick": nick, "star": star, "rank": rank,
        "group": group, "mentions": m,
        "firstChapter": min(ch) if ch else None,
        "lastChapter": max(ch) if ch else None,
        "chapterCount": len(ch),
    })

for rank, star, nick, name, extras in HEROES:
    add("h%03d" % rank, name, nick, star, rank, "hero", [nick] + extras)
for cid, name, aliases in OFFICIALS:
    add(cid, name, "", "", None, "official", aliases)
for cid, name, aliases in COMMONERS:
    add(cid, name, "", "", None, "commoner", aliases)

chars.sort(key=lambda c: -c["mentions"])
json.dump(chars, open("build/stats.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

lines = ["%6s %5s %-9s %s" % ("men", "chap", "group", "name")]
for c in chars:
    lines.append("%6d %5d %-9s %s" % (c["mentions"], c["chapterCount"], c["group"], c["name"]))
open("build/stats.txt", "w", encoding="utf-8").write("\n".join(lines))
print("chars:", len(chars), "max:", chars[0]["mentions"])
