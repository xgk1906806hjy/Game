(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");

  var W = 0;
  var H = 0;
  var fruit = null;
  var peels = [];
  var active = null;
  var peeledMask = null;
  var maskCtx = null;
  var peeling = false;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    if (!fruit) resetFruit();
    else {
      fruit.x = W * 0.5;
      fruit.y = H * 0.42;
      fruit.r = Math.min(W, H) * 0.22;
    }
    rebuildMask();
  }

  function rebuildMask() {
    peeledMask = document.createElement("canvas");
    peeledMask.width = W;
    peeledMask.height = H;
    maskCtx = peeledMask.getContext("2d");
  }

  function resetFruit() {
    fruit = {
      x: W * 0.5,
      y: H * 0.42,
      r: Math.min(W, H) * 0.22,
      hue: 28 + Math.random() * 18,
    };
    peels = [];
    active = null;
    peeling = false;
    rebuildMask();
    document.body.classList.remove("dimmed");
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function onFruit(p) {
    var dx = p.x - fruit.x;
    var dy = p.y - fruit.y;
    return Math.sqrt(dx * dx + dy * dy) < fruit.r * 1.05;
  }

  function down(e) {
    e.preventDefault();
    RoomAudio.resume();
    var p = pointerPos(e);
    if (!onFruit(p)) return;
    peeling = true;
    active = {
      points: [{ x: p.x, y: p.y, curl: 0, vx: 0, vy: 0 }],
      falling: false,
      age: 0,
    };
    peels.push(active);
    markPeeled(p.x, p.y);
    canvas.setPointerCapture(e.pointerId);
  }

  function markPeeled(x, y) {
    if (!maskCtx) return;
    maskCtx.beginPath();
    maskCtx.arc(x, y, fruit.r * 0.12, 0, Math.PI * 2);
    maskCtx.fillStyle = "#fff";
    maskCtx.fill();
  }

  function move(e) {
    if (!peeling || !active) return;
    e.preventDefault();
    var p = pointerPos(e);
    var last = active.points[active.points.length - 1];
    var dx = p.x - last.x;
    var dy = p.y - last.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4 * devicePixelRatio) return;

    var curl = active.points.length * 0.08;
    active.points.push({
      x: p.x,
      y: p.y,
      curl: curl,
      vx: dx * 0.15,
      vy: dy * 0.15,
    });
    if (onFruit(p)) markPeeled(p.x, p.y);
    if (active.points.length % 8 === 0) RoomAudio.crackle(0.25);
  }

  function up(e) {
    if (!peeling) return;
    peeling = false;
    if (active) {
      active.falling = true;
      active = null;
    }
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  function updatePeels() {
    var floor = H * 0.92;
    for (var i = 0; i < peels.length; i++) {
      var peel = peels[i];
      if (!peel.falling) continue;
      peel.age++;
      var settled = true;
      for (var j = 0; j < peel.points.length; j++) {
        var pt = peel.points[j];
        var t = j / Math.max(1, peel.points.length - 1);
        pt.vy += 0.35 * devicePixelRatio;
        pt.vx *= 0.98;
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.curl += 0.03;
        // ribbon curl offset while falling
        pt.x += Math.sin(pt.curl) * 0.4 * devicePixelRatio * (1 - t);
        if (pt.y > floor) {
          pt.y = floor;
          pt.vy *= -0.15;
          pt.vx *= 0.7;
          if (Math.abs(pt.vy) < 0.4) pt.vy = 0;
        } else {
          settled = false;
        }
      }
      if (settled && peel.age > 40) peel.falling = false;
    }
  }

  function drawRibbon(peel) {
    var pts = peel.points;
    if (pts.length < 2) return;
    var width = 10 * devicePixelRatio;
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var ang = p.curl;
      var ox = Math.cos(ang) * width * (0.5 + i / pts.length);
      var oy = Math.sin(ang) * width * 0.35;
      if (i === 0) ctx.moveTo(p.x + ox, p.y + oy);
      else ctx.lineTo(p.x + ox, p.y + oy);
    }
    for (var j = pts.length - 1; j >= 0; j--) {
      var q = pts[j];
      var ang2 = q.curl + Math.PI;
      var ox2 = Math.cos(ang2) * width * (0.5 + j / pts.length) * 0.35;
      var oy2 = Math.sin(ang2) * width * 0.2;
      ctx.lineTo(q.x + ox2, q.y + oy2);
    }
    ctx.closePath();
    var g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.addColorStop(0, "hsl(" + fruit.hue + ", 70%, 52%)");
    g.addColorStop(1, "hsl(" + (fruit.hue + 12) + ", 65%, 42%)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 40, 10, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawFruit() {
    // flesh
    ctx.beginPath();
    ctx.arc(fruit.x, fruit.y, fruit.r * 0.92, 0, Math.PI * 2);
    var flesh = ctx.createRadialGradient(
      fruit.x - fruit.r * 0.2,
      fruit.y - fruit.r * 0.2,
      4,
      fruit.x,
      fruit.y,
      fruit.r
    );
    flesh.addColorStop(0, "#fff2c8");
    flesh.addColorStop(1, "#f0d070");
    ctx.fillStyle = flesh;
    ctx.fill();

    // peel layer with mask punched out
    var peelLayer = document.createElement("canvas");
    peelLayer.width = W;
    peelLayer.height = H;
    var pc = peelLayer.getContext("2d");
    pc.beginPath();
    pc.arc(fruit.x, fruit.y, fruit.r, 0, Math.PI * 2);
    var skin = pc.createRadialGradient(
      fruit.x - fruit.r * 0.3,
      fruit.y - fruit.r * 0.35,
      6,
      fruit.x,
      fruit.y,
      fruit.r
    );
    skin.addColorStop(0, "hsl(" + fruit.hue + ", 75%, 58%)");
    skin.addColorStop(1, "hsl(" + (fruit.hue - 8) + ", 70%, 38%)");
    pc.fillStyle = skin;
    pc.fill();

    // stem
    pc.fillStyle = "#5a4028";
    pc.fillRect(fruit.x - 2 * devicePixelRatio, fruit.y - fruit.r - 8 * devicePixelRatio, 4 * devicePixelRatio, 12 * devicePixelRatio);

    if (maskCtx) {
      pc.globalCompositeOperation = "destination-out";
      pc.drawImage(peeledMask, 0, 0);
      pc.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(peelLayer, 0, 0);

    // outline
    ctx.beginPath();
    ctx.arc(fruit.x, fruit.y, fruit.r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(60, 30, 10, 0.25)";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1c1812");
    bg.addColorStop(1, "#100e0b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // table
    ctx.fillStyle = "#2a2218";
    ctx.fillRect(0, H * 0.78, W, H * 0.22);

    updatePeels();
    drawFruit();
    for (var i = 0; i < peels.length; i++) drawRibbon(peels[i]);
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  again.addEventListener("click", function () {
    resetFruit();
  });
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
