(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var statusEl = document.getElementById("status");

  var W = 0;
  var H = 0;
  var cx = 0;
  var cy = 0;
  var rx = 0;
  var ry = 0;
  var cracks = [];
  var goldProgress = 0;
  var cracked = false;
  var done = false;
  var glow = 0;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    cx = W * 0.5;
    cy = H * 0.5;
    rx = Math.min(W, H) * 0.36;
    ry = rx * 0.72;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function insidePlate(x, y) {
    var dx = (x - cx) / rx;
    var dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function segmentLength(seg) {
    var len = 0;
    for (var i = 1; i < seg.length; i++) {
      var dx = seg[i].x - seg[i - 1].x;
      var dy = seg[i].y - seg[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  function growBranch(x, y, angle, depth, maxDepth, segs) {
    if (depth > maxDepth) return;
    var pts = [{ x: x, y: y }];
    var steps = 4 + Math.floor(Math.random() * 4);
    var ax = x;
    var ay = y;
    var ang = angle;
    for (var i = 0; i < steps; i++) {
      ang += rand(-0.35, 0.35);
      var step = rand(rx * 0.06, rx * 0.14) * (1 - depth * 0.12);
      ax += Math.cos(ang) * step;
      ay += Math.sin(ang) * step;
      if (!insidePlate(ax, ay)) break;
      pts.push({ x: ax, y: ay });
    }
    if (pts.length > 1) {
      segs.push(pts);
      if (depth < maxDepth && Math.random() < 0.75) {
        growBranch(ax, ay, ang + rand(0.4, 0.9), depth + 1, maxDepth, segs);
      }
      if (depth < maxDepth && Math.random() < 0.55) {
        growBranch(ax, ay, ang - rand(0.4, 0.9), depth + 1, maxDepth, segs);
      }
    }
  }

  function makeCracks(ox, oy) {
    var segs = [];
    var base = Math.atan2(oy - cy, ox - cx);
    var n = 3 + Math.floor(Math.random() * 2);
    for (var i = 0; i < n; i++) {
      growBranch(ox, oy, base + (i - (n - 1) / 2) * 0.7 + rand(-0.2, 0.2), 0, 4, segs);
    }
    // extra hairline from center-ish
    growBranch(ox, oy, base + Math.PI + rand(-0.4, 0.4), 0, 3, segs);
    return segs.map(function (s) {
      return { pts: s, len: segmentLength(s), drawn: 0 };
    });
  }

  function strokePartial(pts, amount) {
    if (pts.length < 2 || amount <= 0) return;
    var total = segmentLength(pts);
    var need = total * Math.min(1, amount);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    var walked = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x;
      var dy = pts[i].y - pts[i - 1].y;
      var seg = Math.sqrt(dx * dx + dy * dy);
      if (walked + seg >= need) {
        var t = (need - walked) / seg;
        ctx.lineTo(pts[i - 1].x + dx * t, pts[i - 1].y + dy * t);
        break;
      }
      ctx.lineTo(pts[i].x, pts[i].y);
      walked += seg;
    }
    ctx.stroke();
  }

  function crackAt(p) {
    if (cracked || !insidePlate(p.x, p.y)) return;
    RoomAudio.resume();
    RoomAudio.crack();
    cracks = makeCracks(p.x, p.y);
    cracked = true;
    goldProgress = 0;
    done = false;
    glow = 0;
    statusEl.classList.remove("visible");
    statusEl.textContent = "";
    document.body.classList.remove("dimmed");
  }

  function reset() {
    cracks = [];
    cracked = false;
    goldProgress = 0;
    done = false;
    glow = 0;
    statusEl.classList.remove("visible");
    statusEl.textContent = "";
    document.body.classList.remove("dimmed");
  }

  function drawPlate() {
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.08, rx * 1.05, ry * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.35, 8, cx, cy, rx);
    g.addColorStop(0, "#f4efe6");
    g.addColorStop(0.7, "#e2d5c4");
    g.addColorStop(1, "#c8b8a2");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.86, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(160, 140, 120, 0.35)";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.stroke();

    if (glow > 0) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(212, 168, 70, " + glow * 0.12 + ")";
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a1612");
    bg.addColorStop(1, "#0f0d0b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawPlate();

    if (cracked) {
      goldProgress = Math.min(1, goldProgress + 0.0065);
      for (var i = 0; i < cracks.length; i++) {
        var c = cracks[i];
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(40, 28, 20, 0.85)";
        ctx.lineWidth = 2.2 * devicePixelRatio;
        strokePartial(c.pts, 1);

        ctx.strokeStyle = "rgba(212, 168, 70, 0.95)";
        ctx.lineWidth = 1.6 * devicePixelRatio;
        strokePartial(c.pts, goldProgress);
        ctx.strokeStyle = "rgba(255, 230, 150, 0.55)";
        ctx.lineWidth = 0.7 * devicePixelRatio;
        strokePartial(c.pts, goldProgress);
      }

      if (goldProgress >= 1 && !done) {
        done = true;
        glow = 1;
        statusEl.textContent = "比碎之前更好看了";
        statusEl.classList.add("visible");
        document.body.classList.add("dimmed");
      }
      if (done) glow = Math.max(0.35, glow * 0.998);
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    crackAt(pointerPos(e));
  });
  again.addEventListener("click", reset);
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
