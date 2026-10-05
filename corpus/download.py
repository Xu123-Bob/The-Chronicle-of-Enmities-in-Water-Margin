import urllib.request, os, time

BASE = "http://www.zggdwx.com/shuihu/"
OUT = os.path.join("corpus", "raw")
os.makedirs(OUT, exist_ok=True)

def grab(u, timeout=25):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 Chrome/120"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")

ok, fail = 0, 0
for i in range(0, 121):
    path = os.path.join(OUT, "%d.html" % i)
    if os.path.exists(path) and os.path.getsize(path) > 2000:
        ok += 1
        continue
    try:
        html = grab(BASE + "%d.html" % i)
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        ok += 1
        print("ok %d len=%d" % (i, len(html)))
    except Exception as e:
        fail += 1
        print("fail %d %s" % (i, repr(e)[:50]))
    time.sleep(0.4)

print("DONE ok=%d fail=%d" % (ok, fail))
