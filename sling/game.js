(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var statusEl = document.getElementById("status");

  var W = 0;
  var H = 0;
  var anchor = { x: 0, y: 0 };
  var pull = null;
  var projectile = null;
  var cans = [];
  var particles = [];

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    anchor.x = W * 0.22;
    anchor.y = H * 0.62;
    if (!cans.length) resetCans();
  }

  function resetCans() {
    cans = [];
    var baseX = W * 0.68;
    var baseY = H * 0.72;
    var rows = [
      { n: 3, y: 0 },
      { n: 2, y: 1 },
      { n: 1, y: 2 },
    ];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var i = 0; i < row.n; i++) {
        var spread = (row.n - 1) * 28 * devicePixelRatio;
        cans.push({
          x: baseX - spread / 2 + i * 28 * devicePixelRatio,
          y: baseY - row.y * 34 * devicePixelRatio,
          r: 14 * devicePixelRatio,
          vx: 0,
          vy: 0,
          rot: 0,
          vr: 0,
          alive: true,
          hue: 20 + Math.random() * 40,
        });
      }
    }
    projectile = null;
    pull = null;
    particles = [];
    statusEl.classList.remove("visible");
    statusEl.textContent = "";
    document.body.classList.remove("dimmed");
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function down(e) {
    e.preventDefault();
    RoomAudio.resume();
    var p = pointerPos(e);
    var dx = p.x - anchor.x;
    var dy = p.y - anchor.y;
    if (dx * dx + dy * dy < Math.pow(50 * devicePixelRatio, 2) && !projectile) {
      pull = { x: p.x, y: p.y };
      canvas.setPointerCapture(e.pointerId);
    }
  }

  function move(e) {
    if (!pull) return;
    e.preventDefault();
    var p = pointerPos(e);
    var dx = p.x - anchor.x;
    var dy = p.y - anchor.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var max = 90 * devicePixelRatio;
    if (dist > max) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    // prefer pull left/down
    pull.x = anchor.x + Math.min(10 * devicePixelRatio, dx);
    pull.y = anchor.y + Math.max(0, dy);
    if (pull.x > anchor.x) pull.x = anchor.x;
  }

  function up(e) {
    if (!pull) return;
    var dx = anchor.x - pull.x;
    var dy = anchor.y - pull.y;
    var power = Math.sqrt(dx * dx + dy * dy);
    if (power > 12 * devicePixelRatio) {
      projectile = {
        x: pull.x,
        y: pull.y,
        vx: dx * 0.22,
        vy: dy * 0.22,
        r: 8 * devicePixelRatio,
        life: 1,
      };
      RoomAudio.bounce(0.5);
    }
    pull = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  function explode(can) {
    can.alive = false;
    RoomAudio.thud(0.7);
    for (var i = 0; i < 12; i++) {
      particles.push({
        x: can.x,
        y: can.y,
        vx: (Math.random() - 0.5) * 6 * devicePixelRatio,
        vy: (Math.random() - 0.8) * 5 * devicePixelRatio,
        life: 1,
        color: "hsl(" + can.hue + ",70%,55%)",
      });
    }
  }

  function checkWin() {
    for (var i = 0; i < cans.length; i++) {
      if (cans[i].alive) return;
    }
    statusEl.textContent = "全倒了";
    statusEl.classList.add("visible");
    document.body.classList.add("dimmed");
  }

  function update() {
    if (projectile) {
      projectile.vy += 0.25 * devicePixelRatio;
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      if (
        projectile.x < 0 ||
        projectile.x > W ||
        projectile.y > H
      ) {
        projectile = null;
      } else {
        for (var i = 0; i < cans.length; i++) {
          var can = cans[i];
          if (!can.alive) continue;
          var dx = projectile.x - can.x;
          var dy = projectile.y - can.y;
          if (dx * dx + dy * dy < Math.pow(projectile.r + can.r, 2)) {
            can.vx += projectile.vx * 0.6;
            can.vy += projectile.vy * 0.4 - 2 * devicePixelRatio;
            can.vr = (Math.random() - 0.5) * 0.3;
            explode(can);
            // soft continue through nearby cans
            projectile.vx *= 0.4;
            projectile.vy *= 0.4;
            checkWin();
          }
        }
      }
    }

    for (var c = 0; c < cans.length; c++) {
      var can2 = cans[c];
      if (can2.alive) continue;
      can2.vy += 0.35 * devicePixelRatio;
      can2.x += can2.vx;
      can2.y += can2.vy;
      can2.rot += can2.vr;
      can2.vx *= 0.99;
    }

    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.vy += 0.2 * devicePixelRatio;
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 0.03;
      if (pt.life <= 0) particles.splice(p, 1);
    }
  }

  function drawCan(can) {
    ctx.save();
    ctx.translate(can.x, can.y);
    ctx.rotate(can.rot);
    ctx.fillStyle = "hsl(" + can.hue + ", 65%, 48%)";
    ctx.beginPath();
    ctx.roundRect(-can.r * 0.7, -can.r, can.r * 1.4, can.r * 2, 4 * devicePixelRatio);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(-can.r * 0.5, -can.r * 0.7, can.r, can.r * 0.35);
    ctx.restore();
  }

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a1612");
    bg.addColorStop(1, "#100e0b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ground
    ctx.fillStyle = "#2a241c";
    ctx.fillRect(0, H * 0.78, W, H * 0.22);

    // shelf
    ctx.fillStyle = "#3a3228";
    ctx.fillRect(W * 0.55, H * 0.74, W * 0.35, 8 * devicePixelRatio);

    for (var i = 0; i < cans.length; i++) {
      if (cans[i].alive || cans[i].y < H + 40) drawCan(cans[i]);
    }

    // slingshot Y fork
    ctx.strokeStyle = "#8a6a40";
    ctx.lineWidth = 6 * devicePixelRatio;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(anchor.x - 18 * devicePixelRatio, anchor.y - 40 * devicePixelRatio);
    ctx.lineTo(anchor.x, anchor.y + 10 * devicePixelRatio);
    ctx.lineTo(anchor.x + 18 * devicePixelRatio, anchor.y - 40 * devicePixelRatio);
    ctx.stroke();

    var bandL = { x: anchor.x - 18 * devicePixelRatio, y: anchor.y - 40 * devicePixelRatio };
    var bandR = { x: anchor.x + 18 * devicePixelRatio, y: anchor.y - 40 * devicePixelRatio };
    var pouch = pull || { x: anchor.x, y: anchor.y - 20 * devicePixelRatio };

    ctx.strokeStyle = "#d0c0a0";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(bandL.x, bandL.y);
    ctx.lineTo(pouch.x, pouch.y);
    ctx.lineTo(bandR.x, bandR.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pouch.x, pouch.y, 10 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = "#c8b090";
    ctx.fill();

    if (projectile) {
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
      ctx.fillStyle = "#e8e0d0";
      ctx.fill();
    }

    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 3 * devicePixelRatio, 3 * devicePixelRatio);
      ctx.globalAlpha = 1;
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  again.addEventListener("click", resetCans);
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
