# -*- coding: utf-8 -*-
"""从原著抽取每条关系对应的原文段落，并生成前端数据文件"""
import os, re, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roster import HEROES, OFFICIALS, COMMONERS
from relations import RELATIONS
from scoped import SCOPED

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAME2ID, NAMES = {}, {}
for rank, star, nick, name, extras in HEROES:
    cid = "h%03d" % rank
    NAMES[cid] = name
    for a in [name, nick] + extras:
        NAME2ID.setdefault(a, cid)
for cid, name, aliases in OFFICIALS + COMMONERS:
    NAMES[cid] = name
    for a in [name] + aliases:
        NAME2ID.setdefault(a, cid)

PAT = {cid: re.compile("|".join(sorted(set([a for a, v in NAME2ID.items() if v == cid]), key=len, reverse=True)))
       for cid in NAMES}

CH = {i: open(os.path.join(ROOT, "corpus/txt/%d.txt" % i), encoding="utf-8").read() for i in range(0, 121)}
CHAPTERS = json.load(open(os.path.join(ROOT, "build/chapters.json"), encoding="utf-8"))

BODY_START = re.compile(r"(话说|卑说|却说|且说|诗曰|词曰|看官|话分两头|大宋|单说|且把|但见|话休絮烦)")

def prep(t):
    t = t.replace("卑说", "却说")
    m = BODY_START.search(t[:150])
    if m and m.start() < 110:
        t = t[m.start():]
    return t

CH = {k: prep(v) for k, v in CH.items()}


TYKW = {
    "恩": "恩|救|赠|送|银|收留|报答|养活|周济|济",
    "义": "义|兄弟|结拜|结义|同心|生死|情同|相厚|同气",
    "爱": "爱|情|奸|私通|夫妻|娶|勾|求欢|通",
    "孝": "孝|母|娘|爹|父|养|抚|子",
    "仇": "仇|恨|怨|害|怒|报仇|冤|气",
    "杀": "杀|死|砍|剁|毒|血|首级|打|刺|扎|药|灌|鸩|刀",
    "骗": "骗|赚|瞒|哄|计|诬|陷|假|诈|诱|谎",
}
SENT = re.compile(r"[^。！？\n]+[。！？]?", re.S)
GARBAGE = re.compile(r"[A-Za-z□]")

def hit(cid, s, ch):
    if PAT[cid].search(s):
        return True
    for p, (lo, hi) in SCOPED.get(cid, []):
        if lo <= ch <= hi and re.search(p, s):
            return True
    return False

def note_terms(note, text):
    runs = re.findall(r"[\u4e00-\u9fff]{2,}", note)
    cands = set()
    for r in runs:
        for L in (6, 5, 4, 3):
            for i in range(0, len(r) - L + 1):
                s = r[i:i + L]
                if s in text:
                    cands.add(s)
    terms = []
    for s in sorted(cands, key=len, reverse=True):
        if not any(s in t for t in terms):
            terms.append(s)
        if len(terms) >= 5:
            break
    return terms

def polish(q):
    q = re.sub(r"\s+", "", q)
    q = re.sub(r"(?<=[\u4e00-\u9fff])[A-Za-z]+(?=[\u4e00-\u9fff])", "", q)
    q = q.replace("□", "")
    q = q.strip("\u201c\u201d\u300c\u300d\u300e\u300f\"' ")
    return q

def best_window(fi, ti, ty, ch, note):
    text = CH[ch]
    sents = [s for s in SENT.findall(text) if s.strip()]
    if not sents:
        return -1e9, ""
    a = [hit(fi, s, ch) for s in sents]
    b = [hit(ti, s, ch) for s in sents]
    kw = re.compile(TYKW.get(ty, "^\b$"))
    terms = note_terms(note, text)
    best, best_score = None, -1e9
    n = len(sents)
    for i in range(n):
        for j in range(i, min(i + 5, n)):
            ha, hb = any(a[i:j + 1]), any(b[i:j + 1])
            if not (ha and hb):
                continue
            seg = "".join(sents[i:j + 1])
            kwn = len(kw.findall(seg))
            score = 10 + min(kwn, 5) * 3 + 8 * sum(1 for t in terms if t in seg)
            if (j - i) in (1, 2):
                score += 2
            score -= 0.2 * (j - i)
            if GARBAGE.search(seg):
                score -= 30
            if score > best_score:
                best_score, best = score, seg
    if best is None:
        for i, s in enumerate(sents):
            if a[i]:
                best = "".join(sents[i:i + 2])
                best_score = -50
                break
    return best_score, (polish(best) if best else "")

def trim(q):
    if len(q) > 340:
        q = q[:340] + "……"
    return q

def extract(fi, ti, ty, ch, note):
    sc, q = best_window(fi, ti, ty, ch, note)
    if q:
        return ch, trim(q)
    for d in (1, -1, 2, -2):
        c2 = ch + d
        if 0 <= c2 <= 120:
            sc2, q2 = best_window(fi, ti, ty, c2, note)
            if q2 and sc2 > sc:
                sc, q = sc2, q2
    return (ch, trim(q)) if q else (ch, "")

chars = json.load(open(os.path.join(ROOT, "build/stats.json"), encoding="utf-8"))
stats = {c["id"]: c for c in chars}

out_chars = []
for rank, star, nick, name, extras in HEROES:
    cid = "h%03d" % rank
    s = stats[cid]
    out_chars.append({"id": cid, "name": name, "nick": nick, "star": star, "rank": rank,
                      "group": "hero", "m": s["mentions"], "cc": s["chapterCount"]})
for cid, name, aliases in OFFICIALS:
    s = stats[cid]
    out_chars.append({"id": cid, "name": name, "nick": "", "star": "", "rank": None,
                      "group": "official", "m": s["mentions"], "cc": s["chapterCount"]})
for cid, name, aliases in COMMONERS:
    s = stats[cid]
    out_chars.append({"id": cid, "name": name, "nick": "", "star": "", "rank": None,
                      "group": "commoner", "m": s["mentions"], "cc": s["chapterCount"]})

out_rels = []
empty = 0
moved = 0
for f, t, ty, ch, note in RELATIONS:
    fi, ti = NAME2ID[f], NAME2ID[t]
    c2, q = extract(fi, ti, ty, ch, note)
    if c2 != ch:
        moved += 1
    if not q:
        empty += 1
    out_rels.append({"f": fi, "t": ti, "y": ty, "c": c2, "n": note, "q": q})

out_chapters = {str(k): v["full"] for k, v in CHAPTERS.items()}

os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
def dump(name, varname, obj):
    with open(os.path.join(ROOT, "data", name), "w", encoding="utf-8") as fp:
        fp.write("/* 自动生成，数据来源与统计口径见 README */\nwindow.%s=" % varname)
        s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        s = s.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
        fp.write(s)
        fp.write(";\n")

dump("characters.js", "SH_CHARS", out_chars)
dump("relations.js", "SH_RELS", out_rels)
dump("chapters.js", "SH_CHAPTERS", out_chapters)

print("chars", len(out_chars), "rels", len(out_rels), "empty_quote", empty, "moved", moved)
print("avg quote len", sum(len(r["q"]) for r in out_rels) // max(1, len(out_rels)))
