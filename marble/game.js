(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");

  var COLORS = ["#e07060", "#6aa8d8", "#e0c060", "#7cbc7c", "#c090d0", "#e09860"];
  var W = 0;
  var H = 0;
  var pegs = [];
  var slots = [];
  var marbles = [];
  var lastDrop = 0;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    buildBoard();
  }

  function buildBoard() {
    pegs = [];
    var rows = 9;
    var cols = 8;
    var top = H * 0.16;
    var bottom = H * 0.72;
    var left = W * 0.14;
    var right = W * 0.86;
    for (var r = 0; r < rows; r++) {
      var n = cols - (r % 2 === 0 ? 0 : 1);
      var y = top + (r / (rows - 1)) * (bottom - top);
      for (var c = 0; c < n; c++) {
        var x =
          r % 2 === 0
            ? left + (c / (cols - 1)) * (right - left)
            : left + ((c + 0.5) / (cols - 1)) * (right - left);
        pegs.push({ x: x, y: y, r: 5 * devicePixelRatio });
      }
    }

    slots = [];
    var slotN = 7;
    var slotTop = H * 0.82;
    var slotH = H * 0.12;
    for (var i = 0; i < slotN; i++) {
      var x0 = left + (i / slotN) * (right - left);
      var x1 = left + ((i + 1) / slotN) * (right - left);
      slots.push({
        x0: x0,
        x1: x1,
        y: slotTop,
        h: slotH,
        count: 0,
        color: COLORS[i % COLORS.length],
      });
    }
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function dropAt(x) {
    var now = performance.now();
    if (now - lastDrop < 120) return;
    lastDrop = now;
    RoomAudio.resume();
    var left = W * 0.14;
    var right = W * 0.86;
    x = Math.max(left + 10, Math.min(right - 10, x));
    marbles.push({
      x: x,
      y: H * 0.08,
      vx: (Math.random() - 0.5) * 0.6 * devicePixelRatio,
      vy: 0,
      r: 9 * devicePixelRatio,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      settled: false,
      cool: 0,
    });
    RoomAudio.bounce(0.35);
  }

  function update() {
    var left = W * 0.12;
    var right = W * 0.88;
    var floor = H * 0.82;

    for (var i = 0; i < marbles.length; i++) {
      var m = marbles[i];
      if (m.settled) continue;
      m.cool = Math.max(0, m.cool - 1);
      m.vy += 0.28 * devicePixelRatio;
      m.vx *= 0.995;
      m.x += m.vx;
      m.y += m.vy;

      if (m.x - m.r < left) {
        m.x = left + m.r;
        m.vx *= -0.6;
      }
      if (m.x + m.r > right) {
        m.x = right - m.r;
        m.vx *= -0.6;
      }

      for (var p = 0; p < pegs.length; p++) {
        var peg = pegs[p];
        var dx = m.x - peg.x;
        var dy = m.y - peg.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var minD = m.r + peg.r;
        if (dist < minD) {
          var nx = dx / dist;
          var ny = dy / dist;
          var overlap = minD - dist;
          m.x += nx * overlap;
          m.y += ny * overlap;
          var vn = m.vx * nx + m.vy * ny;
          if (vn < 0) {
            m.vx -= 1.7 * vn * nx;
            m.vy -= 1.7 * vn * ny;
            m.vx += (Math.random() - 0.5) * 1.2 * devicePixelRatio;
            if (m.cool <= 0) {
              RoomAudio.bounce(Math.min(1, Math.abs(vn) / (8 * devicePixelRatio)));
              m.cool = 4;
            }
          }
        }
      }

      if (m.y + m.r >= floor) {
        m.y = floor - m.r;
        m.vy *= -0.25;
        m.vx *= 0.85;
        if (Math.abs(m.vy) < 0.8 * devicePixelRatio) {
          m.settled = true;
          m.vy = 0;
          for (var s = 0; s < slots.length; s++) {
            if (m.x >= slots[s].x0 && m.x < slots[s].x1) {
              slots[s].count++;
              m.slot = s;
              m.y = floor - m.r - slots[s].count * m.r * 1.7;
              RoomAudio.click();
              break;
            }
          }
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#141820");
    bg.addColorStop(1, "#0c0e14");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // board frame
    ctx.strokeStyle = "rgba(200, 210, 230, 0.2)";
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.strokeRect(W * 0.1, H * 0.05, W * 0.8, H * 0.9);

    // drop zone hint
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(W * 0.14, H * 0.05, W * 0.72, H * 0.08);

    for (var p = 0; p < pegs.length; p++) {
      var peg = pegs[p];
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fillStyle = "#c8d0dc";
      ctx.fill();
    }

    for (var s = 0; s < slots.length; s++) {
      var slot = slots[s];
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(slot.x0, slot.y, slot.x1 - slot.x0, slot.h);
      ctx.strokeStyle = slot.color;
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.strokeRect(slot.x0 + 1, slot.y, slot.x1 - slot.x0 - 2, slot.h);
      ctx.fillStyle = "rgba(232,224,212,0.45)";
      ctx.font = 11 * devicePixelRatio + "px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(slot.count), (slot.x0 + slot.x1) / 2, slot.y + slot.h - 8 * devicePixelRatio);
    }

    for (var i = 0; i < marbles.length; i++) {
      var m = marbles[i];
      var g = ctx.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, 1, m.x, m.y, m.r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.25, m.color);
      g.addColorStop(1, "#222");
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    var p = pointerPos(e);
    if (p.y < H * 0.22) dropAt(p.x);
    else dropAt(p.x);
  });
  again.addEventListener("click", function () {
    marbles = [];
    for (var i = 0; i < slots.length; i++) slots[i].count = 0;
  });
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
