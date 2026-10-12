(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var statusEl = document.getElementById("status");

  var COLS = 18;
  var ROWS = 12;
  var W = 0;
  var H = 0;
  var points = [];
  var broken = false;
  var drops = [];
  var pulling = false;
  var pullIndex = -1;
  var thickness = 1;
  var frame = { x: 0, y: 0, w: 0, h: 0 };

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    reset();
  }

  function reset() {
    frame.w = Math.min(W, H) * 0.72;
    frame.h = frame.w * 0.62;
    frame.x = (W - frame.w) * 0.5;
    frame.y = (H - frame.h) * 0.48;
    points = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var px = frame.x + (x / (COLS - 1)) * frame.w;
        var py = frame.y + (y / (ROWS - 1)) * frame.h;
        var border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
        points.push({
          x: px,
          y: py,
          ox: px,
          oy: py,
          pinned: border,
        });
      }
    }
    broken = false;
    drops = [];
    pulling = false;
    pullIndex = -1;
    thickness = 1;
    statusEl.classList.remove("visible");
    statusEl.textContent = "";
    document.body.classList.remove("dimmed");
  }

  function idx(x, y) {
    return y * COLS + x;
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function nearestInner(p) {
    var best = -1;
    var bestD = Infinity;
    for (var y = 1; y < ROWS - 1; y++) {
      for (var x = 1; x < COLS - 1; x++) {
        var pt = points[idx(x, y)];
        var dx = pt.x - p.x;
        var dy = pt.y - p.y;
        var d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = idx(x, y);
        }
      }
    }
    return bestD < Math.pow(60 * devicePixelRatio, 2) ? best : -1;
  }

  function down(e) {
    if (broken) return;
    e.preventDefault();
    RoomAudio.resume();
    var p = pointerPos(e);
    pullIndex = nearestInner(p);
    if (pullIndex < 0) return;
    pulling = true;
    canvas.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!pulling || pullIndex < 0 || broken) return;
    e.preventDefault();
    var p = pointerPos(e);
    var pt = points[pullIndex];
    pt.x = p.x;
    pt.y = p.y;
    pt.ox = p.x;
    pt.oy = p.y;
  }

  function up(e) {
    pulling = false;
    pullIndex = -1;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  function interferenceColor(t) {
    // t ~ 0 thin, ~1 thick; approximate soap film hues
    var hue = 40 + (1 - t) * 280;
    var light = 55 + (1 - t) * 15;
    return "hsla(" + hue + ", 70%, " + light + "%, 0.35)";
  }

  function simulate() {
    if (broken) return;
    var restX = frame.w / (COLS - 1);
    var restY = frame.h / (ROWS - 1);
    var stretchSum = 0;
    var stretchCount = 0;

    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p.pinned || (pulling && i === pullIndex)) continue;
      var vx = (p.x - p.ox) * 0.96;
      var vy = (p.y - p.oy) * 0.96;
      p.ox = p.x;
      p.oy = p.y;
      p.x += vx;
      p.y += vy;
    }

    for (var iter = 0; iter < 3; iter++) {
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var a = points[idx(x, y)];
          if (x < COLS - 1) constrain(a, points[idx(x + 1, y)], restX);
          if (y < ROWS - 1) constrain(a, points[idx(x, y + 1)], restY);
        }
      }
    }

    for (var yy = 0; yy < ROWS; yy++) {
      for (var xx = 0; xx < COLS - 1; xx++) {
        var A = points[idx(xx, yy)];
        var B = points[idx(xx + 1, yy)];
        var d = Math.hypot(B.x - A.x, B.y - A.y);
        stretchSum += d / restX;
        stretchCount++;
      }
    }
    var avg = stretchSum / Math.max(1, stretchCount);
    thickness = Math.max(0.05, Math.min(1, 2.2 - avg));

    var pullTooFar = false;
    if (pulling && pullIndex >= 0) {
      var homeX = frame.x + ((pullIndex % COLS) / (COLS - 1)) * frame.w;
      var homeY = frame.y + (Math.floor(pullIndex / COLS) / (ROWS - 1)) * frame.h;
      var pullPt = points[pullIndex];
      var pullDist = Math.hypot(pullPt.x - homeX, pullPt.y - homeY);
      pullTooFar = pullDist > Math.min(frame.w, frame.h) * 0.42;
    }

    if (avg > 1.32 || pullTooFar) burst();
  }

  function constrain(a, b, rest) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    var diff = (dist - rest) / dist;
    var ox = dx * 0.5 * diff;
    var oy = dy * 0.5 * diff;
    if (!a.pinned && !(pulling && points.indexOf(a) === pullIndex)) {
      a.x += ox;
      a.y += oy;
    }
    if (!b.pinned && !(pulling && points.indexOf(b) === pullIndex)) {
      b.x -= ox;
      b.y -= oy;
    }
  }

  function burst() {
    if (broken) return;
    broken = true;
    pulling = false;
    RoomAudio.pop();
    statusEl.textContent = "破了";
    statusEl.classList.add("visible");
    document.body.classList.add("dimmed");
    for (var i = 0; i < 28; i++) {
      var p = points[Math.floor(Math.random() * points.length)];
      drops.push({
        x: p.x,
        y: p.y,
        vx: (Math.random() - 0.5) * 6 * devicePixelRatio,
        vy: (Math.random() - 0.8) * 5 * devicePixelRatio,
        life: 1,
        r: (2 + Math.random() * 3) * devicePixelRatio,
      });
    }
  }

  function drawFilm() {
    // fill quads with interference color
    for (var y = 0; y < ROWS - 1; y++) {
      for (var x = 0; x < COLS - 1; x++) {
        var a = points[idx(x, y)];
        var b = points[idx(x + 1, y)];
        var c = points[idx(x + 1, y + 1)];
        var d = points[idx(x, y + 1)];
        var local =
          (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(d.x - a.x, d.y - a.y)) /
          (frame.w / (COLS - 1) + frame.h / (ROWS - 1));
        var t = Math.max(0.05, Math.min(1, 2 - local));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = interferenceColor(t * thickness);
        ctx.fill();
      }
    }

    // mesh lines
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1 * devicePixelRatio;
    for (var yy = 0; yy < ROWS; yy++) {
      ctx.beginPath();
      for (var xx = 0; xx < COLS; xx++) {
        var p = points[idx(xx, yy)];
        if (xx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (var xxx = 0; xxx < COLS; xxx++) {
      ctx.beginPath();
      for (var yyy = 0; yyy < ROWS; yyy++) {
        var q = points[idx(xxx, yyy)];
        if (yyy === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
  }

  function drawFrame() {
    ctx.strokeStyle = "#c9bfb0";
    ctx.lineWidth = 5 * devicePixelRatio;
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);
    ctx.fillStyle = "#2a241c";
    var peg = 6 * devicePixelRatio;
    [
      [frame.x, frame.y],
      [frame.x + frame.w, frame.y],
      [frame.x, frame.y + frame.h],
      [frame.x + frame.w, frame.y + frame.h],
    ].forEach(function (pt) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], peg, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawDrops() {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.vy += 0.25 * devicePixelRatio;
      d.x += d.vx;
      d.y += d.vy;
      d.life -= 0.02;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * d.life, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200, 230, 255, " + d.life * 0.7 + ")";
      ctx.fill();
      if (d.life <= 0) drops.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#14121a");
    bg.addColorStop(1, "#0c0b10");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    simulate();
    drawFrame();
    if (!broken) drawFilm();
    drawDrops();
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  again.addEventListener("click", reset);
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
