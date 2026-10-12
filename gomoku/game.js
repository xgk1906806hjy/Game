(function () {
  "use strict";

  var SIZE = 15;
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var retry = document.getElementById("retry");
  var undoBtn = document.getElementById("undo");
  var modeBar = document.getElementById("modeBar");
  var turnEl = document.getElementById("turn");
  var blackWinsEl = document.getElementById("blackWins");
  var whiteWinsEl = document.getElementById("whiteWins");
  var overlay = document.getElementById("overlay");
  var overTitle = document.getElementById("overTitle");

  var W = 0;
  var H = 0;
  var boardPx = 0;
  var originX = 0;
  var originY = 0;
  var gap = 0;
  var pad = 0;

  var board = [];
  var turn = BLACK;
  var history = [];
  var winner = EMPTY;
  var winLine = null;
  var hover = null;
  var mode = "pvp"; // pvp | ai
  var thinking = false;
  var blackWins = 0;
  var whiteWins = 0;
  var lastMove = null;

  try {
    blackWins = parseInt(localStorage.getItem("gomokuBlack") || "0", 10) || 0;
    whiteWins = parseInt(localStorage.getItem("gomokuWhite") || "0", 10) || 0;
    var savedMode = localStorage.getItem("gomokuMode");
    if (savedMode === "ai" || savedMode === "pvp") mode = savedMode;
  } catch (e) {}

  function emptyBoard() {
    board = [];
    for (var y = 0; y < SIZE; y++) {
      board[y] = [];
      for (var x = 0; x < SIZE; x++) board[y][x] = EMPTY;
    }
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    boardPx = Math.floor(Math.min(W, H) * 0.86);
    gap = boardPx / (SIZE - 1);
    pad = gap * 0.7;
    originX = Math.floor((W - boardPx) / 2);
    originY = Math.floor((H - boardPx) / 2 + 8 * devicePixelRatio);
    if (!board.length) reset(false);
  }

  function reset(keepScore) {
    emptyBoard();
    turn = BLACK;
    history = [];
    winner = EMPTY;
    winLine = null;
    hover = null;
    thinking = false;
    lastMove = null;
    overlay.hidden = true;
    document.body.classList.remove("dimmed");
    if (!keepScore) {
      // keep wins across rematches in session; only mode switch resets visually
    }
    updateHud();
    syncModeButtons();
  }

  function syncModeButtons() {
    var chips = modeBar.querySelectorAll(".gomoku-chip");
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      if (chip.getAttribute("data-mode") === mode) chip.classList.add("is-active");
      else chip.classList.remove("is-active");
    }
  }

  function updateHud() {
    blackWinsEl.textContent = String(blackWins);
    whiteWinsEl.textContent = String(whiteWins);
    if (winner) {
      turnEl.textContent = winner === BLACK ? "黑棋胜" : "白棋胜";
      return;
    }
    if (thinking) {
      turnEl.textContent = "电脑思考中…";
      return;
    }
    if (mode === "ai") {
      turnEl.textContent = turn === BLACK ? "轮到你（黑）" : "电脑（白）";
    } else {
      turnEl.textContent = turn === BLACK ? "黑棋落子" : "白棋落子";
    }
  }

  function saveWins() {
    try {
      localStorage.setItem("gomokuBlack", String(blackWins));
      localStorage.setItem("gomokuWhite", String(whiteWins));
    } catch (e) {}
  }

  function pointerToCell(e) {
    var rect = canvas.getBoundingClientRect();
    var px = ((e.clientX - rect.left) / rect.width) * W;
    var py = ((e.clientY - rect.top) / rect.height) * H;
    var x = Math.round((px - originX) / gap);
    var y = Math.round((py - originY) / gap);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    // snap only if close enough
    var cx = originX + x * gap;
    var cy = originY + y * gap;
    if (Math.hypot(px - cx, py - cy) > gap * 0.42) return null;
    return { x: x, y: y };
  }

  function countDir(x, y, dx, dy, color) {
    var n = 0;
    var cx = x + dx;
    var cy = y + dy;
    while (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === color) {
      n++;
      cx += dx;
      cy += dy;
    }
    return n;
  }

  function checkWin(x, y, color) {
    var dirs = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    for (var i = 0; i < dirs.length; i++) {
      var dx = dirs[i][0];
      var dy = dirs[i][1];
      var a = countDir(x, y, dx, dy, color);
      var b = countDir(x, y, -dx, -dy, color);
      if (a + b + 1 >= 5) {
        var line = [];
        var sx = x - dx * b;
        var sy = y - dy * b;
        for (var k = 0; k < a + b + 1; k++) {
          line.push({ x: sx + dx * k, y: sy + dy * k });
        }
        return line;
      }
    }
    return null;
  }

  function place(x, y, color) {
    if (winner || board[y][x] !== EMPTY) return false;
    board[y][x] = color;
    history.push({ x: x, y: y, color: color });
    lastMove = { x: x, y: y };
    RoomAudio.click();
    var line = checkWin(x, y, color);
    if (line) {
      winner = color;
      winLine = line;
      if (color === BLACK) blackWins++;
      else whiteWins++;
      saveWins();
      overTitle.textContent = color === BLACK ? "黑棋胜" : "白棋胜";
      overlay.hidden = false;
      document.body.classList.add("dimmed");
      RoomAudio.bounce(0.7);
      updateHud();
      return true;
    }
    // draw?
    if (history.length >= SIZE * SIZE) {
      winner = -1;
      overTitle.textContent = "和棋";
      overlay.hidden = false;
      document.body.classList.add("dimmed");
      updateHud();
      return true;
    }
    turn = color === BLACK ? WHITE : BLACK;
    updateHud();
    return true;
  }

  function undo() {
    if (thinking || !history.length || winner) return;
    var steps = mode === "ai" ? 2 : 1;
    for (var i = 0; i < steps; i++) {
      if (!history.length) break;
      var m = history.pop();
      board[m.y][m.x] = EMPTY;
      turn = m.color;
    }
    lastMove = history.length ? history[history.length - 1] : null;
    winner = EMPTY;
    winLine = null;
    overlay.hidden = true;
    document.body.classList.remove("dimmed");
    updateHud();
    RoomAudio.crackle(0.3);
  }

  // --- simple AI ---
  function scoreLine(count, openEnds, isMine) {
    if (count >= 5) return 100000;
    var w = isMine ? 1 : 1.05;
    if (count === 4 && openEnds === 2) return 10000 * w;
    if (count === 4 && openEnds === 1) return 2000 * w;
    if (count === 3 && openEnds === 2) return 1000 * w;
    if (count === 3 && openEnds === 1) return 150 * w;
    if (count === 2 && openEnds === 2) return 80 * w;
    if (count === 2 && openEnds === 1) return 20 * w;
    if (count === 1 && openEnds === 2) return 10 * w;
    return openEnds > 0 ? 2 * w : 0;
  }

  function evalPoint(x, y, color) {
    var dirs = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    var total = 0;
    for (var i = 0; i < dirs.length; i++) {
      var dx = dirs[i][0];
      var dy = dirs[i][1];
      var count = 1;
      var open = 0;

      var cx = x + dx;
      var cy = y + dy;
      while (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === color) {
        count++;
        cx += dx;
        cy += dy;
      }
      if (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === EMPTY) open++;

      cx = x - dx;
      cy = y - dy;
      while (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === color) {
        count++;
        cx -= dx;
        cy -= dy;
      }
      if (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === EMPTY) open++;

      total += scoreLine(count, open, color === WHITE);
    }
    // prefer center a bit
    var dist = Math.abs(x - 7) + Math.abs(y - 7);
    total += (14 - dist) * 0.4;
    return total;
  }

  function hasNeighbor(x, y) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx;
        var ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        if (board[ny][nx] !== EMPTY) return true;
      }
    }
    return false;
  }

  function aiMove() {
    if (winner || mode !== "ai" || turn !== WHITE) return;
    thinking = true;
    updateHud();

    setTimeout(function () {
      var best = null;
      var bestScore = -1;
      // opening
      if (!history.length) {
        best = { x: 7, y: 7 };
      } else {
        for (var y = 0; y < SIZE; y++) {
          for (var x = 0; x < SIZE; x++) {
            if (board[y][x] !== EMPTY) continue;
            if (history.length > 0 && !hasNeighbor(x, y)) continue;
            var attack = evalPoint(x, y, WHITE);
            var defend = evalPoint(x, y, BLACK);
            var s = attack + defend * 1.1;
            if (s > bestScore) {
              bestScore = s;
              best = { x: x, y: y };
            }
          }
        }
      }
      thinking = false;
      if (best) place(best.x, best.y, WHITE);
      updateHud();
    }, 220 + Math.random() * 180);
  }

  function tryHumanPlace(cell) {
    if (!cell || winner || thinking) return;
    if (mode === "ai" && turn !== BLACK) return;
    if (board[cell.y][cell.x] !== EMPTY) return;
    RoomAudio.resume();
    var color = turn;
    if (!place(cell.x, cell.y, color)) return;
    if (!winner && mode === "ai" && turn === WHITE) aiMove();
  }

  function drawBoard() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1c1814");
    bg.addColorStop(1, "#100e0b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // wooden panel
    var panel = pad;
    var gx = originX - panel;
    var gy = originY - panel;
    var gw = boardPx + panel * 2;
    var gh = boardPx + panel * 2;
    var wood = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
    wood.addColorStop(0, "#c4a06a");
    wood.addColorStop(0.5, "#b08a52");
    wood.addColorStop(1, "#8f6c3c");
    roundRect(gx, gy, gw, gh, 14 * devicePixelRatio);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 40, 20, 0.35)";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.stroke();

    // grain
    ctx.strokeStyle = "rgba(80, 50, 20, 0.08)";
    ctx.lineWidth = 1;
    for (var g = 0; g < 8; g++) {
      ctx.beginPath();
      ctx.moveTo(gx + 10, gy + (g + 1) * (gh / 9));
      ctx.bezierCurveTo(
        gx + gw * 0.35,
        gy + (g + 1) * (gh / 9) + 6,
        gx + gw * 0.65,
        gy + (g + 1) * (gh / 9) - 6,
        gx + gw - 10,
        gy + (g + 1) * (gh / 9)
      );
      ctx.stroke();
    }

    // grid lines
    ctx.strokeStyle = "rgba(40, 28, 14, 0.55)";
    ctx.lineWidth = 1.2 * devicePixelRatio;
    for (var i = 0; i < SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(originX, originY + i * gap);
      ctx.lineTo(originX + boardPx, originY + i * gap);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(originX + i * gap, originY);
      ctx.lineTo(originX + i * gap, originY + boardPx);
      ctx.stroke();
    }

    // star points
    var stars = [
      [3, 3],
      [3, 11],
      [11, 3],
      [11, 11],
      [7, 7],
    ];
    ctx.fillStyle = "rgba(40, 28, 14, 0.7)";
    for (var s = 0; s < stars.length; s++) {
      ctx.beginPath();
      ctx.arc(originX + stars[s][0] * gap, originY + stars[s][1] * gap, 3.2 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }

    // hover ghost
    if (hover && !winner && !thinking && board[hover.y][hover.x] === EMPTY) {
      if (!(mode === "ai" && turn !== BLACK)) {
        drawStone(hover.x, hover.y, turn, 0.35);
      }
    }

    // stones
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (board[y][x] !== EMPTY) drawStone(x, y, board[y][x], 1);
      }
    }

    // last move mark
    if (lastMove) {
      ctx.beginPath();
      ctx.arc(
        originX + lastMove.x * gap,
        originY + lastMove.y * gap,
        gap * 0.12,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = board[lastMove.y][lastMove.x] === BLACK ? "#e0c060" : "#c45c4a";
      ctx.fill();
    }

    // win line
    if (winLine && winLine.length) {
      ctx.strokeStyle = "rgba(224, 192, 96, 0.85)";
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(originX + winLine[0].x * gap, originY + winLine[0].y * gap);
      ctx.lineTo(
        originX + winLine[winLine.length - 1].x * gap,
        originY + winLine[winLine.length - 1].y * gap
      );
      ctx.stroke();
    }
  }

  function drawStone(x, y, color, alpha) {
    var cx = originX + x * gap;
    var cy = originY + y * gap;
    var r = gap * 0.42;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx + 1.5 * devicePixelRatio, cy + 2 * devicePixelRatio, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();

    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    if (color === BLACK) {
      g.addColorStop(0, "#5a5a5a");
      g.addColorStop(0.55, "#1a1a1a");
      g.addColorStop(1, "#050505");
    } else {
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, "#e8e0d4");
      g.addColorStop(1, "#c8b8a0");
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalAlpha = 1;
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

  function loop() {
    drawBoard();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    tryHumanPlace(pointerToCell(e));
  });
  canvas.addEventListener("pointermove", function (e) {
    hover = pointerToCell(e);
  });
  canvas.addEventListener("pointerleave", function () {
    hover = null;
  });

  modeBar.addEventListener("click", function (e) {
    var chip = e.target.closest(".gomoku-chip");
    if (!chip) return;
    mode = chip.getAttribute("data-mode");
    try {
      localStorage.setItem("gomokuMode", mode);
    } catch (err) {}
    reset(true);
    RoomAudio.resume();
  });

  undoBtn.addEventListener("click", undo);
  again.addEventListener("click", function () {
    reset(true);
  });
  retry.addEventListener("click", function () {
    reset(true);
  });
  window.addEventListener("resize", resize);

  resize();
  updateHud();
  requestAnimationFrame(loop);
})();
