# -*- coding: utf-8 -*-
import os, re, json

BODY = ["话说", "卑说", "却说", "且说", "话休", "话表", "话分两头", "看官", "诗曰", "词曰",
        "次日", "当下", "当时", "原来", "自古", "从来", "如今", "此时", "都说", "且把",
        "大宋", "单说", "但见", "有诗为证", "且不说", "且说"]

def parse(i):
    t = open("corpus/txt/%d.txt" % i, encoding="utf-8").read()
    head = t[:200].replace("\n", " ").strip()
    m = re.match(r"(第[一二三四五六七八九十百零〇]+回|楔子)\s*", head)
    no = m.group(1) if m else ""
    rest = head[m.end():] if m else head
    cut = len(rest)
    for b in BODY:
        j = rest.find(b)
        if j > 0:
            cut = min(cut, j)
    title = rest[:cut].strip()
    title = title.replace("\u3000", " ").strip()
    parts = [p for p in title.split(" ") if p]
    if len(parts) == 1:
        s = parts[0]
        half = len(s) // 2
        parts = [s[:half], s[half:]] if half >= 4 else [s]
    elif len(parts) > 2:
        parts = [parts[0], "".join(parts[1:])]
    return no, parts

out = {}
for i in range(0, 121):
    no, parts = parse(i)
    full = no + (" " + " ".join(parts) if parts else "")
    out[i] = {"no": no, "parts": parts, "full": full}

json.dump(out, open("build/chapters.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open("build/chapters.txt", "w", encoding="utf-8").write(
    "\n".join("%3d  %s" % (k, v["full"]) for k, v in out.items()))
print("ok")
