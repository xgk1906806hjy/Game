(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var retry = document.getElementById("retry");
  var scoreEl = document.getElementById("score");
  var comboEl = document.getElementById("combo");
  var overlay = document.getElementById("overlay");
  var finalEl = document.getElementById("final");

  var COLORS = [
    "#6a9bcc",
    "#d4a05a",
    "#7ab87a",
    "#c97878",
    "#9a7ac8",
    "#c9b06a",
    "#6ab0a8",
  ];

  var W = 0;
  var H = 0;
  var scale = 1;
  var cam = { x: 0, z: 0, sx: 0, sz: 0 };
  var platforms = [];
  var currentIndex = 0;
  var player = null;
  var state = "ready"; // ready | charging | jumping | dead
  var charge = 0;
  var chargeStart = 0;
  var score = 0;
  var combo = 0;
  var floatingTexts = [];
  var particles = [];
  var nextDir = 1; // 0 = +x, 1 = +z

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    scale = Math.min(W, H) * 0.028;
    if (!platforms.length) reset();
  }

  // isometric projection
  function project(wx, wy, wz) {
    var x = (wx - cam.sx) - (wz - cam.sz);
    var y = ((wx - cam.sx) + (wz - cam.sz)) * 0.5 - wy;
    return {
      x: W * 0.5 + x * scale,
      y: H * 0.58 + y * scale,
    };
  }

  function makePlatform(wx, wz, size, color) {
    return {
      wx: wx,
      wz: wz,
      size: size,
      h: 2.2 + Math.random() * 1.2,
      color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }

  function spawnNext(forcedDist) {
    var last = platforms[platforms.length - 1];
    nextDir = Math.random() < 0.5 ? 0 : 1;
    // keep gaps in a learnable range for hold-to-charge
    var dist = forcedDist != null ? forcedDist : 5.2 + Math.random() * 4.8;
    var size = 2.8 + Math.random() * 1.4;
    var wx = last.wx + (nextDir === 0 ? dist : 0);
    var wz = last.wz + (nextDir === 1 ? dist : 0);
    platforms.push(makePlatform(wx, wz, size));
  }

  function reset() {
    platforms = [];
    currentIndex = 0;
    platforms.push(makePlatform(0, 0, 3.6, "#6a9bcc"));
    nextDir = 1;
    spawnNext(6.5);
    player = {
      wx: 0,
      wz: 0,
      wy: 0,
      fromX: 0,
      fromZ: 0,
      toX: 0,
      toZ: 0,
      fromH: 2.2,
      toH: 2.2,
      jumpT: 0,
      jumpDur: 0,
      squash: 1,
    };
    cam.x = 0;
    cam.z = 0;
    cam.sx = 0;
    cam.sz = 0;
    state = "ready";
    charge = 0;
    score = 0;
    combo = 0;
    floatingTexts = [];
    particles = [];
    scoreEl.textContent = "0";
    comboEl.textContent = "";
    comboEl.classList.remove("visible");
    overlay.hidden = true;
    document.body.classList.remove("dimmed");
  }

  function currentPlatform() {
    return platforms[currentIndex];
  }

  function nextPlatform() {
    return platforms[currentIndex + 1];
  }

  function beginCharge() {
    if (state !== "ready") return;
    RoomAudio.resume();
    state = "charging";
    charge = 0;
    chargeStart = performance.now();
  }

  function releaseJump() {
    if (state !== "charging") return;
    var held = Math.min(1.25, (performance.now() - chargeStart) / 1000);
    charge = Math.max(0.08, held);
    var cur = currentPlatform();
    var next = nextPlatform();
    var dx = next.wx - cur.wx;
    var dz = next.wz - cur.wz;
    // short tap ~4 units, full hold ~16 units
    var jumpDist = 3.2 + charge * 10.5;
    var ang = Math.atan2(dz, dx);
    player.fromX = player.wx;
    player.fromZ = player.wz;
    player.fromH = cur.h;
    player.toH = next.h;
    player.toX = player.wx + Math.cos(ang) * jumpDist;
    player.toZ = player.wz + Math.sin(ang) * jumpDist;
    player.jumpT = 0;
    player.jumpDur = 0.38 + Math.min(0.28, charge * 0.22);
    player.squash = 1;
    state = "jumping";
    RoomAudio.bounce(0.35 + charge * 0.4);
  }

  function landCheck() {
    var next = nextPlatform();
    var dx = player.wx - next.wx;
    var dz = player.wz - next.wz;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var half = next.size * 0.68;

    if (dist <= half) {
      player.wx = next.wx;
      player.wz = next.wz;
      player.wy = 0;
      var perfect = dist < next.size * 0.22;
      var gain = 1;
      if (perfect) {
        combo += 1;
        gain = 1 + combo;
        showCombo(combo);
        popText(next.wx, next.wz, "完美 +" + gain, "#e0c060");
        RoomAudio.click();
      } else {
        combo = 0;
        comboEl.classList.remove("visible");
        popText(next.wx, next.wz, "+" + gain, "#e8e0d4");
        RoomAudio.thud(0.35);
      }
      score += gain;
      scoreEl.textContent = String(score);
      spawnBurst(next.wx, next.wz, next.color);
      currentIndex += 1;
      spawnNext();
      if (currentIndex > 4) {
        platforms.shift();
        currentIndex -= 1;
      }
      state = "ready";
      return;
    }

    state = "dead";
    player.wy = -0.01;
    RoomAudio.thud(0.7);
    finalEl.textContent = String(score);
    overlay.hidden = false;
    document.body.classList.add("dimmed");
  }

  function showCombo(n) {
    if (n <= 1) {
      comboEl.textContent = "完美";
    } else {
      comboEl.textContent = "连击 ×" + n;
    }
    comboEl.classList.add("visible");
  }

  function popText(wx, wz, text, color) {
    floatingTexts.push({
      wx: wx,
      wz: wz,
      wy: 3,
      text: text,
      color: color,
      life: 1,
    });
  }

  function spawnBurst(wx, wz, color) {
    for (var i = 0; i < 10; i++) {
      particles.push({
        wx: wx,
        wz: wz,
        wy: 2,
        vx: (Math.random() - 0.5) * 0.25,
        vz: (Math.random() - 0.5) * 0.25,
        vy: 0.15 + Math.random() * 0.2,
        life: 1,
        color: color,
      });
    }
  }

  function update(dt) {
    // camera ease
    cam.x += (player.wx - cam.x) * Math.min(1, dt * 4);
    cam.z += (player.wz - cam.z) * Math.min(1, dt * 4);
    cam.sx += (cam.x - cam.sx) * Math.min(1, dt * 6);
    cam.sz += (cam.z - cam.sz) * Math.min(1, dt * 6);

    if (state === "charging") {
      charge = Math.min(1.35, (performance.now() - chargeStart) / 1000);
      player.squash = 1 - Math.min(0.35, charge * 0.28);
    }

    if (state === "jumping") {
      player.jumpT += dt / player.jumpDur;
      var t = Math.min(1, player.jumpT);
      var ease = t;
      player.wx = player.fromX + (player.toX - player.fromX) * ease;
      player.wz = player.fromZ + (player.toZ - player.fromZ) * ease;
      player.wy = Math.sin(Math.PI * t) * (3.5 + charge * 2.5);
      player.squash = 1 + Math.sin(Math.PI * t) * 0.15;
      if (t >= 1) {
        player.wy = 0;
        player.squash = 1;
        landCheck();
      }
    }

    if (state === "dead") {
      player.wy -= dt * 12;
      player.squash = 1;
    }

    for (var i = floatingTexts.length - 1; i >= 0; i--) {
      var ft = floatingTexts[i];
      ft.wy += dt * 4;
      ft.life -= dt * 1.2;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.wx += pt.vx;
      pt.wz += pt.vz;
      pt.wy += pt.vy;
      pt.vy -= dt * 0.8;
      pt.life -= dt * 1.6;
      if (pt.life <= 0) particles.splice(p, 1);
    }
  }

  function drawPlatform(p) {
    var top = [
      project(p.wx - p.size * 0.5, p.h, p.wz - p.size * 0.5),
      project(p.wx + p.size * 0.5, p.h, p.wz - p.size * 0.5),
      project(p.wx + p.size * 0.5, p.h, p.wz + p.size * 0.5),
      project(p.wx - p.size * 0.5, p.h, p.wz + p.size * 0.5),
    ];
    var bot = [
      project(p.wx - p.size * 0.5, 0, p.wz - p.size * 0.5),
      project(p.wx + p.size * 0.5, 0, p.wz - p.size * 0.5),
      project(p.wx + p.size * 0.5, 0, p.wz + p.size * 0.5),
      project(p.wx - p.size * 0.5, 0, p.wz + p.size * 0.5),
    ];

    // right face
    ctx.beginPath();
    ctx.moveTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(bot[2].x, bot[2].y);
    ctx.lineTo(bot[1].x, bot[1].y);
    ctx.closePath();
    ctx.fillStyle = shade(p.color, -28);
    ctx.fill();

    // left face
    ctx.beginPath();
    ctx.moveTo(top[2].x, top[2].y);
    ctx.lineTo(top[3].x, top[3].y);
    ctx.lineTo(bot[3].x, bot[3].y);
    ctx.lineTo(bot[2].x, bot[2].y);
    ctx.closePath();
    ctx.fillStyle = shade(p.color, -45);
    ctx.fill();

    // top face
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(top[3].x, top[3].y);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();

    // center mark
    var c = project(p.wx, p.h + 0.02, p.wz);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.5 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();
  }

  function shade(hex, amount) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawPlayer() {
    var standH;
    if (state === "ready" || state === "charging") {
      standH = currentPlatform().h;
    } else if (state === "jumping") {
      var t = Math.min(1, player.jumpT);
      standH = player.fromH + (player.toH - player.fromH) * t;
    } else {
      standH = Math.max(0, player.toH || 0);
    }

    var base = project(player.wx, standH + player.wy, player.wz);
    var bodyH = 22 * devicePixelRatio * player.squash;
    var bodyW = 16 * devicePixelRatio * (2 - player.squash);

    // shadow on next or current platform top
    var shadowY = project(player.wx, standH, player.wz).y;
    if (state !== "dead") {
      ctx.beginPath();
      ctx.ellipse(
        base.x,
        shadowY + 2 * devicePixelRatio,
        bodyW * 0.55,
        4 * devicePixelRatio,
        0,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();
    }

    // body
    var topY = base.y - bodyH;
    var g = ctx.createLinearGradient(base.x, topY, base.x, base.y);
    g.addColorStop(0, "#f0e6d4");
    g.addColorStop(1, "#c8b090");
    ctx.beginPath();
    ctx.roundRect(base.x - bodyW / 2, topY, bodyW, bodyH, 6 * devicePixelRatio);
    ctx.fillStyle = g;
    ctx.fill();

    // eyes
    ctx.fillStyle = "#2a241c";
    ctx.beginPath();
    ctx.arc(base.x - 3 * devicePixelRatio, topY + bodyH * 0.35, 1.6 * devicePixelRatio, 0, Math.PI * 2);
    ctx.arc(base.x + 3 * devicePixelRatio, topY + bodyH * 0.35, 1.6 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();

    // charge bar
    if (state === "charging") {
      var barW = 40 * devicePixelRatio;
      var barH = 5 * devicePixelRatio;
      var pct = Math.min(1, charge / 1.2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(base.x - barW / 2, topY - 14 * devicePixelRatio, barW, barH);
      ctx.fillStyle = pct > 0.85 ? "#e07060" : "#e0c060";
      ctx.fillRect(base.x - barW / 2, topY - 14 * devicePixelRatio, barW * pct, barH);
    }
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
    bg.addColorStop(0, "#1c2430");
    bg.addColorStop(0.55, "#141a22");
    bg.addColorStop(1, "#0e1218");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // soft ground fade
    ctx.fillStyle = "rgba(40, 50, 60, 0.25)";
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.72, W * 0.42, H * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // sort platforms by depth (x+z)
    var sorted = platforms.slice().sort(function (a, b) {
      return a.wx + a.wz - (b.wx + b.wz);
    });
    for (var i = 0; i < sorted.length; i++) drawPlatform(sorted[i]);

    drawPlayer();

    for (var t = 0; t < floatingTexts.length; t++) {
      var ft = floatingTexts[t];
      var p = project(ft.wx, ft.wy + 4, ft.wz);
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.fillStyle = ft.color;
      ctx.font = "bold " + 14 * devicePixelRatio + "px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ft.text, p.x, p.y);
      ctx.globalAlpha = 1;
    }

    for (var q = 0; q < particles.length; q++) {
      var pt = particles[q];
      var pp = project(pt.wx, pt.wy + 2.2, pt.wz);
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pp.x, pp.y, 3 * devicePixelRatio, 3 * devicePixelRatio);
      ctx.globalAlpha = 1;
    }

    // aim hint while charging
    if (state === "charging") {
      var cur = currentPlatform();
      var next = nextPlatform();
      var dx = next.wx - cur.wx;
      var dz = next.wz - cur.wz;
      var len = Math.sqrt(dx * dx + dz * dz) || 1;
      var jumpDist = 3.2 + Math.min(1.25, charge) * 10.5;
      var ax = player.wx + (dx / len) * Math.min(jumpDist, len + 4);
      var az = player.wz + (dz / len) * Math.min(jumpDist, len + 4);
      var a = project(player.wx, cur.h + 0.2, player.wz);
      var b = project(ax, cur.h + 0.2, az);
      ctx.strokeStyle = "rgba(224, 192, 96, 0.45)";
      ctx.setLineDash([6 * devicePixelRatio, 6 * devicePixelRatio]);
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    if (state === "dead") return;
    beginCharge();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", function (e) {
    e.preventDefault();
    releaseJump();
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  });
  canvas.addEventListener("pointercancel", function () {
    if (state === "charging") releaseJump();
  });

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      if (state === "dead") return;
      if (state === "ready") beginCharge();
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      releaseJump();
    }
  });

  again.addEventListener("click", reset);
  retry.addEventListener("click", reset);
  window.addEventListener("resize", resize);

  resize();
  requestAnimationFrame(loop);
})();
