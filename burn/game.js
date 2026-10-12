(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var note = document.getElementById("note");
  var igniteBtn = document.getElementById("ignite");
  var statusEl = document.getElementById("status");

  var W = 0;
  var H = 0;
  var paper = { x: 0, y: 0, w: 0, h: 0 };
  var burning = false;
  var burned = false;
  var progress = 0;
  var sparks = [];
  var paperCanvas = null;
  var paperCtx = null;
  var ashNoise = null;
  var burnStartedAt = 0;
  var burnTimer = null;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    paper.w = Math.min(W * 0.62, 420 * devicePixelRatio);
    paper.h = Math.min(H * 0.62, 320 * devicePixelRatio);
    paper.x = (W - paper.w) * 0.5;
    paper.y = (H - paper.h) * 0.48;
    if (!burning && !burned) layoutUI();
  }

  function layoutUI() {
    note.classList.remove("hidden");
    igniteBtn.classList.remove("hidden");
  }

  function wrapText(context, text, maxWidth) {
    var lines = [];
    var paragraphs = String(text || "").split(/\n/);
    for (var p = 0; p < paragraphs.length; p++) {
      var str = paragraphs[p];
      if (!str) {
        lines.push("");
        continue;
      }
      var line = "";
      for (var i = 0; i < str.length; i++) {
        var test = line + str[i];
        if (context.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = str[i];
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function buildPaperTexture(text) {
    paperCanvas = document.createElement("canvas");
    paperCanvas.width = Math.ceil(paper.w);
    paperCanvas.height = Math.ceil(paper.h);
    paperCtx = paperCanvas.getContext("2d");

    paperCtx.fillStyle = "#efe6d4";
    paperCtx.fillRect(0, 0, paperCanvas.width, paperCanvas.height);

    // paper grain
    var img = paperCtx.createImageData(paperCanvas.width, paperCanvas.height);
    for (var i = 0; i < img.data.length; i += 4) {
      var n = (Math.random() - 0.5) * 18;
      img.data[i] = 239 + n;
      img.data[i + 1] = 230 + n;
      img.data[i + 2] = 212 + n;
      img.data[i + 3] = 255;
    }
    paperCtx.putImageData(img, 0, 0);

    // faint lines
    paperCtx.strokeStyle = "rgba(180, 160, 130, 0.25)";
    paperCtx.lineWidth = 1;
    for (var y = 36 * devicePixelRatio; y < paperCanvas.height; y += 22 * devicePixelRatio) {
      paperCtx.beginPath();
      paperCtx.moveTo(18 * devicePixelRatio, y);
      paperCtx.lineTo(paperCanvas.width - 18 * devicePixelRatio, y);
      paperCtx.stroke();
    }

    paperCtx.fillStyle = "#2a241c";
    paperCtx.font = 16 * devicePixelRatio + "px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', serif";
    var lines = wrapText(paperCtx, text, paperCanvas.width - 40 * devicePixelRatio);
    var ty = 40 * devicePixelRatio;
    for (var L = 0; L < lines.length; L++) {
      paperCtx.fillText(lines[L], 20 * devicePixelRatio, ty);
      ty += 22 * devicePixelRatio;
      if (ty > paperCanvas.height - 20 * devicePixelRatio) break;
    }

    ashNoise = document.createElement("canvas");
    ashNoise.width = 64;
    ashNoise.height = 64;
    var ac = ashNoise.getContext("2d");
    var aimg = ac.createImageData(64, 64);
    for (var j = 0; j < aimg.data.length; j += 4) {
      var v = 40 + Math.random() * 50;
      aimg.data[j] = v;
      aimg.data[j + 1] = v;
      aimg.data[j + 2] = v;
      aimg.data[j + 3] = 255;
    }
    ac.putImageData(aimg, 0, 0);
  }

  function startBurn() {
    if (burning || burned) return;
    RoomAudio.resume();
    var text = note.value.trim();
    if (!text) {
      note.focus();
      return;
    }
    buildPaperTexture(text);
    note.classList.add("hidden");
    igniteBtn.classList.add("hidden");
    burning = true;
    burned = false;
    progress = 0;
    sparks = [];
    burnStartedAt = performance.now();
    if (burnTimer) clearInterval(burnTimer);
    burnTimer = setInterval(function () {
      if (!burning) {
        clearInterval(burnTimer);
        burnTimer = null;
        return;
      }
      progress = Math.min(1.05, (performance.now() - burnStartedAt) / 3200);
      if (progress >= 1) finishBurn();
    }, 100);
    statusEl.classList.remove("visible");
    statusEl.textContent = "";
    document.body.classList.remove("dimmed");
  }

  function reset() {
    burning = false;
    burned = false;
    progress = 0;
    sparks = [];
    burnStartedAt = 0;
    if (burnTimer) {
      clearInterval(burnTimer);
      burnTimer = null;
    }
    paperCanvas = null;
    note.value = "";
    layoutUI();
    statusEl.classList.remove("visible");
    statusEl.textContent = "";
    document.body.classList.remove("dimmed");
    note.focus();
  }

  function frontierRadius() {
    return progress * Math.hypot(paper.w, paper.h);
  }

  function burnedSectorPath(radius, outset, startNew) {
    var cx = paper.w;
    var cy = paper.h;
    var steps = 40;
    if (startNew !== false) ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var ang = Math.PI + (Math.PI / 2) * t;
      var n =
        Math.sin(t * 17 + progress * 8) * 10 +
        Math.sin(t * 29 - progress * 11) * 6;
      var rr = Math.max(0, radius + outset + n * devicePixelRatio);
      ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    }
    ctx.closePath();
  }

  function drawPaperIdle() {
    ctx.save();
    ctx.translate(paper.x, paper.y);
    ctx.fillStyle = "#efe6d4";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 24 * devicePixelRatio;
    ctx.shadowOffsetY = 10 * devicePixelRatio;
    ctx.fillRect(0, 0, paper.w, paper.h);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(120, 100, 70, 0.2)";
    ctx.strokeRect(0.5, 0.5, paper.w - 1, paper.h - 1);
    ctx.beginPath();
    ctx.moveTo(paper.w, paper.h - 28 * devicePixelRatio);
    ctx.lineTo(paper.w, paper.h);
    ctx.lineTo(paper.w - 28 * devicePixelRatio, paper.h);
    ctx.closePath();
    ctx.fillStyle = "#e4d8c0";
    ctx.fill();
    ctx.restore();
  }

  function drawBurning() {
    if (!paperCanvas) return;
    var radius = frontierRadius();

    ctx.save();
    ctx.translate(paper.x, paper.y);
    var curl = Math.min(1, progress) * 0.08;
    ctx.transform(1, 0, curl, 1 - curl * 0.3, 0, curl * paper.h * 0.15);

    // remaining paper = full sheet minus burned sector
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, paper.w, paper.h);
    burnedSectorPath(radius, 0, false);
    ctx.clip("evenodd");
    ctx.drawImage(paperCanvas, 0, 0, paper.w, paper.h);
    ctx.restore();

    // ash residue in burned zone
    ctx.save();
    burnedSectorPath(radius, 0, true);
    ctx.clip();
    ctx.globalAlpha = 0.4;
    if (ashNoise) {
      var pattern = ctx.createPattern(ashNoise, "repeat");
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, paper.w, paper.h);
    }
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, paper.w, paper.h);
    ctx.restore();

    // char / ember edge
    ctx.save();
    burnedSectorPath(radius, 0, true);
    ctx.strokeStyle = "rgba(40, 18, 8, 0.95)";
    ctx.lineWidth = 8 * devicePixelRatio;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 140, 40, 0.55)";
    ctx.lineWidth = 2.5 * devicePixelRatio;
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    if (burning && Math.random() < 0.6) {
      var ang = Math.PI + (Math.PI / 2) * Math.random();
      var sx = paper.x + paper.w + Math.cos(ang) * radius;
      var sy = paper.y + paper.h + Math.sin(ang) * radius;
      sparks.push({
        x: sx,
        y: sy,
        vx: (Math.random() - 0.5) * 1.5 * devicePixelRatio,
        vy: -Math.random() * 2.5 * devicePixelRatio,
        life: 1,
      });
      if (Math.random() < 0.35) RoomAudio.crackle(0.4 + Math.random() * 0.4);
    }

    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life -= 0.03;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2 * devicePixelRatio * sp.life, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 160, 60, " + sp.life + ")";
      ctx.fill();
      if (sp.life <= 0) sparks.splice(s, 1);
    }

    progress = Math.min(1.05, (performance.now() - burnStartedAt) / 3200);
    if (progress >= 1) finishBurn();
  }

  function drawAshRemains() {
    if (!paperCanvas) return;
    ctx.save();
    ctx.translate(paper.x, paper.y + paper.h * 0.15);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.moveTo(paper.w * 0.05, paper.h * 0.7);
    ctx.quadraticCurveTo(paper.w * 0.3, paper.h * 0.55, paper.w * 0.55, paper.h * 0.75);
    ctx.quadraticCurveTo(paper.w * 0.8, paper.h * 0.9, paper.w * 0.95, paper.h * 0.65);
    ctx.lineTo(paper.w * 0.9, paper.h * 0.85);
    ctx.quadraticCurveTo(paper.w * 0.5, paper.h * 0.95, paper.w * 0.1, paper.h * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function finishBurn() {
    if (burned) return;
    burning = false;
    burned = true;
    progress = 1;
    if (burnTimer) {
      clearInterval(burnTimer);
      burnTimer = null;
    }
    statusEl.textContent = "放下了";
    statusEl.classList.add("visible");
    document.body.classList.add("dimmed");
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#17130f");
    bg.addColorStop(1, "#0c0a08");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // desk
    ctx.fillStyle = "#241e18";
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // wall-clock completion even if drawing throws
    if (burning && burnStartedAt && performance.now() - burnStartedAt >= 3200) {
      finishBurn();
    }

    if (!burning && !burned) {
      drawPaperIdle();
    } else if (burning) {
      try {
        drawBurning();
      } catch (err) {
        console.error(err);
      }
    } else {
      drawAshRemains();
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  window.__burnDebug = function () {
    return {
      burning: burning,
      burned: burned,
      progress: progress,
      age: burnStartedAt ? performance.now() - burnStartedAt : 0,
      status: statusEl.textContent,
    };
  };

  igniteBtn.addEventListener("click", startBurn);
  again.addEventListener("click", reset);
  window.addEventListener("resize", resize);
  note.addEventListener("pointerdown", function () {
    RoomAudio.resume();
  });

  resize();
  loop();
})();
