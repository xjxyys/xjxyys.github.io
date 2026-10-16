(function () {
  "use strict";

  // c, p, q: fitted looping coefficients; rec: N_rec / N of the 240M model.
  var LAW = { c: 1.11198, p: 0.23677, q: 1.02181, rec: 0.507 };

  function g(T, B) {
    return Math.exp(LAW.c * (1 - Math.pow(T, -LAW.p) * Math.pow(B, -LAW.q)));
  }
  function effectiveSize(T, B) {
    return 1 + (g(T, B) - 1) * LAW.rec;
  }
  function computeSize(T, B) {
    return 1 - LAW.rec + ((T + 2 * B) / 3) * LAW.rec;
  }
  function computePerEffective(T, B) {
    return computeSize(T, B) / effectiveSize(T, B);
  }

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

  function initTabs() {
    document.querySelectorAll(".figtabs").forEach(function (group) {
      var tabs = Array.prototype.slice.call(group.querySelectorAll('[role="tab"]'));
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.tabIndex = on ? 0 : -1;
          document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
        });
        if (focus) tab.focus();
      }
      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { select(tab, false); });
        tab.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          var step = e.key === "ArrowRight" ? 1 : tabs.length - 1;
          select(tabs[(i + step) % tabs.length], true);
          e.preventDefault();
        });
      });
    });
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

  function initExplorer() {
    var root = document.getElementById("explorer");
    if (!root) return;
    var tIn = document.getElementById("ex-T");
    var bIn = document.getElementById("ex-B");
    var tOut = document.getElementById("ex-T-out");
    var bOut = document.getElementById("ex-B-out");
    var diagram = document.getElementById("ex-diagram");
    var apply = document.getElementById("ex-apply");
    var presets = Array.prototype.slice.call(root.querySelectorAll(".ex-presets button"));

    var el = function (id) { return document.getElementById(id); };
    var two = function (x) { return x.toFixed(2); };
    var loopCount = function (x) { return Number.isInteger(x) ? String(x) : x.toFixed(2); };
    var pair = function (T, B) { return "(" + T + ", " + B + ")"; };

    var parts = null;
    var timer = null;
    var running = false;
    var applyTarget = null;

    function setFill(input) {
      var min = +input.min, max = +input.max, v = +input.value;
      input.style.setProperty("--fill", max > min ? ((v - min) / (max - min)) * 100 + "%" : "100%");
    }

    function drawDiagram(T, B) {
      diagram.textContent = "";
      var add = function (cls, label) {
        var node = document.createElement("span");
        node.className = cls;
        if (label) node.textContent = label;
        diagram.appendChild(node);
        return node;
      };
      var pre = add("blk end", "Prelude");
      var loops = [];
      var stop = null;
      for (var t = 1; t <= T; t++) {
        if (B < T && t === T - B + 1) stop = add("stopg");
        else add("conn");
        loops.push(add("blk loop " + (t > T - B ? "trained" : "fwd"), String(t)));
      }
      add("conn");
      var coda = add("blk end", "Coda");
      parts = { pre: pre, loops: loops, coda: coda, stop: stop, T: T, B: B };
    }

    function drawBar(bar, fwd, bwd) {
      bar.textContent = "";
      var push = function (units, cls) {
        var left = units;
        while (left > 1e-9) {
          var w = Math.min(1, left);
          var seg = document.createElement("span");
          if (cls) seg.className = cls;
          seg.style.flex = w + " 1 0";
          bar.appendChild(seg);
          left -= w;
        }
      };
      push(fwd, "");
      push(bwd, "bwd");
    }

    function stopAnimation() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!parts) return;
      diagram.querySelectorAll(".pulse-f, .pulse-b").forEach(function (n) {
        n.classList.remove("pulse-f", "pulse-b");
      });
    }

    function animate() {
      stopAnimation();
      if (reduceMotion || !running || !parts) return;
      var seq = [];
      var forward = [parts.pre].concat(parts.loops, [parts.coda]);
      forward.forEach(function (n) { seq.push({ node: n, cls: "pulse-f", ms: 95 }); });
      seq.push({ node: null, ms: 260 });
      var backward = [parts.coda].concat(parts.loops.slice(parts.T - parts.B).reverse());
      if (parts.stop) backward.push(parts.stop);
      backward.forEach(function (n) { seq.push({ node: n, cls: "pulse-b", ms: 150 }); });
      seq.push({ node: null, ms: 1100 });
      var i = 0;
      var prev = null;
      var step = function () {
        if (prev) prev.node.classList.remove(prev.cls);
        prev = null;
        if (i >= seq.length) i = 0;
        var s = seq[i++];
        if (s.node) {
          s.node.classList.add(s.cls);
          prev = s;
        }
        timer = setTimeout(step, s.ms);
      };
      step();
    }

    function update() {
      var T = +tIn.value;
      bIn.max = String(T);
      if (+bIn.value > T) bIn.value = String(T);
      bIn.disabled = T === 1;
      var B = +bIn.value;
      tOut.textContent = T;
      bOut.textContent = B;
      setFill(tIn);
      setFill(bIn);

      presets.forEach(function (p) {
        p.classList.toggle("active", +p.getAttribute("data-t") === T && +p.getAttribute("data-b") === B);
      });

      var S = T + 2 * B;
      var t = S / 3;
      el("ex-cur-name").textContent = "This setting " + pair(T, B);
      el("ex-cur-units").textContent = S + " units";
      el("ex-alt-name").textContent = "Full BPTT " + pair(loopCount(t), loopCount(t));
      el("ex-alt-units").textContent = S + " units";
      drawBar(el("ex-bar-cur"), T, 2 * B);
      drawBar(el("ex-bar-alt"), t, 2 * t);

      el("ex-g").textContent = two(g(T, B));
      el("ex-neff").textContent = "\u00d7" + two(effectiveSize(T, B));
      el("ex-comp").textContent = "\u00d7" + two(computeSize(T, B));
      el("ex-chi").textContent = two(computePerEffective(T, B));

      var bestB = 1;
      for (var b = 2; b <= T; b++) {
        if (computePerEffective(T, b) < computePerEffective(T, bestB) - 1e-12) bestB = b;
      }
      el("ex-v1-tag").innerHTML = "If <i>T</i> = " + T + " is prescribed";
      var v1;
      if (T === 1) {
        v1 = "With a single loop there is nothing to truncate.";
      } else if (bestB === T) {
        v1 = "The law picks <i>B</i>* = <i>T</i>: at this forward-loop count, truncation does not pay.";
      } else {
        var saving = 1 - computePerEffective(T, bestB) / computePerEffective(T, T);
        v1 = "The law picks <i>B</i>* = " + bestB + ": at equal loss, " + pair(T, bestB) + " needs <b>" +
          Math.round(saving * 100) + "% less</b> training compute than full BPTT " + pair(T, T) +
          "." + (B === bestB ? " That is the setting above." : "");
      }
      el("ex-v1").innerHTML = v1;

      var v2;
      applyTarget = null;
      if (B === T) {
        v2 = "This is already full BPTT, the law\u2019s best split of " + S +
          " units because <i>q</i> &gt; 2<i>p</i>.";
      } else {
        v2 = "The same " + S + " units are best spent on <i>T</i> = <i>B</i> = " + loopCount(t) +
          ": worth <b>\u00d7" + two(effectiveSize(t, t)) + "</b> the parameters instead of \u00d7" +
          two(effectiveSize(T, B)) + ", at the same compute.";
        if (Number.isInteger(t)) {
          applyTarget = t;
        } else {
          var lo = Math.floor(t), hi = Math.ceil(t);
          v2 += " That optimum is continuous; on integers, " + pair(lo, lo) + " costs " + 3 * lo +
            " units and " + pair(hi, hi) + " costs " + 3 * hi + ".";
        }
      }
      el("ex-v2").innerHTML = v2;
      if (applyTarget) {
        apply.hidden = false;
        apply.textContent = "Try " + pair(applyTarget, applyTarget);
      } else {
        apply.hidden = true;
      }

      drawDiagram(T, B);
      animate();
    }

    tIn.addEventListener("input", update);
    bIn.addEventListener("input", update);
    presets.forEach(function (p) {
      p.addEventListener("click", function () {
        tIn.value = p.getAttribute("data-t");
        update();
        bIn.value = p.getAttribute("data-b");
        update();
      });
    });
    apply.addEventListener("click", function () {
      if (!applyTarget) return;
      var target = applyTarget;
      tIn.value = String(target);
      update();
      bIn.value = String(target);
      update();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        running = entries[0].isIntersecting;
        if (running) animate(); else stopAnimation();
      }).observe(diagram);
    } else {
      running = true;
    }
    update();
  }

  renderMath();
  initNav();
  initTabs();
  initLightbox();
  initCopy();
  initExplorer();
})();
