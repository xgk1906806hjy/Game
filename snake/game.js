(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var retry = document.getElementById("retry");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var bestFinal = document.getElementById("bestFinal");
  var bestPanel = document.getElementById("bestPanel");
  var finalEl = document.getElementById("final");
  var overlay = document.getElementById("overlay");
  var overTitle = document.getElementById("overTitle");
  var pad = document.getElementById("pad");
  var speedBar = document.getElementById("speedBar");
  var recordsBtn = document.getElementById("recordsBtn");
  var recordsPanel = document.getElementById("recordsPanel");
  var recordsList = document.getElementById("recordsList");
  var closeRecords = document.getElementById("closeRecords");
  var clearRecords = document.getElementById("clearRecords");

  var COLS = 18;
  var ROWS = 14;
  var SPEED_MS = [220, 140, 95, 60];
  var SPEED_NAMES = ["慢", "中", "快", "极速"];
  var SPEED_KEY = "snakeSpeed";
  var BEST_KEY = "snakeBest";
  var RECORDS_KEY = "snakeRecords";
  var MAX_RECORDS = 20;

  var W = 0;
  var H = 0;
  var cell = 0;
  var ox = 0;
  var oy = 0;

  var snake = [];
  var dir = { x: 1, y: 0 };
  var nextDir = { x: 1, y: 0 };
  var food = null;
  var score = 0;
  var best = 0;
  var records = [];
  var speedLevel = 1;
  var running = false;
  var gameOver = false;
  var tickAcc = 0;
  var stepMs = SPEED_MS[1];
  var eatPulse = 0;
  var particles = [];
  var touchStart = null;

  function loadStore() {
    try {
      best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
      var s = parseInt(localStorage.getItem(SPEED_KEY) || "1", 10);
      if (s >= 0 && s <= 3) speedLevel = s;
      var raw = localStorage.getItem(RECORDS_KEY);
      records = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(records)) records = [];
    } catch (e) {
      best = 0;
      records = [];
      speedLevel = 1;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (e) {}
  }

  function saveSpeed() {
    try {
      localStorage.setItem(SPEED_KEY, String(speedLevel));
    } catch (e) {}
  }

  function saveRecords() {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
    } catch (e) {}
  }

  function applySpeed() {
    stepMs = SPEED_MS[speedLevel];
    var buttons = speedBar.querySelectorAll(".snake-speed-btn");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var level = parseInt(btn.getAttribute("data-speed"), 10);
      if (level === speedLevel) btn.classList.add("is-active");
      else btn.classList.remove("is-active");
    }
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var hh = d.getHours();
    var mm = d.getMinutes();
    function pad2(n) {
      return n < 10 ? "0" + n : String(n);
    }
    return m + "/" + day + " " + pad2(hh) + ":" + pad2(mm);
  }

  function renderRecords() {
    bestPanel.textContent = String(best);
    bestEl.textContent = String(best);
    bestFinal.textContent = String(best);
    if (!records.length) {
      recordsList.innerHTML = '<li class="empty">还没有成绩，玩一局再来看</li>';
      return;
    }
    var html = "";
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      html +=
        "<li>" +
        '<span class="rank">' +
        (i + 1) +
        "</span>" +
        "<span>" +
        formatTime(r.t) +
        "</span>" +
        '<span class="spd">' +
        (SPEED_NAMES[r.speed] || "中") +
        "</span>" +
        '<span class="pts">' +
        r.score +
        "</span>" +
        "</li>";
    }
    recordsList.innerHTML = html;
  }

  function addRecord(finalScore) {
    if (finalScore <= 0) return;
    records.unshift({
      score: finalScore,
      speed: speedLevel,
      t: Date.now(),
    });
    records = records.slice(0, MAX_RECORDS);
    saveRecords();
    renderRecords();
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    cell = Math.floor(Math.min(W / (COLS + 1.5), H / (ROWS + 1.5)));
    ox = Math.floor((W - COLS * cell) / 2);
    oy = Math.floor((H - ROWS * cell) / 2);
    if (!snake.length) reset();
  }

  function reset() {
    var cx = Math.floor(COLS / 2);
    var cy = Math.floor(ROWS / 2);
    snake = [
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
      { x: cx - 3, y: cy },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    running = true;
    gameOver = false;
    tickAcc = 0;
    eatPulse = 0;
    particles = [];
    applySpeed();
    placeFood();
    scoreEl.textContent = "0";
    bestEl.textContent = String(best);
    bestFinal.textContent = String(best);
    overlay.hidden = true;
    recordsPanel.hidden = true;
    document.body.classList.remove("dimmed");
  }

  function placeFood() {
    var empty = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!onSnake(x, y)) empty.push({ x: x, y: y });
      }
    }
    if (!empty.length) {
      win();
      return;
    }
    food = empty[Math.floor(Math.random() * empty.length)];
  }

  function onSnake(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function setDir(nx, ny) {
    if (gameOver || !running) return;
    if (nx === -dir.x && ny === -dir.y) return;
    if (nx === 0 && ny === 0) return;
    nextDir = { x: nx, y: ny };
    RoomAudio.resume();
  }

  function end(reason) {
    running = false;
    gameOver = true;
    addRecord(score);
    if (score > best) {
      best = score;
      saveBest();
    }
    overTitle.textContent = reason || "撞到了";
    finalEl.textContent = String(score);
    bestEl.textContent = String(best);
    bestFinal.textContent = String(best);
    bestPanel.textContent = String(best);
    overlay.hidden = false;
    document.body.classList.add("dimmed");
    RoomAudio.thud(0.7);
  }

  function win() {
    end("全吃光了");
    RoomAudio.click();
  }

  function burst(gx, gy) {
    var px = ox + gx * cell + cell / 2;
    var py = oy + gy * cell + cell / 2;
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (1 + Math.random() * 2.5) * devicePixelRatio;
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        s: (1.5 + Math.random() * 2) * devicePixelRatio,
      });
    }
  }

  function step() {
    dir = { x: nextDir.x, y: nextDir.y };
    var head = snake[0];
    var nx = head.x + dir.x;
    var ny = head.y + dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      end("撞墙了");
      return;
    }
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        end("咬到自己了");
        return;
      }
    }

    snake.unshift({ x: nx, y: ny });
    if (food && nx === food.x && ny === food.y) {
      // faster modes score a bit more per food
      var gain = 10 + speedLevel * 2;
      score += gain;
      scoreEl.textContent = String(score);
      eatPulse = 1;
      burst(nx, ny);
      RoomAudio.bounce(0.55);
      placeFood();
    } else {
      snake.pop();
    }
  }

  function update(dt) {
    eatPulse = Math.max(0, eatPulse - dt * 3);

    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= dt * 2.5;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    if (!running) return;
    tickAcc += dt * 1000;
    while (tickAcc >= stepMs) {
      tickAcc -= stepMs;
      step();
      if (!running) break;
    }
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#141a12");
    bg.addColorStop(1, "#0a0e0a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    roundRect(
      ox - 6 * devicePixelRatio,
      oy - 6 * devicePixelRatio,
      COLS * cell + 12 * devicePixelRatio,
      ROWS * cell + 12 * devicePixelRatio,
      12 * devicePixelRatio
    );
    ctx.fillStyle = "#182016";
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 190, 130, 0.18)";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(ox + gx * cell, oy);
      ctx.lineTo(ox + gx * cell, oy + ROWS * cell);
      ctx.stroke();
    }
    for (var gy = 0; gy <= ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + gy * cell);
      ctx.lineTo(ox + COLS * cell, oy + gy * cell);
      ctx.stroke();
    }

    if (food) {
      var fx = ox + food.x * cell;
      var fy = oy + food.y * cell;
      var foodPad = cell * 0.18;
      var pulse = 1 + eatPulse * 0.15;
      var fs = (cell - foodPad * 2) * pulse;
      var fox = fx + (cell - fs) / 2;
      var foy = fy + (cell - fs) / 2;
      roundRect(fox, foy, fs, fs, cell * 0.28);
      var fg = ctx.createRadialGradient(fox + fs * 0.3, foy + fs * 0.3, 2, fox + fs / 2, foy + fs / 2, fs / 2);
      fg.addColorStop(0, "#ffe08a");
      fg.addColorStop(1, "#d07040");
      ctx.fillStyle = fg;
      ctx.fill();
    }

    for (var i = snake.length - 1; i >= 0; i--) {
      var s = snake[i];
      var sx = ox + s.x * cell;
      var sy = oy + s.y * cell;
      var inset = cell * (i === 0 ? 0.1 : 0.16);
      var t = 1 - i / Math.max(1, snake.length);
      roundRect(sx + inset, sy + inset, cell - inset * 2, cell - inset * 2, cell * 0.28);
      if (i === 0) {
        ctx.fillStyle = "#c8e090";
      } else {
        var shade = Math.floor(70 + t * 50);
        ctx.fillStyle = "rgb(" + shade + "," + (shade + 40) + "," + (shade - 20) + ")";
      }
      ctx.fill();

      if (i === 0) {
        var ex = sx + cell / 2 + dir.x * cell * 0.12;
        var ey = sy + cell / 2 + dir.y * cell * 0.12;
        var ox1 = dir.y !== 0 ? cell * 0.16 : 0;
        var oy1 = dir.x !== 0 ? cell * 0.16 : 0;
        ctx.fillStyle = "#1a2414";
        ctx.beginPath();
        ctx.arc(ex - ox1, ey - oy1, cell * 0.08, 0, Math.PI * 2);
        ctx.arc(ex + ox1, ey + oy1, cell * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = "#e0c060";
      ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
    }
    ctx.globalAlpha = 1;
  }

  var last = 0;
  function loop(now) {
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", function (e) {
    var code = e.code;
    if (code === "ArrowUp" || code === "KeyW") {
      e.preventDefault();
      setDir(0, -1);
    } else if (code === "ArrowDown" || code === "KeyS") {
      e.preventDefault();
      setDir(0, 1);
    } else if (code === "ArrowLeft" || code === "KeyA") {
      e.preventDefault();
      setDir(-1, 0);
    } else if (code === "ArrowRight" || code === "KeyD") {
      e.preventDefault();
      setDir(1, 0);
    } else if (code === "Space" && gameOver) {
      e.preventDefault();
      reset();
    } else if (code === "Digit1") {
      setSpeed(0);
    } else if (code === "Digit2") {
      setSpeed(1);
    } else if (code === "Digit3") {
      setSpeed(2);
    } else if (code === "Digit4") {
      setSpeed(3);
    }
  });

  function setSpeed(level) {
    if (level < 0 || level > 3) return;
    speedLevel = level;
    applySpeed();
    saveSpeed();
    RoomAudio.resume();
    RoomAudio.click();
  }

  speedBar.addEventListener("click", function (e) {
    var btn = e.target.closest(".snake-speed-btn");
    if (!btn) return;
    setSpeed(parseInt(btn.getAttribute("data-speed"), 10));
  });

  pad.addEventListener("pointerdown", function (e) {
    var btn = e.target.closest("button[data-dir]");
    if (!btn) return;
    e.preventDefault();
    var d = btn.getAttribute("data-dir");
    if (d === "up") setDir(0, -1);
    if (d === "down") setDir(0, 1);
    if (d === "left") setDir(-1, 0);
    if (d === "right") setDir(1, 0);
  });

  canvas.addEventListener("pointerdown", function (e) {
    RoomAudio.resume();
    if (gameOver) return;
    var rect = canvas.getBoundingClientRect();
    touchStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!touchStart || gameOver) {
      touchStart = null;
      return;
    }
    var rect = canvas.getBoundingClientRect();
    var dx = e.clientX - rect.left - touchStart.x;
    var dy = e.clientY - rect.top - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
  });

  recordsBtn.addEventListener("click", function () {
    renderRecords();
    recordsPanel.hidden = false;
  });
  closeRecords.addEventListener("click", function () {
    recordsPanel.hidden = true;
  });
  clearRecords.addEventListener("click", function () {
    records = [];
    saveRecords();
    renderRecords();
  });

  again.addEventListener("click", reset);
  retry.addEventListener("click", reset);
  window.addEventListener("resize", resize);

  loadStore();
  applySpeed();
  renderRecords();
  resize();
  requestAnimationFrame(loop);
})();
