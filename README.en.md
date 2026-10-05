<p align="center">
  <img src="shuihu.png" alt="水浒" width="800">
</p>

<h1 align="center">水浒人物关系图 · 恩义爱孝仇杀骗</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://github.com/Xu123-Bob/Baize"><img src="https://img.shields.io/badge/Baize-Agent-blue" alt="Baize Agent"></a>
</p>

<p align="center"><strong>语言 / Language / 言語：</strong> <a href="README.md">中文</a> ｜ <a href="README.en.md">English</a> ｜ <a href="README.ja.md">日本語</a></p>

---

An interactive visualization of character relationships in *Water Margin* (Outlaws of the Marsh), made for **general enjoyment and reading**.

Just open `index.html` — fully static, zero dependencies, works offline. Double-click to run; no environment setup required.

### 1. Interface: A Three-Pane Layout

| Pane | Content |
| --- | --- |
| **Left (1/6)** | The full character roster, in four groups: **36 Heavenly Spirits → 72 Earthly Fiends → Song-dynasty officials → common folk**; searchable by name or nickname |
| **Center (fluid)** | A force-directed relationship graph: **nodes = people, edges = relationships**; zoom with the wheel, pan by dragging, drag nodes, double-click to center |
| **Right (1/3)** | Selecting a character or an edge shows the relationship's **chapter, gloss, and an excerpt from the original text** |

**All three panes are resizable**: a divider sits between each pair (it lights up on hover) — drag it left or right to resize; **double-click a divider** to restore the default ratio. The center pane keeps a 240 px minimum, so the graph can never be squeezed away. Widths are stored as percentages and hold their proportion when the window is resized.

**Heavenly Spirits vs. Earthly Fiends**: the 108 heroes are split by rank into the **36 Heavenly Spirits** and the **72 Earthly Fiends**. The left roster reflects this split, and in the graph the **Heavenly Spirits are gold with a golden halo**, while the Earthly Fiends are solid ochre. Besides the relationship legend, a second legend in the top-left shows these tiers. Hovering a character tags the tooltip with "Heavenly" or "Earthly".

**Stable on entry**: before the first frame is drawn, the layout runs its physics simulation to convergence off-screen and then freezes. So the graph **appears already settled** — no chaotic initial drift and no perpetual jitter. It only gives a gentle relaxation in response to deliberate actions such as dragging or filtering.

The "original excerpt" panel on the right is deliberately **split into two parts**, to avoid confusion:

```
┌─────────────────────────────────────────┐
│ Chapter │ Ch.10  Zhu Gu Signals ... Lin Chong ascends Liangshan │  ← Part 1: source
├─────────────────────────────────────────┤
│  It turned out this man was Gao Qiu, ...                        │  ← Part 2: text
└─────────────────────────────────────────┘
```

### 2. Two Core Design Choices

#### Node size = number of appearances (very deliberately compressed)

The radius is **log-compressed**:

```js
norm = log(1 + appearances) / log(1 + max appearances in the whole book)
radius = 5.5 + 5.0 * norm        // effective range roughly 5.9 – 10.5 px
```

So Song Jiang (4019 mentions) has a radius less than double that of a minor figure appearing only two or three times — **enough hierarchy to be legible, never enough to dominate**.

> Counting method: the full text is scanned for each character's name + nickname + aliases; for figures usually referred to generically in the original (e.g. "that woman", "Poxi" for Pan Jinlian and Yan Poxi), aliases are added within restricted chapter ranges (see `build/scoped.py`).

#### Directed relationships: actor → receiver

Edges are **arrowed**, showing who acts upon whom. There are seven kinds, each with its own color:

| Type | Meaning | Example |
| --- | --- | --- |
| **Gratitude** | Granting and receiving kindness | Chai Jin → Lin Chong (shelter and silver) |
| **Righteousness** | Loyalty, sworn brotherhood, trust unto death | Lu Zhishen → Lin Chong (rescue at Wild Boar Forest) |
| **Love** | Affection, marriage, illicit romance | Ximen Qing → Pan Jinlian |
| **Filial Piety** | Devotion to kin, nurture | Wu Song → Wu Dalang (a brother honored as a father) |
| **Feud** | Enmity, resentment, vendetta | Gao Qiu → Lin Chong (framed at White Tiger Hall) |
| **Slaying** | Killing, bloodshed, debts of blood | Li Kui → Li Gui |
| **Deceit** | Trickery, scheming, entrapment | Wu Yong → Lu Junyi (the clever ploy for the Jade Qilin) |

The legend in the top-left lets you **toggle each type on or off**; if two characters have a relationship in both directions, the edges automatically bow apart (one above, one below) so the two arrows never overlap.

### 3. Data at a Glance

| Item | Count |
| --- | --- |
| Character nodes | **183** (108 heroes + 31 Song officials / officers + 44 commoners) |
| Relationship edges | **215**, spanning all seven types |
| Original-text excerpts | **215**, each tagged with its chapter |
| Corpus | 121 pieces (preface + 120 chapters), ~885,000 characters — **not shipped with the repo, see §5** |

The data files are tiny (about 113 KB total), so the first paint is near-instant.

### 4. Repository Layout

**Minimal runtime set (7 files, ~160 KB)** — after cloning, only these are needed; just double-click `index.html`:

```
# ── Required to run ────────────────────────
index.html            Page skeleton (three panes)
css/style.css         Styles (ink on rice paper, Chinese aesthetic)
js/graph.js           Force-directed engine: custom physics + Canvas rendering + interaction (zero deps)
js/app.js             Application layer: roster, legend, detail wiring
data/characters.js    Character data (generated)
data/relations.js     Relationship data + excerpts (generated)
data/chapters.js      Chapter-title index (generated)

# ── Shipped with the repository ───────────
README.md             Docs (Chinese)
README.en.md          Docs (English)
README.ja.md          Docs (Japanese)
LICENSE               MIT License
.gitignore            Ignore rules (session files, corpus, caches)

# ── Optional: data pipeline (Python) ─────
build/                Data pipeline (Python, optional)
  roster.py           Roster source data (108 seats / stars / nicknames + officials + commoners)
  relations.py        Source data for the 215 relations (actor / receiver / type / chapter / gloss)
  scoped.py           Aliases restricted to specific chapter ranges
  count.py            Appearance counts -> stats.json
  chapters.py         Chapter-title index -> chapters.json
  validate.py         Checks: names resolve, both parties really co-occur in that chapter
  emit.py             Extracts excerpts -> generates data/*.js
  checkjs.py          Data integrity + JS bracket-balance sanity check

corpus/               Water Margin corpus and fetch/extract scripts
  download.py         Fetches the full text from a public site -> corpus/raw/
  extract.py          Cleans it into corpus/txt/
  txt/                121 text files (large; ignored via .gitignore)
```

So the **minimal upload is 7 runtime files + 3 docs + `LICENSE` + `.gitignore` — 12 files in total**; `build/` and `corpus/` are optional.

### 5. Reproducing or Extending the Data

The repository **does not include the original text** (`corpus/txt/` is listed in `.gitignore`). To re-run the pipeline, obtain the corpus first:

```bash
python corpus/download.py  # 0. Fetch the full text -> corpus/raw/
python corpus/extract.py   #    Clean it into -> corpus/txt/
python build/count.py      # 1. Count appearances
python build/chapters.py   # 2. Extract chapter titles
python build/validate.py   # 3. Validate relations and chapters (expect "issues: 0")
python build/emit.py       # 4. Extract excerpts and generate data/*.js
python build/checkjs.py    # 5. Health check (expect "errors=0")
```

**To add a character**: add one row in `build/roster.py`.
**To add a relationship**: add one entry `(actor, receiver, type, chapter, gloss)` in `build/relations.py`, where the chapter number is the corpus index (`0` = preface, `1` = chapter 1 … `120` = chapter 120).
Then re-run the scripts above. Excerpts are **located automatically** within that chapter by finding the passages where both parties appear, weighted by content words from the gloss.

### 6. How the Excerpts Are Produced

They are not transcribed by hand; the program *finds* them in the original:

1. Split the target chapter into sentences.
2. Find the smallest sentence window containing **both the actor and the receiver**.
3. Score by relationship-type keywords (Slaying → "kill / die / poison / blood"; Deceit → "deceive / trick / hide / lure" …) plus content words from the gloss.
4. Discard windows with OCR noise and take the best-scoring one.

So every excerpt is **genuine original text** — it may simply not be the single most famous line of the episode.

### 7. Notes and Limitations

- **Chapter numbering** follows the e-text used here (its preface, "Zhang Tianshi Averts a Plague / Marshal Hong Releases the Demons", stands as a separate piece, so body chapters run one ahead of some common editions). Each excerpt corresponds exactly to the chapter it cites, so you can search the text directly by chapter title.
- **Relationship entries** were compiled by hand, aiming to cover the classic episodes rather than to be exhaustive; contributions to `build/relations.py` are welcome.
- The corpus comes from an e-text of *Water Margin* on a Chinese classical-literature site and contains a few OCR errors (filtered and cleaned during excerpt extraction). *Water Margin* is in the public domain; this tool is intended for reading and study only.
- Nothing in this repository (scripts or data) contains personal information, keys, tokens, or machine-specific absolute paths.

### 8. License

Released under the **MIT License** — see [LICENSE](LICENSE). The text of *Water Margin* itself is in the public domain and is used here for reading and study only.

### 9. Contributions

- This project is supported by deepseek-v4.1-flash.
- This project was independently completed by the Baize Agent.
- This work is inspired by *Water Margin*, one of the Four Great Classical Novels of Chinese literature. Its spirit of righteousness and courage to struggle is the essence of Chinese civilization.

### 10. Follow & Contact

- Various works will be continuously updated on Douyin, and there is also an exclusive Douyin community. Feel free to join if interested.
- The WeChat Official Account will also be continuously updated.

<h3 align="center">Scan to Follow / Contact the Author</h3>

<table align="center" style="border: none; width: 100%;">
  <tr>
    <td align="center" width="50%">
      <strong>Douyin</strong><br>
      <img src="image/抖音.png" alt="Douyin QR Code" width="300">
    </td>
    <td align="center" width="50%">
      <strong>WeChat</strong><br>
      <img src="image/微信公众号.jpg" alt="WeChat QR Code" width="300">
    </td>
  </tr>
</table>

Thank you all for your support!

---

**One hundred and eight souls, each bound by gratitude and grudge; seven kinds of ties, all in a single graph.**
