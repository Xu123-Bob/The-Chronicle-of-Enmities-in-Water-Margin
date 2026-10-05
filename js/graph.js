/* ============================================================
   水浒人物关系图 · 力导向图引擎（零依赖）
   - 自研斥力/弹簧力模拟
   - Canvas 2D 渲染（有向边 + 箭头 + 节点 + 标注）
   - 缩放 / 平移 / 拖动 / 点选 / 悬停
   ============================================================ */
(function () {
  "use strict";

  var TYPE_COLORS = {
    "恩": "#3f9e6a",
    "义": "#2f6fb5",
    "爱": "#d94f70",
    "孝": "#c99a2e",
    "仇": "#7b52c9",
    "杀": "#c0392b",
    "骗": "#8a7f6d"
  };

  var NODE_STYLE = {
    tiangang: { fill: "#f2cd72", stroke: "#a97b16", label: "#6b4a12" },
    disa:     { fill: "#c8835a", stroke: "#8a4f2c", label: "#5b3216" },
    official: { fill: "#9fb6d4", stroke: "#5c7ea8", label: "#2c4a70" },
    commoner: { fill: "#bcc99a", stroke: "#7f9155", label: "#4a5a25" }
  };

  // 星阶：英雄按座次分天罡(1-36)/地煞(37-108)，其余按身份
  function tierOf(c) {
    if (c.group !== "hero") return c.group;
    return (c.rank && c.rank <= 36) ? "tiangang" : "disa";
  }
  SHGraph.tierOf = tierOf;

  function SHGraph(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts || {};
    this.nodes = [];
    this.edges = [];
    this.byId = {};
    this.adj = {};
    this.cam = { x: 0, y: 0, k: 1 };
    this.alpha = 0;
    this.drag = null;
    this.pan = null;
    this.hover = null;
    this.focus = null;       // 高亮的人物 id
    this.selEdge = null;     // 选中的关系索引
    this.showLabels = true;
    this.typeOn = { "恩": 1, "义": 1, "爱": 1, "孝": 1, "仇": 1, "杀": 1, "骗": 1 };
    this.pairCount = {};
    this._bind();
    this._resize();
    var self = this;
    window.addEventListener("resize", function () { self._resize(); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { self._resize(); }).observe(canvas.parentNode);
    }
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  SHGraph.TYPE_COLORS = TYPE_COLORS;

  /* ---------------- 数据 ---------------- */
  SHGraph.prototype.setData = function (chars, rels) {
    var self = this;
    var maxM = 1;
    chars.forEach(function (c) { if (c.m > maxM) maxM = c.m; });
    var logMax = Math.log1p(maxM);
    this.nodes = chars.map(function (c, i) {
      var norm = Math.log1p(c.m) / logMax;
      // 出场次数越多，半径越大；但对数压缩，增幅极小
      var r = 5.5 + 5.0 * norm;
      var ang = (i / chars.length) * Math.PI * 2;
      var rad = 240 * Math.sqrt((i % 7 + 1) / 7) + 40;
      return {
        id: c.id, name: c.name, nick: c.nick, star: c.star, rank: c.rank,
        group: c.group, tier: tierOf(c), m: c.m, cc: c.cc, r: r,
        x: Math.cos(ang) * rad + (Math.random() - .5) * 40,
        y: Math.sin(ang) * rad + (Math.random() - .5) * 40,
        vx: 0, vy: 0, fx: 0, fy: 0, deg: 0
      };
    });
    this.nodes.forEach(function (n, i) { n.i = i; self.byId[n.id] = n; self.adj[n.id] = []; });
    this.edges = rels.map(function (e, i) {
      return { f: e.f, t: e.t, y: e.y, c: e.c, n: e.n, q: e.q, i: i, a: self.byId[e.f], b: self.byId[e.t] };
    });
    this.edges.forEach(function (e) {
      if (!e.a || !e.b) return;
      e.a.deg++; e.b.deg++;
      self.adj[e.f].push({ e: e, other: e.t });
      self.adj[e.t].push({ e: e, other: e.f });
      var k = (e.f < e.t ? e.f + "|" + e.t : e.t + "|" + e.f);
      self.pairCount[k] = (self.pairCount[k] || 0) + 1;
    });
    this.maxDeg = 1;
    this.nodes.forEach(function (n) { if (n.deg > self.maxDeg) self.maxDeg = n.deg; });
    this.reheat(1);
    this._settle(520);   // 预收敛：先把布局跑到近平衡
    this._freeze();      // 再封冻，进入界面时纹丝不动
    this.fit();
  };

  SHGraph.prototype.reheat = function (a) {
    this.alpha = Math.max(this.alpha, a === undefined ? 0.9 : a);
  };

  // 预跑若干步物理，使坐标先行收敛；随后停摆，入场即稳
  SHGraph.prototype._settle = function (steps) {
    for (var s = 0; s < steps; s++) this._step();
  };
  SHGraph.prototype._freeze = function () {
    for (var i = 0; i < this.nodes.length; i++) { this.nodes[i].vx = 0; this.nodes[i].vy = 0; }
    this.alpha = 0;
  };

  /* ---------------- 物理模拟 ---------------- */
  SHGraph.prototype._step = function () {
    var nodes = this.nodes, edges = this.edges, n = nodes.length;
    var REP = 5200, CUT = 260, CUT2 = CUT * CUT;
    var SPRING = 0.012, LEN = 62, GRAV = 0.006;
    var a;

    for (var i = 0; i < n; i++) { nodes[i].fx = 0; nodes[i].fy = 0; }

    for (var i2 = 0; i2 < n; i2++) {
      var A = nodes[i2];
      for (var j = i2 + 1; j < n; j++) {
        var B = nodes[j];
        var dx = B.x - A.x, dy = B.y - A.y;
        var d2 = dx * dx + dy * dy;
        if (d2 > CUT2) continue;
        if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
        var d = Math.sqrt(d2);
        var f = REP / d2;
        var ux = dx / d, uy = dy / d;
        A.fx -= ux * f; A.fy -= uy * f;
        B.fx += ux * f; B.fy += uy * f;
      }
    }
    for (var k = 0; k < edges.length; k++) {
      var e = edges[k]; if (!e.a || !e.b) continue;
      if (!this.typeOn[e.y]) continue;
      var ddx = e.b.x - e.a.x, ddy = e.b.y - e.a.y;
      var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      var force = (dd - LEN) * SPRING;
      var fx = ddx / dd * force, fy = ddy / dd * force;
      e.a.fx += fx; e.a.fy += fy;
      e.b.fx -= fx; e.b.fy -= fy;
    }
    for (var m = 0; m < n; m++) {
      var P = nodes[m];
      P.fx += -P.x * GRAV * 8;
      P.fy += -P.y * GRAV * 8;
    }
    var damp = 0.82;
    for (var q = 0; q < n; q++) {
      var N = nodes[q];
      if (N === this.drag) { N.vx = N.vy = 0; continue; }
      N.vx = (N.vx + N.fx * this.alpha) * damp;
      N.vy = (N.vy + N.fy * this.alpha) * damp;
      N.x += N.vx; N.y += N.vy;
    }
    this.alpha *= 0.982;
    if (this.alpha < 0.011) this.alpha = 0;   // 彻底静止，不留常数微抖
    if (this.drag) this.alpha = Math.max(this.alpha, 0.34);
  };

  /* ---------------- 坐标 ---------------- */
  SHGraph.prototype._resize = function () {
    var c = this.canvas, p = c.parentNode;
    var dpr = window.devicePixelRatio || 1;
    c.width = p.clientWidth * dpr;
    c.height = p.clientHeight * dpr;
    this.W = p.clientWidth; this.H = p.clientHeight;
    this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  SHGraph.prototype.toScreen = function (x, y) {
    return { x: (x - this.cam.x) * this.cam.k + this.W / 2, y: (y - this.cam.y) * this.cam.k + this.H / 2 };
  };
  SHGraph.prototype.toWorld = function (sx, sy) {
    return { x: (sx - this.W / 2) / this.cam.k + this.cam.x, y: (sy - this.H / 2) / this.cam.k + this.cam.y };
  };

  /* ---------------- 渲染 ---------------- */
  SHGraph.prototype._loop = function () {
    var active = this.alpha > 0.011 || this.drag;
    if (active) this._step();
    this._draw();
    requestAnimationFrame(this._loop);
  };

  SHGraph.prototype._draw = function () {
    var ctx = this.ctx, cam = this.cam;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);

    var foc = this.focus;
    var hood = null;
    if (foc) {
      hood = {}; hood[foc] = 1;
      var ad = this.adj[foc] || [];
      for (var i = 0; i < ad.length; i++) hood[ad[i].other] = 1;
    }

    ctx.translate(this.W / 2, this.H / 2);
    ctx.scale(cam.k, cam.k);
    ctx.translate(-cam.x, -cam.y);

    // ---- 边 ----
    var cur = this;
    for (var k = 0; k < this.edges.length; k++) {
      var e = this.edges[k];
      if (!e.a || !e.b || !this.typeOn[e.y]) continue;
      var dim = foc && !(e.f === foc || e.t === foc);
      var isSel = (this.selEdge === k);
      ctx.globalAlpha = isSel ? 1 : (dim ? 0.05 : (foc ? 0.85 : 0.5));
      ctx.strokeStyle = TYPE_COLORS[e.y] || "#888";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = (isSel ? 3.0 : (foc && !dim ? 1.9 : 1.15)) / cam.k;
      this._edge(ctx, e, isSel || (foc && !dim));
    }
    ctx.globalAlpha = 1;

    // ---- 节点 ----
    for (var m = 0; m < this.nodes.length; m++) {
      var N = this.nodes[m];
      var stl = NODE_STYLE[N.tier] || NODE_STYLE.commoner;
      var ndim = foc && !hood[N.id];
      ctx.globalAlpha = ndim ? 0.12 : 1;
      if (N.tier === "tiangang" && !ndim) {          // 天罡：外罩金环，以别地煞
        ctx.beginPath();
        ctx.arc(N.x, N.y, N.r + 3.2, 0, 6.2832);
        ctx.lineWidth = 1.4 / cam.k;
        ctx.strokeStyle = "rgba(184,134,11,.55)";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(N.x, N.y, N.r, 0, 6.2832);
      ctx.fillStyle = stl.fill;
      ctx.fill();
      ctx.lineWidth = (this.hover === N || this.focus === N.id ? 2.6 : 1.2) / cam.k;
      ctx.strokeStyle = (this.hover === N || this.focus === N.id) ? "#9c2b1f" : stl.stroke;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ---- 姓名 ----
    if (this.showLabels) {
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = (11) + "px 'Songti SC','SimSun',serif";
      for (var t = 0; t < this.nodes.length; t++) {
        var L = this.nodes[t];
        var show = foc ? hood[L.id] || L.id === foc
                       : (cam.k >= 0.85 || L.m >= 120 || L === this.hover);
        if (!show) continue;
        var big = (L === this.hover || L.id === this.focus);
        ctx.globalAlpha = (foc && !hood[L.id]) ? 0.12 : 1;
        ctx.font = (big ? 13 : 11) + "px 'Songti SC','SimSun',serif";
        ctx.lineWidth = 3 / 1; ctx.strokeStyle = "rgba(247,242,231,.92)";
        ctx.strokeText(L.name, L.x, L.y + L.r + (L.tier === "tiangang" ? 5.5 : 3) / cam.k);
        ctx.fillStyle = big ? "#9c2b1f" : "#3b3730";
        ctx.fillText(L.name, L.x, L.y + L.r + (L.tier === "tiangang" ? 5.5 : 3) / cam.k);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  // 绘制一条有向边（含箭头）
  SHGraph.prototype._edge = function (ctx, e, strong) {
    var a = e.a, b = e.b;
    var dx = b.x - a.x, dy = b.y - a.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / d, uy = dy / d;
    var ra = a.r + 1, rb = b.r + 4;
    var x1 = a.x + ux * ra, y1 = a.y + uy * ra;
    var x2 = b.x - ux * rb, y2 = b.y - uy * rb;

    // 双向边做弧线偏移
    var key = (e.f < e.t ? e.f + "|" + e.t : e.t + "|" + e.f);
    var dup = this.pairCount[key] > 1;
    var nx = 0, ny = 0, bow = 0;
    if (dup) {
      // 用 id 排序决定上下弓形，保证一去一回分开
      var sgn = (e.f < e.t) ? 1 : -1;
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      // 垂直方向
      nx = -uy * sgn; ny = ux * sgn;
      bow = 0.16;
      var cx = mx + nx * d * bow, cy = my + ny * d * bow;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
      this._arrow(ctx, cx, cy, x2, y2, strong);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    this._arrow(ctx, x1, y1, x2, y2, strong);
  };

  SHGraph.prototype._arrow = function (ctx, x1, y1, x2, y2, strong) {
    var ang = Math.atan2(y2 - y1, x2 - x1);
    var s = (strong ? 9 : 7) / this.cam.k;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(ang - 0.38), y2 - s * Math.sin(ang - 0.38));
    ctx.lineTo(x2 - s * Math.cos(ang + 0.38), y2 - s * Math.sin(ang + 0.38));
    ctx.closePath();
    ctx.fill();
  };

  /* ---------------- 交互 ---------------- */
  SHGraph.prototype._pos = function (ev) {
    var r = this.canvas.getBoundingClientRect();
    var sx = ev.clientX - r.left, sy = ev.clientY - r.top;
    return { s: { x: sx, y: sy }, w: this.toWorld(sx, sy) };
  };
  SHGraph.prototype._hitNode = function (w) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.nodes.length; i++) {
      var n = this.nodes[i];
      var dx = n.x - w.x, dy = n.y - w.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < Math.max(n.r + 4, 10) && d < bd) { bd = d; best = n; }
    }
    return best;
  };
  SHGraph.prototype._hitEdge = function (w) {
    var best = null, bd = 1e9, tol = 7 / this.cam.k;
    for (var i = 0; i < this.edges.length; i++) {
      var e = this.edges[i];
      if (!this.typeOn[e.y] || !e.a || !e.b) continue;
      var d = segDist(w.x, w.y, e.a.x, e.a.y, e.b.x, e.b.y);
      if (d < tol && d < bd) { bd = d; best = i; }
    }
    return best;
  };
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var L2 = dx * dx + dy * dy;
    var t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    var qx = x1 + t * dx, qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  SHGraph.prototype._bind = function () {
    var self = this, cv = this.canvas;
    var moved = false;

    cv.addEventListener("mousedown", function (ev) {
      var p = self._pos(ev), n = self._hitNode(p.w);
      moved = false;
      self._down = { x: ev.clientX, y: ev.clientY };
      if (n) { self.drag = n; self.reheat(0.45); }
      else { self.pan = { x: ev.clientX, y: ev.clientY, cx: self.cam.x, cy: self.cam.y }; cv.classList.add("dragging"); }
    });
    window.addEventListener("mousemove", function (ev) {
      if ((self.drag || self.pan) && self._down && !moved) {
        var ddx = ev.clientX - self._down.x, ddy = ev.clientY - self._down.y;
        if (ddx * ddx + ddy * ddy > 25) moved = true;   // 4~5px 阈值，避免点选被抖动吞掉
      }
      if (self.drag) {
        var r = cv.getBoundingClientRect();
        var w = self.toWorld(ev.clientX - r.left, ev.clientY - r.top);
        self.drag.x = w.x; self.drag.y = w.y; self.alpha = Math.max(self.alpha, 0.30);
        return;
      }
      if (self.pan) {
        self.cam.x = self.pan.cx - (ev.clientX - self.pan.x) / self.cam.k;
        self.cam.y = self.pan.cy - (ev.clientY - self.pan.y) / self.cam.k;
        return;
      }
      var r2 = cv.getBoundingClientRect();
      if (ev.clientX < r2.left || ev.clientX > r2.right || ev.clientY < r2.top || ev.clientY > r2.bottom) {
        self.hover = null; self._tip(null); return;
      }
      var p = self._pos(ev), n = self._hitNode(p.w);
      self.hover = n;
      self._tip(n ? { x: ev.clientX - r2.left, y: ev.clientY - r2.top, n: n } : null);
    });
    window.addEventListener("mouseup", function (ev) {
      self._down = null;
      if (self.drag) {
        var n = self.drag; self.drag = null;
        if (!moved && self.opts.onNode) self.opts.onNode(n.id);
      } else if (self.pan) {
        self.pan = null; cv.classList.remove("dragging");
        if (!moved) {
          var p = self._pos(ev), ei = self._hitEdge(p.w);
          if (ei != null) { if (self.opts.onEdge) self.opts.onEdge(ei); }
          else if (self.opts.onBlank) self.opts.onBlank();
        }
      }
    });
    cv.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var r = cv.getBoundingClientRect();
      var sx = ev.clientX - r.left, sy = ev.clientY - r.top;
      var before = self.toWorld(sx, sy);
      var f = Math.exp(-ev.deltaY * 0.0014);
      self.cam.k = Math.max(0.18, Math.min(4.5, self.cam.k * f));
      var after = self.toWorld(sx, sy);
      self.cam.x += before.x - after.x;
      self.cam.y += before.y - after.y;
    }, { passive: false });
    cv.addEventListener("dblclick", function (ev) {
      var p = self._pos(ev), n = self._hitNode(p.w);
      if (n) self.center(n.id);
    });
  };

  SHGraph.prototype._tip = function (t) {
    var el = document.getElementById("tooltip");
    if (!t) { el.style.display = "none"; return; }
    var n = t.n;
    el.style.display = "block";
    el.innerHTML = (n.tier === "tiangang" ? "<span class='tg-badge'>天罡</span> "
                  : n.tier === "disa" ? "<span class='ds-badge'>地煞</span> " : "") +
      "<b>" + n.name + "</b>" +
      (n.nick ? " <span class='tk'>" + n.nick + "</span>" : "") +
      "<br>出场 " + n.m + " 次 · 见于 " + n.cc + " 回" +
      (n.star ? "<br>" + n.star + (n.rank ? " · 第 " + n.rank + " 位" : "") : "") +
      "<br><span class='tk'>关联 " + n.deg + " 条</span>";
    var w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.min(t.x + 16, this.W - w - 8) + "px";
    el.style.top = Math.max(8, Math.min(t.y - h - 12, this.H - h - 8)) + "px";
  };

  /* ---------------- 视图控制 ---------------- */
  SHGraph.prototype.center = function (id, k) {
    var n = this.byId[id]; if (!n) return;
    this.cam.x = n.x; this.cam.y = n.y;
    if (k) this.cam.k = k;
    else this.cam.k = Math.max(this.cam.k, 1.25);
  };
  SHGraph.prototype.fit = function () {
    var xs = this.nodes.map(function (n) { return n.x; }),
        ys = this.nodes.map(function (n) { return n.y; });
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
    var miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    this.cam.x = (minx + maxx) / 2;
    this.cam.y = (miny + maxy) / 2;
    var kx = this.W / (maxx - minx + 160), ky = this.H / (maxy - miny + 160);
    this.cam.k = Math.max(0.18, Math.min(1.6, Math.min(kx, ky)));
  };
  SHGraph.prototype.resetLayout = function () {
    var n = this.nodes.length;
    this.nodes.forEach(function (N, i) {
      var ang = (i / n) * Math.PI * 2;
      var rad = 60 + 300 * ((i % 9) / 9);
      N.x = Math.cos(ang) * rad + (Math.random() - .5) * 30;
      N.y = Math.sin(ang) * rad + (Math.random() - .5) * 30;
      N.vx = N.vy = 0;
    });
    this._settle(420);
    this._freeze();
    this.reheat(0.32);   // 只余一丝回弹，不再乱冲
  };
  SHGraph.prototype.setFocus = function (id) {
    this.focus = id; this.selEdge = null;
  };
  SHGraph.prototype.setEdge = function (idx) {
    this.selEdge = idx;
    var e = this.edges[idx];
    this.focus = e ? null : this.focus;
  };
  SHGraph.prototype.setType = function (t, on) { this.typeOn[t] = on ? 1 : 0; this.reheat(0.34); };
  SHGraph.prototype.node = function (id) { return this.byId[id]; };

  window.SHGraph = SHGraph;
})();
