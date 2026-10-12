(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var retry = document.getElementById("retry");
  var scoreEl = document.getElementById("score");
  var livesEl = document.getElementById("lives");
  var overlay = document.getElementById("overlay");
  var finalEl = document.getElementById("final");
  var bestEl = document.getElementById("best");

  var W = 0;
  var H = 0;
  var player = null;
  var bullets = [];
  var enemies = [];
  var particles = [];
  var stars = [];
  var score = 0;
  var best = 0;
  var lives = 3;
  var running = false;
  var gameOver = false;
  var spawnTimer = 0;
  var fireTimer = 0;
  var invuln = 0;
  var difficulty = 1;
  var keys = { left: false, right: false, up: false, down: false };
  var pointerDown = false;
  var pointerX = 0;
  var pointerY = 0;
  var last = 0;

  try {
    best = parseInt(localStorage.getItem("planeBest") || "0", 10) || 0;
  } catch (e) {
    best = 0;
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    buildStars();
    if (!player) reset();
    else {
      player.x = Math.min(W - player.r, Math.max(player.r, player.x));
      player.y = Math.min(H - player.r, Math.max(H * 0.55, player.y));
    }
  }

  function buildStars() {
    stars = [];
    for (var i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: (0.6 + Math.random() * 1.8) * devicePixelRatio,
        v: (0.4 + Math.random() * 1.6) * devicePixelRatio,
        a: 0.25 + Math.random() * 0.55,
      });
    }
  }

  function reset() {
    player = {
      x: W * 0.5,
      y: H * 0.82,
      r: 16 * devicePixelRatio,
      vx: 0,
      vy: 0,
    };
    bullets = [];
    enemies = [];
    particles = [];
    score = 0;
    lives = 3;
    running = true;
    gameOver = false;
    spawnTimer = 0.6;
    fireTimer = 0;
    invuln = 1.2;
    difficulty = 1;
    scoreEl.textContent = "0";
    updateLives();
    overlay.hidden = true;
    document.body.classList.remove("dimmed");
    bestEl.textContent = String(best);
  }

  function updateLives() {
    var hearts = [];
    for (var i = 0; i < lives; i++) hearts.push("❤");
    livesEl.textContent = hearts.join(" ") || "—";
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (score > best) {
      best = score;
      try {
        localStorage.setItem("planeBest", String(best));
      } catch (e) {}
    }
    finalEl.textContent = String(score);
    bestEl.textContent = String(best);
    overlay.hidden = false;
    document.body.classList.add("dimmed");
    RoomAudio.thud(0.8);
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function spawnEnemy() {
    var roll = Math.random();
    var kind = roll < 0.62 ? 0 : roll < 0.88 ? 1 : 2;
    var sizes = [14, 20, 28];
    var speeds = [1.2, 0.9, 0.55];
    var hps = [1, 2, 4];
    var points = [10, 25, 60];
    var colors = ["#e07070", "#e0a060", "#c070d0"];
    var r = sizes[kind] * devicePixelRatio;
    enemies.push({
      x: r + Math.random() * (W - r * 2),
      y: -r - 10,
      r: r,
      vy: (speeds[kind] + difficulty * 0.18) * devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.8 * devicePixelRatio * difficulty,
      hp: hps[kind],
      maxHp: hps[kind],
      points: points[kind],
      color: colors[kind],
      kind: kind,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function fire() {
    if (!running || !player) return;
    bullets.push({
      x: player.x,
      y: player.y - player.r,
      r: 3.2 * devicePixelRatio,
      vy: -11 * devicePixelRatio,
    });
    // side shots at higher difficulty
    if (difficulty > 2.2) {
      bullets.push({
        x: player.x - 10 * devicePixelRatio,
        y: player.y - player.r * 0.6,
        r: 2.4 * devicePixelRatio,
        vy: -10 * devicePixelRatio,
      });
      bullets.push({
        x: player.x + 10 * devicePixelRatio,
        y: player.y - player.r * 0.6,
        r: 2.4 * devicePixelRatio,
        vy: -10 * devicePixelRatio,
      });
    }
    RoomAudio.shoot();
  }

  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (1 + Math.random() * 3.5) * devicePixelRatio;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        color: color,
        s: (1.5 + Math.random() * 2.5) * devicePixelRatio,
      });
    }
  }

  function hitPlayer() {
    if (invuln > 0) return;
    lives -= 1;
    updateLives();
    invuln = 1.6;
    burst(player.x, player.y, "#e8e0d4", 18);
    RoomAudio.explode();
    if (lives <= 0) endGame();
  }

  function update(dt) {
    if (!running) {
      // still scroll stars gently
      for (var s = 0; s < stars.length; s++) {
        stars[s].y += stars[s].v * 0.3;
        if (stars[s].y > H) stars[s].y = 0;
      }
      return;
    }

    difficulty = 1 + score / 180;
    invuln = Math.max(0, invuln - dt);

    // stars
    for (var i = 0; i < stars.length; i++) {
      stars[i].y += stars[i].v * (1 + difficulty * 0.15);
      if (stars[i].y > H) {
        stars[i].y = 0;
        stars[i].x = Math.random() * W;
      }
    }

    // player move
    var speed = 6.2 * devicePixelRatio;
    if (pointerDown) {
      player.x += (pointerX - player.x) * Math.min(1, dt * 12);
      player.y += (pointerY - player.y) * Math.min(1, dt * 12);
    } else {
      if (keys.left) player.x -= speed;
      if (keys.right) player.x += speed;
      if (keys.up) player.y -= speed;
      if (keys.down) player.y += speed;
    }
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    player.y = Math.max(H * 0.45, Math.min(H - player.r - 4, player.y));

    // auto fire
    fireTimer -= dt;
    if (fireTimer <= 0) {
      fire();
      fireTimer = Math.max(0.12, 0.22 - difficulty * 0.015);
    }

    // spawn enemies
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy();
      if (Math.random() < 0.25 + difficulty * 0.05) spawnEnemy();
      spawnTimer = Math.max(0.28, 0.95 - difficulty * 0.08);
    }

    // bullets
    for (var b = bullets.length - 1; b >= 0; b--) {
      bullets[b].y += bullets[b].vy;
      if (bullets[b].y < -20) bullets.splice(b, 1);
    }

    // enemies
    for (var e = enemies.length - 1; e >= 0; e--) {
      var en = enemies[e];
      en.wobble += dt * 3;
      en.x += en.vx + Math.sin(en.wobble) * 0.4 * devicePixelRatio;
      en.y += en.vy;
      if (en.x < en.r) {
        en.x = en.r;
        en.vx *= -1;
      }
      if (en.x > W - en.r) {
        en.x = W - en.r;
        en.vx *= -1;
      }
      if (en.y > H + en.r) {
        enemies.splice(e, 1);
        continue;
      }

      // collide player
      var pdx = en.x - player.x;
      var pdy = en.y - player.y;
      if (pdx * pdx + pdy * pdy < Math.pow(en.r + player.r * 0.75, 2)) {
        burst(en.x, en.y, en.color, 12);
        enemies.splice(e, 1);
        hitPlayer();
        continue;
      }

      // collide bullets
      for (var j = bullets.length - 1; j >= 0; j--) {
        var bl = bullets[j];
        var dx = en.x - bl.x;
        var dy = en.y - bl.y;
        if (dx * dx + dy * dy < Math.pow(en.r + bl.r, 2)) {
          bullets.splice(j, 1);
          en.hp -= 1;
          burst(bl.x, bl.y, "#ffe8a0", 4);
          if (en.hp <= 0) {
            score += en.points;
            scoreEl.textContent = String(score);
            burst(en.x, en.y, en.color, 16 + en.kind * 6);
            RoomAudio.explode();
            enemies.splice(e, 1);
          } else {
            RoomAudio.bounce(0.35);
          }
          break;
        }
      }
    }

    // particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.08 * devicePixelRatio;
      pt.life -= dt * 2.2;
      if (pt.life <= 0) particles.splice(p, 1);
    }
  }

  function drawPlane(x, y, r, flash) {
    ctx.save();
    ctx.translate(x, y);
    if (flash) ctx.globalAlpha = 0.45 + Math.sin(performance.now() / 50) * 0.35;

    // glow
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100, 180, 255, 0.12)";
    ctx.fill();

    // wings
    ctx.beginPath();
    ctx.moveTo(-r * 1.15, r * 0.15);
    ctx.lineTo(0, -r * 0.1);
    ctx.lineTo(r * 1.15, r * 0.15);
    ctx.lineTo(r * 0.35, r * 0.35);
    ctx.lineTo(-r * 0.35, r * 0.35);
    ctx.closePath();
    ctx.fillStyle = "#5a9fd4";
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.35, r * 0.55);
    ctx.lineTo(0, r * 0.35);
    ctx.lineTo(-r * 0.35, r * 0.55);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, "#e8f2ff");
    g.addColorStop(1, "#6a9fcc");
    ctx.fillStyle = g;
    ctx.fill();

    // cockpit
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.25, r * 0.18, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#2a5070";
    ctx.fill();

    // engine flame
    if (running) {
      var flick = 0.7 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, r * 0.35);
      ctx.lineTo(0, r * (0.7 + flick * 0.35));
      ctx.lineTo(r * 0.12, r * 0.35);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 180, 80, 0.85)";
      ctx.fill();
    }

    ctx.restore();
  }

  function drawEnemy(en) {
    ctx.save();
    ctx.translate(en.x, en.y);
    var r = en.r;

    if (en.kind === 0) {
      // small blob
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = en.color;
      ctx.fill();
      ctx.fillStyle = "#1a1010";
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.arc(r * 0.28, -r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.beginPath();
      ctx.arc(0, r * 0.25, r * 0.35, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (en.kind === 1) {
      // spiked
      ctx.beginPath();
      for (var i = 0; i < 8; i++) {
        var a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        var rr = i % 2 === 0 ? r : r * 0.55;
        var px = Math.cos(a) * rr;
        var py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = en.color;
      ctx.fill();
      ctx.fillStyle = "#201010";
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.05, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.22, -r * 0.05, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // boss-ish hex
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var ang = (k / 6) * Math.PI * 2;
        var hx = Math.cos(ang) * r;
        var hy = Math.sin(ang) * r;
        if (k === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fillStyle = en.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.stroke();
      // hp bar
      var bw = r * 1.4;
      var pct = en.hp / en.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-bw / 2, -r - 8 * devicePixelRatio, bw, 4 * devicePixelRatio);
      ctx.fillStyle = "#e0c060";
      ctx.fillRect(-bw / 2, -r - 8 * devicePixelRatio, bw * pct, 4 * devicePixelRatio);
      ctx.fillStyle = "#1a1018";
      ctx.beginPath();
      ctx.arc(-r * 0.25, 0, r * 0.16, 0, Math.PI * 2);
      ctx.arc(r * 0.25, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b1420");
    bg.addColorStop(1, "#05080e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      ctx.globalAlpha = st.a;
      ctx.fillStyle = "#c8d8f0";
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    for (var b = 0; b < bullets.length; b++) {
      var bl = bullets[b];
      ctx.beginPath();
      ctx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffe08a";
      ctx.fill();
      ctx.fillStyle = "rgba(255, 220, 120, 0.35)";
      ctx.beginPath();
      ctx.arc(bl.x, bl.y + 6 * devicePixelRatio, bl.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var e = 0; e < enemies.length; e++) drawEnemy(enemies[e]);

    if (player) drawPlane(player.x, player.y, player.r, invuln > 0);

    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (!last) last = now;
    var dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    RoomAudio.resume();
    if (gameOver) return;
    pointerDown = true;
    var p = pointerPos(e);
    pointerX = p.x;
    pointerY = Math.max(H * 0.45, p.y);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!pointerDown) return;
    e.preventDefault();
    var p = pointerPos(e);
    pointerX = p.x;
    pointerY = Math.max(H * 0.45, p.y);
  });
  canvas.addEventListener("pointerup", function (e) {
    pointerDown = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  });
  canvas.addEventListener("pointercancel", function () {
    pointerDown = false;
  });

  window.addEventListener("keydown", function (e) {
    RoomAudio.resume();
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = true;
    if (e.code === "Space" && gameOver) {
      e.preventDefault();
      reset();
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = false;
  });

  again.addEventListener("click", reset);
  retry.addEventListener("click", reset);
  window.addEventListener("resize", resize);

  resize();
  requestAnimationFrame(loop);
})();
