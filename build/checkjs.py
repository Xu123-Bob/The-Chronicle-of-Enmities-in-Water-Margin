# -*- coding: utf-8 -*-
"""轻量 JS 语法体检：括号配平 + 数据引用完整性"""
import json, sys, re

def load_data(path):
    s = open(path, encoding="utf-8").read()
    return json.loads(s.split("=", 1)[1].rstrip().rstrip(";"))

CHARS = load_data("data/characters.js")
RELS = load_data("data/relations.js")
CHAP = load_data("data/chapters.js")

ids = set(c["id"] for c in CHARS)
errs = []
for i, r in enumerate(RELS):
    if r["f"] not in ids: errs.append("rel%d unknown from %s" % (i, r["f"]))
    if r["t"] not in ids: errs.append("rel%d unknown to %s" % (i, r["t"]))
    if r["y"] not in "恩义爱孝仇杀骗": errs.append("rel%d bad type %s" % (i, r["y"]))
    if str(r["c"]) not in CHAP: errs.append("rel%d bad chapter %s" % (i, r["c"]))
    if not r["q"]: errs.append("rel%d empty quote" % i)
    if r["f"] == r["t"]: errs.append("rel%d self loop" % i)
for c in CHARS:
    if c["m"] <= 0: errs.append("zero mentions: %s" % c["name"])

def balance(path):
    src = open(path, encoding="utf-8").read()
    out = []
    i, n = 0, len(src)
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    line = 1
    while i < n:
        ch = src[i]
        if ch == "\n":
            line += 1; i += 1; continue
        if ch == "/" and i + 1 < n and src[i+1] == "/":
            while i < n and src[i] != "\n": i += 1
            continue
        if ch == "/" and i + 1 < n and src[i+1] == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i+1] == "/"):
                if src[i] == "\n": line += 1
                i += 1
            i += 2; continue
        if ch in "\"'`":
            q = ch; i += 1
            while i < n:
                if src[i] == "\\": i += 2; continue
                if src[i] == q: i += 1; break
                if src[i] == "\n": line += 1
                i += 1
            continue
        if ch == "/":
            # 正则字面量：前面是运算符/括号/逗号等
            j = i - 1
            while j >= 0 and src[j] in " \t\n": j -= 1
            prev = src[j] if j >= 0 else ""
            if prev in "(,=:[!&|?{};+*%" or prev == "":
                i += 1
                while i < n:
                    if src[i] == "\\": i += 2; continue
                    if src[i] == "[": 
                        while i < n and src[i] != "]": i += 1
                        i += 1; continue
                    if src[i] == "/": i += 1; break
                    if src[i] == "\n": break
                    i += 1
                while i < n and src[i].isalpha(): i += 1
                continue
        if ch in "([{": stack.append((ch, line)); i += 1; continue
        if ch in ")]}":
            if not stack or stack[-1][0] != pairs[ch]:
                out.append("%s:%d unbalanced '%s'" % (path, line, ch))
                return out
            stack.pop(); i += 1; continue
        i += 1
    for s in stack:
        out.append("%s:%d unclosed '%s'" % (path, s[1], s[0]))
    return out

for f in ["js/graph.js", "js/app.js"]:
    errs += balance(f)

open("build/checkjs.txt", "w", encoding="utf-8").write("\n".join(errs) if errs else "ALL OK")
print("chars=%d rels=%d chapters=%d errors=%d" % (len(CHARS), len(RELS), len(CHAP), len(errs)))
