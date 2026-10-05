/* ============================================================
   水浒人物关系图 · 应用层
   ============================================================ */
(function () {
  "use strict";

  var CHARS = window.SH_CHARS || [];
  var RELS = window.SH_RELS || [];
  var CHAP = window.SH_CHAPTERS || {};

  var TYPE_COLORS = window.SHGraph.TYPE_COLORS;
  var tierOf = window.SHGraph.tierOf;
  var TYPES = ["恩", "义", "爱", "孝", "仇", "杀", "骗"];
  var TYPE_DESC = {
    "恩": "施恩与受恩",
    "义": "义气、结拜、生死相托",
    "爱": "爱慕、婚配、私情",
    "孝": "孝亲、人伦、养育",
    "仇": "结仇、怨恨、仇隙",
    "杀": "杀伐、害命、血债",
    "骗": "欺瞒、算计、诱赚"
  };

  var byId = {};
  CHARS.forEach(function (c) { byId[c.id] = c; });

  var graph = new window.SHGraph(document.getElementById("graph"), {
    onNode: selectNode,
    onEdge: selectEdge,
    onBlank: clearSelection
  });
  graph.setData(CHARS, RELS);

  /* ---------------- 左栏名册 ---------------- */
  var GROUPS = [
    { key: "hero", tier: "tiangang", title: "天罡三十六 · 星主", order: function (a, b) { return a.rank - b.rank; } },
    { key: "hero", tier: "disa", title: "地煞七十二 · 头领", order: function (a, b) { return a.rank - b.rank; } },
    { key: "official", title: "官场人员", order: function (a, b) { return b.m - a.m; } },
    { key: "commoner", title: "普通人 · 市井草莽", order: function (a, b) { return b.m - a.m; } }
  ];

  var roster = document.getElementById("roster");
  var items = {};

  GROUPS.forEach(function (g) {
    var list = CHARS.filter(function (c) { return c.group === g.key && (!g.tier || tierOf(c) === g.tier); }).sort(g.order);
    var hd = document.createElement("div");
    hd.className = "group-title";
    hd.innerHTML = "<span>" + g.title + "</span><span class='cnt'>" + list.length + " 人</span>";
    roster.appendChild(hd);
    list.forEach(function (c) {
      var el = document.createElement("div");
      el.className = "person g-" + tierOf(c);
      var rk = c.group === "hero" ? c.rank : "·";
      el.innerHTML = "<span class='dot'></span><span class='rk'>" + rk + "</span>" +
        "<span class='info'><span class='nm'>" + c.name + "</span>" +
        (c.nick ? "<span class='nk'>" + c.nick + "</span>" : "") + "</span>";
      el.dataset.id = c.id;
      el.dataset.search = (c.name + (c.nick || "") + (c.star || "")).toLowerCase();
      el.title = c.name + (c.nick ? "　「" + c.nick + "」" : "") +
        (c.star ? "　" + c.star : "") + (c.rank ? "　第 " + c.rank + " 位" : "") +
        "　出场 " + c.m + " 次";
      el.addEventListener("click", function () { selectNode(c.id, true); });
      roster.appendChild(el);
      items[c.id] = el;
    });
  });

  document.getElementById("search").addEventListener("input", function (ev) {
    var q = ev.target.value.trim().toLowerCase();
    Object.keys(items).forEach(function (id) {
      var el = items[id];
      var hit = !q || el.dataset.search.indexOf(q) >= 0;
      el.style.display = hit ? "" : "none";
    });
  });

  /* ---------------- 图例 ---------------- */
  var legend = document.getElementById("legend");
  TYPES.forEach(function (t) {
    var n = RELS.filter(function (r) { return r.y === t; }).length;
    var el = document.createElement("div");
    el.className = "lg";
    el.innerHTML = "<span class='sw' style='background:" + TYPE_COLORS[t] + "'></span>" +
      "<span>" + t + "</span><span style='color:#a79c84'>" + n + "</span>";
    el.title = TYPE_DESC[t] + "（点击显示/隐藏）";
    el.addEventListener("click", function () {
      var on = el.classList.toggle("off") ? false : true;
      graph.setType(t, on);
      updateStatus();
    });
    legend.appendChild(el);
  });

  // 星阶图例（天罡 / 地煞 / 官绅 / 百姓）
  (function addNodeLegend() {
    var ns = document.createElement("span"); ns.className = "lg-sep"; legend.appendChild(ns);
    [["tiangang", "天罡"], ["disa", "地煞"], ["official", "官绅"], ["commoner", "百姓"]]
      .forEach(function (it) {
        var el = document.createElement("div");
        el.className = "lg lg-node n-" + it[0];
        el.innerHTML = "<span class='dot'></span><span>" + it[1] + "</span>";
        legend.appendChild(el);
      });
  })();

  /* ---------------- 工具栏 ---------------- */
  document.getElementById("btn-reset").onclick = function () { graph.resetLayout(); };
  document.getElementById("btn-fit").onclick = function () { graph.fit(); };
  var bL = document.getElementById("btn-labels");
  bL.onclick = function () { graph.showLabels = !graph.showLabels; bL.classList.toggle("on", graph.showLabels); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") clearSelection(); });

  var status = document.getElementById("statusbar");
  function updateStatus() {
    var on = TYPES.filter(function (t) { return graph.typeOn[t]; });
    var cnt = RELS.filter(function (r) { return graph.typeOn[r.y]; }).length;
    status.textContent = CHARS.length + " 人 · " + cnt + " 条关系（" + on.join("") + "）";
  }
  updateStatus();

  /* ---------------- 右侧详情 ---------------- */
  var details = document.getElementById("details");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m];
    });
  }
  function chapLabel(i) { return CHAP[String(i)] || ("第 " + i + " 回"); }

  function welcome() {
    var counts = TYPES.map(function (t) {
      return "<span class='badge' style='background:" + TYPE_COLORS[t] + "'>" + t + "</span>";
    }).join(" ");
    details.innerHTML =
      "<div class='card'><div class='hd'>使用说明</div><div class='bd'>" +
      "<div class='empty-tip'>" +
      "<b>左栏</b>点选人物，<b>中栏</b>拖动／缩放查看关系，<b>点击连线</b>即可读到对应的原著文字。<br>" +
      "箭头的方向表示「行动 → 接受」——谁施恩、谁报恩，谁下手、谁承受。" +
      "<ol>" +
      "<li>节点大小 = 全书出场次数（对数压缩，差异刻意做得细微）</li>" +
      "<li>七种关系各自成色，可用左上角图例开关过滤</li>" +
      "<li>双击节点可将其居中放大</li>" +
      "<li>按 Esc 清除选择</li>" +
      "</ol>" +
      "七类关系：" + counts +
      "</div></div></div>" +
      "<div class='card'><div class='hd'>全书概览</div><div class='bd'>" +
      "<div class='stat'><span>人物 <b>" + CHARS.length + "</b></span>" +
      "<span>关系 <b>" + RELS.length + "</b></span>" +
      "<span>回目 <b>120</b></span></div>" +
      "<div class='note' style='margin-top:8px;font-size:12.5px'>" +
      "出场次数系据全书八十余万字语料逐名统计；关系条目由人工梳理，原文自动摘取，均注明回目。" +
      "</div></div></div>";
  }

  function renderEdge(idx) {
    var r = RELS[idx];
    var a = byId[r.f], b = byId[r.t];
    var col = TYPE_COLORS[r.y];
    details.innerHTML =
      "<div class='card'>" +
      "  <div class='hd'><span class='badge' style='background:" + col + "'>" + r.y + "</span>" +
      "      <span style='font-size:12px;color:#8a8069'>" + esc(TYPE_DESC[r.y]) + "</span></div>" +
      "  <div class='bd'>" +
      "    <div class='rel-arrow'>" +
      "      <span class='who' style='color:" + col + "'>" + esc(a.name) + "</span>" +
      "      <span class='ar' style='color:" + col + "'>—— " + r.y + " →</span>" +
      "      <span class='who' style='color:" + col + "'>" + esc(b.name) + "</span></div>" +
      "    <div class='meta'>行动者：" + esc(a.name) + "　接受者：" + esc(b.name) + "</div>" +
      "    <div class='note'>" + esc(r.n) + "</div>" +
      "  </div></div>" +
      "<div class='card'><div class='hd'>原文摘录</div><div class='bd'>" +
      // 其一：出处回目
      "<div class='chap-bar'>" +
      "  <span class='chap-k'>回目</span>" +
      "  <span class='chap-v'>" + esc(chapLabel(r.c)) + "</span>" +
      "</div>" +
      // 其二：原著正文
      "<div class='quote'>" + esc(r.q || "（原著此回未见二人同场，摘录从略）") + "</div>" +
      "</div></div>";
  }

  function renderNode(id) {
    var c = byId[id];
    if (!c) { welcome(); return; }
    var rel = [];
    RELS.forEach(function (r, i) {
      if (r.f === id || r.t === id) rel.push({ r: r, i: i, out: r.f === id });
    });
    var byType = {};
    rel.forEach(function (x) { (byType[x.r.y] = byType[x.r.y] || []).push(x); });

    var head = "<div class='card'><div class='bd'>" +
      "<div class='person-head'><span class='n'>" + esc(c.name) + "</span>" +
      (c.nick ? "<span class='nk'>" + esc(c.nick) + "</span>" : "") +
      (c.star ? "<span class='nk'>" + esc(c.star) + "</span>" : "") + "</div>" +
      "<div class='stat'><span>出场 <b>" + c.m + "</b> 次</span>" +
      "<span>见于 <b>" + c.cc + "</b> 回</span>" +
      (c.rank ? "<span>座次 <b>" + c.rank + "</b></span>" : "") +
      "<span>关联 <b>" + rel.length + "</b> 条</span></div></div></div>";

    var lists = TYPES.filter(function (t) { return byType[t]; }).map(function (t) {
      var rows = byType[t].sort(function (p, q) { return p.r.c - q.r.c; }).map(function (x) {
        var other = byId[x.out ? x.r.t : x.r.f];
        var dir = x.out ? ("<span class='dir'>" + t + "→</span>") : ("<span class='dir'>←" + t + "</span>");
        return "<li data-edge='" + x.i + "'><span class='ty' style='background:" + TYPE_COLORS[t] + "'>" + t + "</span>" +
          dir + "<span class='who'>" + esc(other.name) + "</span></li>";
      }).join("");
      return "<div class='card'><div class='hd'>" +
        "<span class='badge' style='background:" + TYPE_COLORS[t] + "'>" + t + "</span>" +
        "<span style='font-size:12px;color:#8a8069'>" + TYPE_DESC[t] + "</span>" +
        "<span class='cnt' style='margin-left:auto;font-size:11px;color:#a2947a'>" + byType[t].length + " 条</span>" +
        "</div><div class='bd'><ul class='rel-list'>" + rows + "</ul></div></div>";
    }).join("");

    details.innerHTML = head + (lists || "<div class='card'><div class='bd'><div class='empty-tip'>暂无已收录的关系条目。</div></div></div>");
    Array.prototype.forEach.call(details.querySelectorAll("li[data-edge]"), function (li) {
      li.addEventListener("click", function () { selectEdge(parseInt(li.dataset.edge, 10)); });
    });
  }

  /* ---------------- 选择逻辑 ---------------- */
  function selectNode(id, fromRoster) {
    graph.setFocus(id);
    graph.reheat(0.3);
    if (fromRoster) graph.center(id);
    Object.keys(items).forEach(function (k) { items[k].classList.toggle("active", k === id); });
    renderNode(id);
    var el = items[id];
    if (el && fromRoster) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function selectEdge(idx) {
    graph.focus = null;
    graph.selEdge = idx;
    var r = RELS[idx];
    Object.keys(items).forEach(function (k) { items[k].classList.remove("active"); });
    items[r.f] && items[r.f].classList.add("active");
    items[r.t] && items[r.t].classList.add("active");
    renderEdge(idx);
    // 把两端居中
    var a = graph.node(r.f), b = graph.node(r.t);
    if (a && b) { graph.cam.x = (a.x + b.x) / 2; graph.cam.y = (a.y + b.y) / 2; }
  }

  function clearSelection() {
    graph.focus = null; graph.selEdge = null;
    Object.keys(items).forEach(function (k) { items[k].classList.remove("active"); });
    welcome();
  }

  /* ---------------- 三栏拖拽（分隔条） ---------------- */
  (function initGutters() {
    var app = document.getElementById("app");
    var pane = {
      left: document.getElementById("pane-left"),
      right: document.getElementById("pane-right")
    };
    var MIN = { left: 136, right: 200 };
    var CENTER_MIN = 240;
    var GUTTERS = 18;               // 两条分隔条合计宽度

    function bind(gutter, side) {
      if (!gutter || !pane[side]) return;
      var otherSide = side === "left" ? "right" : "left";

      gutter.addEventListener("pointerdown", function (ev) {
        if (ev.button !== 0) return;
        ev.preventDefault();
        try { gutter.setPointerCapture(ev.pointerId); } catch (e) {}
        var startX = ev.clientX;
        var startW = pane[side].getBoundingClientRect().width;
        document.body.classList.add("resizing");
        gutter.classList.add("active");

        function onMove(e) {
          var d = e.clientX - startX;
          var want = side === "left" ? startW + d : startW - d;
          var otherW = pane[otherSide].getBoundingClientRect().width;
          var upper = app.clientWidth - otherW - CENTER_MIN - GUTTERS;
          if (upper < MIN[side]) upper = MIN[side];
          if (want < MIN[side]) want = MIN[side];
          if (want > upper) want = upper;
          // 以百分比记录，窗口缩放时比例自守
          var pct = Math.round(want / app.clientWidth * 10000) / 100;
          pane[side].style.flex = "0 0 calc(" + pct + "% - 4px)";
          pane[side].style.width = "calc(" + pct + "% - 4px)";
        }

        function onUp() {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onUp);
          document.body.classList.remove("resizing");
          gutter.classList.remove("active");
          window.dispatchEvent(new Event("resize"));   // 令画布重算尺寸
        }

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
      });

      // 双击复原为默认比例
      gutter.addEventListener("dblclick", function () {
        pane[side].style.flex = "";
        pane[side].style.width = "";
        window.dispatchEvent(new Event("resize"));
      });
    }

    bind(document.getElementById("gutter-left"), "left");
    bind(document.getElementById("gutter-right"), "right");
  })();

  /* ---------------- 启动 ---------------- */
  welcome();

  // 供调试
  window.__sh = { graph: graph, chars: CHARS, rels: RELS, chap: CHAP, selectNode: selectNode, selectEdge: selectEdge };
})();
