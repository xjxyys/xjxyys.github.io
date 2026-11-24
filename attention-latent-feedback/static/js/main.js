(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function renderMath() {
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false
    });
    // Browsers may break a line between an inline formula and the punctuation next to it (a word joiner does not
    // prevent it after KaTeX's inline blocks), so formula and punctuation share an unbreakable span.
    document.querySelectorAll(".katex").forEach(function (math) {
      if (math.closest(".katex-display")) return;
      // Auto-render wraps every formula in a plain span.
      var unit = math.parentNode.childNodes.length === 1 ? math.parentNode : math;
      var before = unit.previousSibling, after = unit.nextSibling;
      var open = before && before.nodeType === 3 ? before.nodeValue.match(/[(\[]$/) : null;
      var close = after && after.nodeType === 3 ? after.nodeValue.match(/^[,.;:!?)\]]+/) : null;
      if (!open && !close) return;
      var glue = document.createElement("span");
      glue.className = "nowrap";
      unit.parentNode.insertBefore(glue, unit);
      if (open) {
        before.nodeValue = before.nodeValue.slice(0, -1);
        glue.appendChild(document.createTextNode(open[0]));
      }
      glue.appendChild(unit);
      if (close) {
        after.nodeValue = after.nodeValue.slice(close[0].length);
        glue.appendChild(document.createTextNode(close[0]));
      }
    });
  }

  function initNav() {
    var nav = document.querySelector(".topnav");
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 160); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (!("IntersectionObserver" in window)) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll(".navlinks a"));
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);
    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var current = null;
      sections.forEach(function (s) { if (!current && visible[s.id]) current = s; });
      links.forEach(function (a) {
        a.classList.toggle("active", !!current && a.getAttribute("href") === "#" + current.id);
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach(function (s) { observer.observe(s); });
  }

  function initLightbox() {
    var box = document.getElementById("lightbox");
    if (!box) return;
    var img = box.querySelector("img");
    function close() {
      box.hidden = true;
      img.removeAttribute("src");
    }
    document.querySelectorAll("img[data-zoom]").forEach(function (el) {
      el.addEventListener("click", function () {
        img.src = el.currentSrc || el.src;
        img.alt = el.alt;
        box.hidden = false;
      });
    });
    box.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !box.hidden) close();
    });
  }

  function initCopy() {
    document.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var text = document.getElementById(btn.getAttribute("data-copy-target")).innerText;
        var done = function () {
          btn.textContent = "Copied";
          btn.classList.add("done");
          setTimeout(function () {
            btn.textContent = "Copy";
            btn.classList.remove("done");
          }, 1600);
        };
        var fallback = function () {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch (err) { /* ignore */ }
          ta.remove();
          done();
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Residual-flow animation: one decoding step of a three-block model (six sublayers) under three architectures.
  // The picture at any time is a pure function of the clock, so pausing, replaying and switching modes stay simple.
  // ---------------------------------------------------------------------------------------------------------------
  function initFlow() {
    var svg = document.getElementById("flow-svg");
    if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    var N = 6;                                   // sublayers: attention and feed-forward of three blocks
    var LX = 150, LSP = 60, RX = 750, RSP = 850; // block centres and residual spines of positions t-1 and t
    var BW = 120, BH = 34, ZY = 76, BOT = 596;
    var CHIP = 246, ATT = 600;
    function rowY(i) { return 510 - 62 * i; }
    function name(i) { return i === 0 ? "Embedding" : (i % 2 ? "Attention " : "Feed-forward ") + Math.ceil(i / 2); }
    function lname(i) { return (i % 2 ? "Attention" : "The feed-forward sublayer") + " of block " + Math.ceil(i / 2); }

    // Illustrative depth weights: most weight on a sublayer's own depth and the next few above it.
    function weights(l) {
      var w = [], s = 0, i;
      for (i = l; i <= N; i++) { w[i] = Math.exp(-(i - l) / 1.1) + (i === N ? 0.12 : 0); s += w[i]; }
      for (i = l; i <= N; i++) w[i] /= s;
      return w;
    }
    // Illustrative attention-residual weights over the earlier outputs of the same token: recent outputs and the
    // embedding weigh most.
    function alphas(l) {
      var w = [], s = 0, i;
      for (i = 0; i < l; i++) { w[i] = Math.exp(-(l - 1 - i) / 1.3) + (i === 0 ? 0.35 : 0); s += w[i]; }
      for (i = 0; i < l; i++) w[i] /= s;
      return w;
    }

    function make(tag, attrs, parent) {
      var el = document.createElementNS(NS, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(el);
      return el;
    }
    function text(parent, x, y, str, cls) {
      var t = make("text", { x: x, y: y }, parent);
      if (cls) t.setAttribute("class", cls);
      t.textContent = str;
      return t;
    }
    // Italic symbol with a subscript, e.g. z_{t-1}.
    function sym(parent, x, y, base, sub) {
      var t = make("text", { x: x, y: y }, parent);
      t.appendChild(document.createTextNode(base));
      var s = make("tspan", { dy: 4, "font-size": "0.78em" }, t);
      s.textContent = sub;
      return t;
    }

    var root = make("g", { transform: "translate(60,0)" }, svg);
    var gWires = make("g", {}, root), gInk = make("g", {}, root), gParts = make("g", {}, root), gHeads = make("g", {}, root);
    var geo = {};       // named path geometry
    var parts = {};     // named elements that light up
    var only = [];      // [element, modes, backbones]: shown only in those feedback modes and backbones
    var spines = [];    // spine segments, drawn as a dashed bus of outputs on attention residuals

    function wire(key, d, cls, modes, backbones) {
      geo[key] = d;
      var p = make("path", { d: d, "class": "wire" + (cls ? " " + cls : "") }, gWires);
      if (modes || backbones) only.push([p, modes, backbones]);
      return p;
    }
    function block(key, cx, y, label) {
      var g = make("g", { "class": "blk" }, gParts);
      make("rect", { x: cx - BW / 2, y: y - BH / 2, width: BW, height: BH, rx: 8 }, g);
      text(g, cx, y, label);
      parts[key] = g;
      return g;
    }

    // Column titles.
    text(root, LX + 40, 26, "position t − 1", "col-title").setAttribute("text-anchor", "middle");
    text(root, LX + 40, 44, "already decoded, states cached", "col-sub").setAttribute("text-anchor", "middle");
    text(root, RX + 40, 26, "position t", "col-title").setAttribute("text-anchor", "middle");
    text(root, RX + 40, 44, "being decoded now", "col-sub").setAttribute("text-anchor", "middle");

    var i, l, y;
    // Self-attention at the same depth (attention sublayers only), drawn under everything else.
    for (l = 1; l <= N; l += 2) {
      y = rowY(l);
      wire("sa" + l, "M" + (LX + BW / 2) + "," + y + " H" + (RX - BW / 2), "sa");
    }
    var saTag = text(root, 470, rowY(1) - 8, "self-attention sees only the same depth", "tag");
    saTag.setAttribute("text-anchor", "middle");
    only.push([saTag, "std fbt"]);

    // Residual spines and sublayer wiring of both positions.
    wire("Lemb", "M" + (LX - BW / 2) + "," + rowY(0) + " H" + LSP);
    wire("Remb", "M" + (RX + BW / 2) + "," + rowY(0) + " H" + RSP);
    for (i = 1; i <= N; i++) {
      y = rowY(i);
      spines.push(wire("Lsp" + i, "M" + LSP + "," + rowY(i - 1) + " V" + y));
      spines.push(wire("Rsp" + i, "M" + RSP + "," + rowY(i - 1) + " V" + y));
      wire("Lin" + i, "M" + LSP + "," + (y + 31) + " H" + LX + " V" + (y + BH / 2));
      wire("Lout" + i, "M" + (LX - BW / 2) + "," + y + " H" + LSP);
      wire("Rin" + i, "M" + RSP + "," + (y + 31) + " H" + RX + " V" + (y + BH / 2));
      geo["RinA" + i] = "M" + RSP + "," + (y + 31) + " H" + (RX + 9);
      geo["Rmix" + i] = "M" + RX + "," + (y + 22) + " V" + (y + BH / 2);
      wire("Rout" + i, "M" + (RX + BW / 2) + "," + y + " H" + RSP);
      wire("Lchip" + i, "M" + (LX + BW / 2) + "," + y + " H" + (CHIP - 17), "", "alf");
      wire("att" + i, "M" + (ATT + 17) + "," + (y + 31) + " H" + (RX - 9), "", "alf");
    }
    // The spines end in the final states from below, leaving the left edge of z_{t-1} free for the injection.
    wire("Ltop", "M" + LSP + "," + rowY(N) + " V104 H" + LX + " V" + (ZY + 13));
    wire("Rtop", "M" + RSP + "," + rowY(N) + " V104 H" + RX + " V" + (ZY + 13));
    // Input injection (ALF) or gated replacement (FBT): from z_{t-1} around the left edge to the embedding of t.
    wire("injA", "M" + (LX - 30) + "," + ZY + " H-38 V" + BOT + " H530", "", "alf fbt");
    wire("injB", "M530," + BOT + " H830 V" + (rowY(0) + 9), "", "alf fbt");

    // Attention residual: arcs outside each spine from every earlier output of the same token to the reader's alpha node.
    var taps = [];
    [["L", LSP, -1], ["R", RSP, 1]].forEach(function (col) {
      var S = col[1], dir = col[2];
      for (l = 1; l <= N; l++) {
        var yr = rowY(l) + 31;
        for (i = 0; i < l; i++) {
          var yi = rowY(i), b = 12 + 8 * (l - 1 - i);
          var d = "M" + S + "," + yi + " C" + (S + dir * b) + "," + yi + " " + (S + dir * b) + "," + yr + " " + S + "," + yr;
          geo[col[0] + "ar" + i + "_" + l] = d;
          var p = make("path", { d: d, "class": "arwire", "stroke-width": (0.7 + 3 * alphas(l)[i]).toFixed(2) }, gWires);
          only.push([p, null, "attn"]);
        }
      }
      for (i = 0; i <= N; i++) {
        var tap = make("circle", { cx: S, cy: rowY(i), r: 3, "class": "tap" }, gParts);
        only.push([tap, null, "attn"]);
      }
    });

    // Feedback curves from each cached output to each eligible reader.
    var fbWires = {};
    for (l = 1; l <= N; l++) {
      var w = weights(l);
      for (i = l; i <= N; i++) {
        var y0 = rowY(i), y1 = rowY(l) + 31;
        var d = "M" + (CHIP + 17) + "," + y0 + " C420," + y0 + " 450," + y1 + " " + (ATT - 17) + "," + y1;
        geo["fb" + i + "_" + l] = d;
        var p = make("path", { d: d, "class": "fbwire", "stroke-width": (0.8 + 4 * w[i]).toFixed(2) }, gWires);
        only.push([p, "alf"]);
        fbWires[i + "_" + l] = w[i];
      }
    }

    // Blocks, cached outputs, depth-attention and mixing nodes.
    for (i = 0; i <= N; i++) {
      block("L" + i, LX, rowY(i), name(i));
      block("R" + i, RX, rowY(i), name(i));
    }
    for (i = 1; i <= N; i++) {
      y = rowY(i);
      var c = make("g", { "class": "chip" }, gParts);
      make("rect", { x: CHIP - 17, y: y - 11, width: 34, height: 22, rx: 6 }, c);
      sym(c, CHIP - 3, y - 1, "v", String(i));
      parts["chip" + i] = c; only.push([c, "alf"]);

      var a = make("g", { "class": "node att" }, gParts);
      make("rect", { x: ATT - 17, y: y + 21, width: 34, height: 20, rx: 6 }, a);
      text(a, ATT, y + 31, "β");
      parts["att" + i] = a; only.push([a, "alf"]);

      var m = make("g", { "class": "node mixn" }, gParts);
      make("circle", { cx: RX, cy: y + 31, r: 9 }, m);
      text(m, RX, y + 31.5, "+");
      parts["mix" + i] = m; only.push([m, "alf"]);

      ["L", "R"].forEach(function (c, k) {
        var g = make("g", { "class": "node alpha" }, gParts);
        make("circle", { cx: k ? RSP : LSP, cy: y + 31, r: 8 }, g);
        text(g, k ? RSP : LSP, y + 30.5, "α");
        parts[c + "al" + i] = g; only.push([g, null, "attn"]);
      });
    }
    var cacheTag = text(root, CHIP, rowY(N) - 24, "cached", "tag o");
    cacheTag.setAttribute("text-anchor", "middle"); only.push([cacheTag, "alf"]);
    var attTag = text(root, ATT, rowY(N) + 6, "attention over depth", "tag o");
    attTag.setAttribute("text-anchor", "middle"); only.push([attTag, "alf"]);

    function zchip(key, cx, sub) {
      var g = make("g", { "class": "zchip" }, gParts);
      make("rect", { x: cx - 30, y: ZY - 13, width: 60, height: 26, rx: 7 }, g);
      sym(g, cx - 6, ZY - 1, "z", sub);
      parts[key] = g;
    }
    zchip("zL", LX, "t−1");
    zchip("zR", RX, "t");
    text(root, RX + 38, ZY + 4, "→ token t + 1", "tag").setAttribute("text-anchor", "start");

    var we = make("g", { "class": "node inj" }, gParts);
    make("rect", { x: 530, y: BOT - 13, width: 60, height: 26, rx: 7 }, we);
    sym(we, 554, BOT - 1, "W", "E");
    parts.we = we; only.push([we, "alf"]);
    var injTag = text(root, 400, BOT - 8, "", "tag o");
    injTag.setAttribute("text-anchor", "middle");
    only.push([injTag, "alf fbt"]);

    var join = make("g", { "class": "node inj" }, gParts);
    make("circle", { cx: 830, cy: rowY(0), r: 9 }, join);
    var joinText = text(join, 830, rowY(0) + 0.5, "+");
    parts.join = join; only.push([join, "alf fbt"]);

    var heads = [];
    function head(i) {
      while (heads.length <= i) heads.push(make("circle", { r: 4.5, "class": "head" }, gHeads));
      return heads[i];
    }

    // ------------------------------------------------------------------ timelines
    var events, lits, captions, total, mode = "alf", backbone = "std";

    function build(m, bb) {
      mode = m; backbone = bb;
      var attn = bb === "attn";
      events = []; lits = []; captions = [];
      while (gInk.firstChild) gInk.removeChild(gInk.firstChild);
      only.forEach(function (o) {
        var hide = (o[1] && o[1].split(" ").indexOf(m) < 0) || (o[2] && o[2] !== bb);
        o[0].classList.toggle("off", !!hide);
      });
      spines.forEach(function (p) { p.classList.toggle("bus", attn); });
      saTag.classList.toggle("off", m === "alf");
      injTag.textContent = m === "alf" ? "input injection" : "gated replacement";
      joinText.textContent = m === "alf" ? "+" : "g";

      function draw(key, t0, t1, cls, opts) {
        opts = opts || {};
        var p = make("path", { d: geo[key], "class": "ink " + cls }, gInk);
        if (opts.width) p.setAttribute("stroke-width", opts.width);
        var len = p.getTotalLength();
        p.style.strokeDasharray = len + " " + len;
        events.push({ p: p, len: len, t0: t0, t1: t1, cls: cls, fadeAt: opts.fadeAt, fadeTo: opts.fadeTo });
      }
      function lit(key, t0, cls, t1) { lits.push({ el: parts[key], t0: t0, t1: t1, cls: cls || "lit" }); }
      function say(t0, step, msg) { captions.push({ t0: t0, step: step, msg: msg }); }
      // How sublayer l of column c (L or R) gathers its current stream: a running sum, or attention over depth.
      function gather(c, l, t0, t1, fadeAt) {
        if (!attn) { draw(c + "sp" + l, t0, t1, "cur"); return; }
        var a = alphas(l);
        for (var j = 0; j < l; j++) {
          draw(c + "ar" + j + "_" + l, t0, t1, "cur", { width: (1 + 5 * a[j]).toFixed(2), fadeAt: fadeAt, fadeTo: 0.12 + 0.35 * a[j] });
        }
        lit(c + "al" + l, t1);
      }

      // A. Position t-1, bottom to top.
      lit("L0", 0);
      draw("Lemb", 0.1, 0.35, "cur");
      say(0, "Token t − 1", "The previous token runs bottom to top. " + (attn
        ? "On attention residuals, each sublayer reads a softmax mixture (α) over the earlier outputs of its own token instead of their plain sum."
        : "Each sublayer reads the residual stream and adds its output back to it.") +
        (m === "alf" ? " ALF also caches every sublayer output v." : ""));
      for (i = 1; i <= N; i++) {
        var s = 0.4 + 0.5 * (i - 1);
        gather("L", i, s, attn ? s + 0.2 : s + 0.15, s + 0.5);
        draw("Lin" + i, s + 0.1, s + 0.3, "cur");
        lit("L" + i, s + 0.3); lit("L" + i, s + 0.3, "flash", s + 0.5);
        draw("Lout" + i, s + 0.3, s + 0.45, "cur");
        if (m === "alf") { draw("Lchip" + i, s + 0.3, s + 0.45, "fb"); lit("chip" + i, s + 0.45); }
      }
      draw("Ltop", 3.4, 3.7, "cur");
      lit("zL", 3.7);

      // B. The final state of t-1 enters the bottom of position t.
      var c0 = 3.9;
      if (m !== "std") {
        say(3.8, m === "alf" ? "Injection" : "Final state",
          m === "alf"
            ? "Input injection: the final state z of token t − 1 passes through Wₑ and is added to the embedding of token t."
            : "FBT gates the final state z of token t − 1 into the embedding of token t. This is its only route from the previous token's deep layers to the new one.");
        draw("injA", 3.8, 4.8, "fb");
        if (m === "alf") lit("we", 4.8);
        draw("injB", 4.8, 5.4, "fb");
        lit("join", 5.4);
        c0 = 5.5;
      }
      lit("R0", c0);
      draw("Remb", c0, c0 + 0.25, m === "std" ? "cur" : "mix");

      // C. Position t, bottom to top.
      var dur = m === "alf" ? 1.15 : 0.6;
      for (l = 1; l <= N; l++) {
        var s2 = c0 + 0.3 + dur * (l - 1);
        if (m === "alf") {
          var w = weights(l);
          for (i = l; i <= N; i++) {
            draw("fb" + i + "_" + l, s2, s2 + 0.45, "fb", { width: (1.2 + 7 * w[i]).toFixed(2), fadeAt: s2 + dur, fadeTo: 0.18 + 0.5 * w[i] });
          }
          lit("att" + l, s2 + 0.45);
          draw("att" + l, s2 + 0.45, s2 + 0.65, "fb");
          gather("R", l, s2 + 0.1, s2 + 0.4, s2 + dur);
          draw("RinA" + l, s2 + 0.4, s2 + 0.65, "cur");
          lit("mix" + l, s2 + 0.65);
          draw("Rmix" + l, s2 + 0.65, s2 + 0.75, "mix");
          lit("R" + l, s2 + 0.75); lit("R" + l, s2 + 0.75, "flash", s2 + 0.95);
          draw("Rout" + l, s2 + 0.75, s2 + 0.95, "cur");
          say(s2, "Sublayer " + l, lname(l) + " at token t attends over the cached outputs of token t − 1 from its own depth upward (" +
            (l === N ? "depth " + N : "depths " + l + "–" + N) + "), weighted by β, and mixes them into its " +
            (attn ? "α-mixture of its own token's earlier outputs" : "input") + " at a learned share ρ.");
        } else {
          if (l % 2) draw("sa" + l, s2, s2 + 0.25, "sa", { fadeAt: s2 + dur, fadeTo: 0.35 });
          gather("R", l, attn ? s2 : s2 + 0.1, s2 + 0.25, s2 + dur);
          draw("Rin" + l, s2 + 0.25, s2 + 0.4, "cur");
          lit("R" + l, s2 + 0.4); lit("R" + l, s2 + 0.4, "flash", s2 + 0.6);
          draw("Rout" + l, s2 + 0.4, s2 + 0.55, "cur");
          say(s2, "Sublayer " + l, lname(l) + " at token t " +
            (attn ? "attends over the earlier outputs of its own token (α). " : "computes from its own residual stream. ") +
            (l % 2 ? "Its self-attention sees token t − 1 only at this same depth."
                   : "The deeper outputs of token t − 1 stay out of its reach."));
        }
      }
      var e = c0 + 0.3 + dur * N;
      draw("Rtop", e, e + 0.3, "cur");
      lit("zR", e + 0.3);
      say(e, "Done", m === "alf"
        ? "Token t is done. Its sublayer outputs and final state become the feedback for token t + 1, so decoding stays one pass per token."
        : m === "fbt"
          ? "Token t is done. Only its final state will reach token t + 1, and only at the embedding."
          : "Token t is done. The shallow layers of token t + 1 will again see earlier tokens only at their own depth.");
      total = e + 2.6;
    }

    var progress = document.getElementById("flow-progress");
    var stepEl = document.getElementById("flow-step");
    var textEl = document.getElementById("flow-text");
    var lastCaption = null;

    function render(t) {
      var used = 0;
      events.forEach(function (ev) {
        var p = Math.max(0, Math.min(1, (t - ev.t0) / (ev.t1 - ev.t0)));
        ev.p.style.strokeDashoffset = ev.len * (1 - p);
        ev.p.style.opacity = p <= 0 ? 0 : (ev.fadeAt !== undefined && t >= ev.fadeAt ? ev.fadeTo : 1);
        if (p > 0 && p < 1) {
          var pt = ev.p.getPointAtLength(ev.len * p);
          var h = head(used++);
          h.setAttribute("cx", pt.x); h.setAttribute("cy", pt.y);
          h.setAttribute("class", "head " + ev.cls);
          h.style.display = "";
        }
      });
      for (var k = used; k < heads.length; k++) heads[k].style.display = "none";
      var on = {};
      lits.forEach(function (x) {
        var key = x.cls;
        var active = t >= x.t0 && (x.t1 === undefined || t < x.t1);
        if (!on[key]) on[key] = [];
        if (active) on[key].push(x.el);
      });
      Object.keys(parts).forEach(function (k) {
        var el = parts[k];
        el.classList.toggle("lit", (on.lit || []).indexOf(el) >= 0);
        el.classList.toggle("flash", (on.flash || []).indexOf(el) >= 0);
      });
      var cap = captions[0];
      captions.forEach(function (c) { if (t >= c.t0) cap = c; });
      if (cap !== lastCaption) {
        lastCaption = cap;
        stepEl.textContent = cap.step;
        textEl.textContent = cap.msg;
      }
      progress.style.width = (100 * Math.min(1, t / total)) + "%";
      follow(t);
    }

    // On narrow screens the diagram scrolls sideways; until the reader scrolls it, keep the active position in view.
    var stage = svg.parentNode, userScrolled = false;
    ["pointerdown", "touchstart", "wheel"].forEach(function (ev) {
      stage.addEventListener(ev, function () { userScrolled = true; }, { passive: true });
    });
    function follow(t) {
      var max = stage.scrollWidth - stage.clientWidth;
      if (userScrolled || max <= 0) return;
      var target = t < 3.7 ? 0 : max;   // position t - 1 finishes at 3.7 s in every mode
      stage.scrollLeft += (target - stage.scrollLeft) * 0.12;
    }

    // ------------------------------------------------------------------ playback
    var clock = 0, playing = !reduceMotion, visible = true, last = null, raf = null;
    var toggle = document.getElementById("flow-toggle");
    function setPlaying(v) {
      playing = v;
      toggle.querySelector(".i-pause").toggleAttribute("hidden", !v);
      toggle.querySelector(".i-play").toggleAttribute("hidden", v);
      toggle.querySelector("span").textContent = v ? "Pause" : "Play";
      kick();
    }
    function frame(now) {
      raf = null;
      if (!playing || !visible) { last = null; return; }
      if (last !== null) clock += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (clock > total) clock = 0;
      render(clock);
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (playing && visible && raf === null) raf = requestAnimationFrame(frame); }

    var modeButtons = Array.prototype.slice.call(document.querySelectorAll("#flow-demo [data-mode]"));
    var bbButtons = Array.prototype.slice.call(document.querySelectorAll("#flow-demo [data-backbone]"));
    function choose(m, bb) {
      modeButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === m)); });
      bbButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-backbone") === bb)); });
      build(m, bb);
      lastCaption = null;
      // Without motion, show the finished step; the reader can still press Play.
      clock = reduceMotion && !playing ? total - 2.6 : 0;
      render(clock);
      kick();
    }
    modeButtons.forEach(function (b) {
      b.addEventListener("click", function () {
        choose(b.getAttribute("data-mode"), backbone);
        if (!reduceMotion) setPlaying(true);
      });
    });
    bbButtons.forEach(function (b) {
      b.addEventListener("click", function () {
        choose(mode, b.getAttribute("data-backbone"));
        if (!reduceMotion) setPlaying(true);
      });
    });
    // Seek from the console: document.getElementById("flow-svg").seek(seconds).
    svg.seek = function (t) { setPlaying(false); clock = t; render(t); };
    toggle.addEventListener("click", function () {
      if (!playing && clock >= total - 2.6) clock = 0;
      setPlaying(!playing);
    });
    document.getElementById("flow-restart").addEventListener("click", function () {
      clock = 0; render(0); setPlaying(true);
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        kick();
      }).observe(svg);
    }
    setPlaying(playing);
    choose("alf", "std");
  }

  renderMath();
  initNav();
  initLightbox();
  initCopy();
  initFlow();
})();
