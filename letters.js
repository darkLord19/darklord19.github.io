/* Throwable letters. Vanilla, no deps. Auto-mounts every [data-letters] element.
   Buttons with [data-letters-drop] re-drop the letters; window.UmangLetters.redrop() does too. */
(function () {
  'use strict';

  var STEP = 1000 / 60;          // physics is tuned per 60Hz frame; use a fixed timestep
  var instances = [];

  function mount(box) {
    var text = box.getAttribute('data-letters') || '';
    var chars = text.split('');
    if (!chars.length) return null;

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    var bodies = [], els = [];
    var drag = -1, off = { x: 0, y: 0 }, last = { x: 0, y: 0 }, lastT = 0;
    var sleep = 0, raf = 0, prev = 0, acc = 0;
    var D = { W: 0, H: 0, s: 0, w: 0, h: 0 };

    box.textContent = '';
    chars.forEach(function (c, i) {
      var el = document.createElement('span');
      el.className = 'letter' + (c === '.' ? ' dot' : '');
      el.setAttribute('aria-hidden', 'true');
      el.textContent = c;
      el.addEventListener('pointerdown', function (e) { onDown(i, e); });
      box.appendChild(el);
      els.push(el);
    });

    function dims() {
      var W = box.clientWidth, H = box.clientHeight;
      var s = Math.max(72, Math.min(200, W / 4.4));
      D = { W: W, H: H, s: s, w: s * 0.66, h: s * 0.92 };
      return D;
    }

    function sizeEls() {
      els.forEach(function (el) {
        el.style.width = D.w + 'px';
        el.style.height = D.h + 'px';
        el.style.fontSize = D.s + 'px';
      });
    }

    function render() {
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        els[i].style.transform = 'translate(' + (b.x - D.w / 2) + 'px,' + (b.y - D.h / 2) + 'px) rotate(' + b.rot + 'deg)';
      }
    }

    function wake() {
      sleep = 0;
      if (!raf) { prev = 0; acc = 0; raf = requestAnimationFrame(frame); }
    }

    function init(settled) {
      dims(); sizeEls();
      var n = chars.length;
      var span = Math.min(D.W - D.w, n * D.w * 1.05);
      var x0 = (D.W - span) / 2 + D.w / 2;
      bodies = chars.map(function (c, i) {
        return {
          x: x0 + (n > 1 ? i * (span - D.w) / (n - 1) : 0),
          y: settled ? D.H - D.h / 2 : -D.h - i * 70 - Math.random() * 40,
          vx: settled ? 0 : (Math.random() - 0.5) * 3,
          vy: 0,
          rot: settled ? 0 : (Math.random() - 0.5) * 30,
          vr: 0
        };
      });
      drag = -1;
      render();
      wake();
    }

    function fit() {
      var h = box.clientWidth < 640 ? 300 : 440;
      if (box.style.height !== h + 'px') box.style.height = h + 'px';
      var oldW = D.W;
      dims(); sizeEls();
      if (oldW && bodies.length) {
        bodies.forEach(function (b) {
          b.x = Math.max(D.w / 2, Math.min(D.W - D.w / 2, b.x));
          b.y = Math.min(D.H - D.h / 2, b.y);
        });
        render();
      }
      wake();
    }

    function pt(e) {
      var r = box.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onDown(i, e) {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      try { els[i].setPointerCapture(e.pointerId); } catch (err) {}
      var p = pt(e), b = bodies[i];
      drag = i; off = { x: p.x - b.x, y: p.y - b.y }; last = p; lastT = e.timeStamp;
      b.vx = 0; b.vy = 0; b.vr = 0;
      els[i].classList.add('grabbing');
      els[i].style.zIndex = 1;
      wake();
    }

    function onMove(e) {
      if (drag < 0) return;
      var p = pt(e), b = bodies[drag];
      b.vx = (p.x - last.x) * 0.9; b.vy = (p.y - last.y) * 0.9;
      b.vr = b.vx * 0.6;
      b.x = Math.max(D.w / 2, Math.min(D.W - D.w / 2, p.x - off.x));
      b.y = Math.min(D.H - D.h / 2, p.y - off.y);
      last = p; lastT = e.timeStamp; sleep = 0;
      render();
    }

    function onUp(e) {
      if (drag < 0) return;
      var b = bodies[drag], cap = 45;
      // holding still before release means no throw
      if (e && e.timeStamp - lastT > 80) { b.vx = 0; b.vy = 0; b.vr = 0; }
      b.vx = Math.max(-cap, Math.min(cap, b.vx));
      b.vy = Math.max(-cap, Math.min(cap, b.vy));
      els[drag].classList.remove('grabbing');
      els[drag].style.zIndex = '';
      drag = -1;
      wake();
    }

    function step() {
      var bs = bodies, energy = 0, i, j;
      for (i = 0; i < bs.length; i++) {
        if (i === drag) continue;
        var b = bs[i];
        b.vy += 0.75;
        b.x += b.vx; b.y += b.vy; b.rot += b.vr;
        b.vx *= 0.995; b.vr *= 0.97;
        var floor = D.H - D.h / 2;
        if (b.y > floor) {
          b.y = floor;
          b.vy = b.vy > 2 ? -b.vy * 0.42 : 0;
          b.vx *= 0.88;
          b.vr = b.vx * 0.9;
          b.rot *= 0.94;
        }
        if (b.x < D.w / 2) { b.x = D.w / 2; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > D.W - D.w / 2) { b.x = D.W - D.w / 2; b.vx = -Math.abs(b.vx) * 0.5; }
      }
      var R = D.w * 0.5;
      for (i = 0; i < bs.length; i++) {
        for (j = i + 1; j < bs.length; j++) {
          var a = bs[i], c = bs[j];
          var dx = c.x - a.x, dy = c.y - a.y, dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var min = R * 2;
          if (dist < min) {
            var nx = dx / dist, ny = dy / dist, ov = min - dist;
            var aFix = i === drag, cFix = j === drag;
            if (aFix) { c.x += nx * ov; c.y += ny * ov; }
            else if (cFix) { a.x -= nx * ov; a.y -= ny * ov; }
            else { a.x -= nx * ov / 2; a.y -= ny * ov / 2; c.x += nx * ov / 2; c.y += ny * ov / 2; }
            var vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
            if (vn < 0) {
              var jm = -1.3 * vn / 2;
              if (!aFix) { a.vx -= jm * nx; a.vy -= jm * ny; a.vr -= jm * 0.8; }
              if (!cFix) { c.vx += jm * nx; c.vy += jm * ny; c.vr += jm * 0.8; }
            }
          }
        }
      }
      for (i = 0; i < bs.length; i++) energy += Math.abs(bs[i].vx) + Math.abs(bs[i].vy) + Math.abs(bs[i].vr);
      sleep = energy < 0.3 && drag < 0 ? sleep + 1 : 0;
    }

    function frame(t) {
      raf = 0;
      if (!prev) prev = t;
      acc += Math.min(t - prev, 100);
      prev = t;
      var n = 0;
      while (acc >= STEP && n < 6) { step(); acc -= STEP; n++; }
      if (n) render();
      if (sleep > 30 && drag < 0) return;   // at rest: stop the loop entirely
      raf = requestAnimationFrame(frame);
    }

    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onUp);

    dims();
    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit);
      ro.observe(box);
    } else {
      window.addEventListener('resize', fit);
    }
    fit();
    init(reduce);

    return { redrop: function () { init(false); }, el: box };
  }

  function autoMount() {
    var boxes = document.querySelectorAll('[data-letters]');
    for (var i = 0; i < boxes.length; i++) {
      var inst = mount(boxes[i]);
      if (inst) instances.push(inst);
    }
    var btns = document.querySelectorAll('[data-letters-drop]');
    for (var k = 0; k < btns.length; k++) {
      btns[k].addEventListener('click', function () { api.redrop(); });
    }
  }

  var api = window.UmangLetters = {
    redrop: function () { instances.forEach(function (x) { x.redrop(); }); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
