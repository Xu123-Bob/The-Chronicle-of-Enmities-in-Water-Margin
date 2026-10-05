import re, os, html as H

RAW = "corpus/raw"
TXT = "corpus/txt"
os.makedirs(TXT, exist_ok=True)

def extract_div(text, start_marker):
    i = text.find(start_marker)
    if i < 0:
        return ""
    i = text.find(">", i) + 1
    depth = 1
    j = i
    for m in re.finditer(r"<(/?)div\b[^>]*>", text[i:]):
        if m.group(1) == "":
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                j = i + m.start()
                break
    return text[i:j]

def clean(h):
    h = re.sub(r"<script.*?</script>", "", h, flags=re.S | re.I)
    h = re.sub(r"<style.*?</style>", "", h, flags=re.S | re.I)
    h = re.sub(r"<br\s*/?>", "\n", h, flags=re.I)
    h = re.sub(r"</p>", "\n", h, flags=re.I)
    h = re.sub(r"<[^>]+>", "", h)
    h = H.unescape(h)
    h = h.replace("\u3000", " ")
    h = re.sub(r"[ \t]+", " ", h)
    lines = [ln.strip() for ln in h.split("\n")]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)

total = 0
for i in range(0, 121):
    p = os.path.join(RAW, "%d.html" % i)
    if not os.path.exists(p):
        print("missing", i)
        continue
    raw = open(p, encoding="utf-8").read()
    body = extract_div(raw, 'class="content mdui-prose"')
    if not body:
        body = extract_div(raw, 'class="content')
    txt = clean(body)
    # 去掉页脚常见噪声
    open(os.path.join(TXT, "%d.txt" % i), "w", encoding="utf-8").write(txt)
    total += len(txt)
    print("ch %d chars=%d" % (i, len(txt)))

print("TOTAL CHARS", total)
