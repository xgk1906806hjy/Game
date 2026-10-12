(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");

  var W = 0;
  var H = 0;
  var scene = null;
  var fog = null;
  var fogCtx = null;
  var wiping = false;
  var last = null;
  var noiseTile = null;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    buildScene();
    resetFog();
  }

  function buildNoise() {
    noiseTile = document.createElement("canvas");
    noiseTile.width = 128;
    noiseTile.height = 128;
    var nctx = noiseTile.getContext("2d");
    var img = nctx.createImageData(128, 128);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 200 + Math.random() * 40;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v + 8;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }

  function buildScene() {
    scene = document.createElement("canvas");
    scene.width = W;
    scene.height = H;
    var s = scene.getContext("2d");

    // night sky
    var sky = s.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b1220");
    sky.addColorStop(0.55, "#152238");
    sky.addColorStop(1, "#1a2030");
    s.fillStyle = sky;
    s.fillRect(0, 0, W, H);

    // distant lights
    for (var i = 0; i < 18; i++) {
      var lx = Math.random() * W;
      var ly = H * (0.25 + Math.random() * 0.35);
      s.beginPath();
      s.arc(lx, ly, (1 + Math.random() * 2) * devicePixelRatio, 0, Math.PI * 2);
      s.fillStyle = "rgba(255, 210, 140, " + (0.25 + Math.random() * 0.4) + ")";
      s.fill();
    }

    // rain lines
    s.strokeStyle = "rgba(180, 200, 230, 0.18)";
    s.lineWidth = 1 * devicePixelRatio;
    for (var r = 0; r < 60; r++) {
      var rx = Math.random() * W;
      var ry = Math.random() * H;
      s.beginPath();
      s.moveTo(rx, ry);
      s.lineTo(rx - 4 * devicePixelRatio, ry + 18 * devicePixelRatio);
      s.stroke();
    }

    // window frame
    var margin = Math.min(W, H) * 0.08;
    s.strokeStyle = "#3a3228";
    s.lineWidth = 14 * devicePixelRatio;
    s.strokeRect(margin, margin, W - margin * 2, H - margin * 2);
    s.beginPath();
    s.moveTo(W * 0.5, margin);
    s.lineTo(W * 0.5, H - margin);
    s.moveTo(margin, H * 0.48);
    s.lineTo(W - margin, H * 0.48);
    s.strokeStyle = "#2e281f";
    s.lineWidth = 10 * devicePixelRatio;
    s.stroke();

    // sill
    s.fillStyle = "#2a241c";
    s.fillRect(margin - 8 * devicePixelRatio, H - margin - 8 * devicePixelRatio, W - margin * 2 + 16 * devicePixelRatio, 18 * devicePixelRatio);

    // cat silhouette on sill
    var catX = W * 0.68;
    var catY = H - margin - 10 * devicePixelRatio;
    s.fillStyle = "#0a0a0c";
    s.beginPath();
    s.ellipse(catX, catY - 18 * devicePixelRatio, 28 * devicePixelRatio, 16 * devicePixelRatio, 0, 0, Math.PI * 2);
    s.fill();
    // head
    s.beginPath();
    s.arc(catX - 28 * devicePixelRatio, catY - 28 * devicePixelRatio, 12 * devicePixelRatio, 0, Math.PI * 2);
    s.fill();
    // ears
    s.beginPath();
    s.moveTo(catX - 38 * devicePixelRatio, catY - 34 * devicePixelRatio);
    s.lineTo(catX - 34 * devicePixelRatio, catY - 48 * devicePixelRatio);
    s.lineTo(catX - 28 * devicePixelRatio, catY - 36 * devicePixelRatio);
    s.fill();
    s.beginPath();
    s.moveTo(catX - 26 * devicePixelRatio, catY - 36 * devicePixelRatio);
    s.lineTo(catX - 20 * devicePixelRatio, catY - 48 * devicePixelRatio);
    s.lineTo(catX - 16 * devicePixelRatio, catY - 32 * devicePixelRatio);
    s.fill();
    // tail
    s.beginPath();
    s.moveTo(catX + 24 * devicePixelRatio, catY - 16 * devicePixelRatio);
    s.quadraticCurveTo(
      catX + 50 * devicePixelRatio,
      catY - 50 * devicePixelRatio,
      catX + 40 * devicePixelRatio,
      catY - 70 * devicePixelRatio
    );
    s.strokeStyle = "#0a0a0c";
    s.lineWidth = 5 * devicePixelRatio;
    s.lineCap = "round";
    s.stroke();
  }

  function resetFog() {
    if (!noiseTile) buildNoise();
    fog = document.createElement("canvas");
    fog.width = W;
    fog.height = H;
    fogCtx = fog.getContext("2d");
    fogCtx.globalAlpha = 1;
    var pattern = fogCtx.createPattern(noiseTile, "repeat");
    fogCtx.fillStyle = pattern;
    fogCtx.fillRect(0, 0, W, H);
    fogCtx.fillStyle = "rgba(210, 215, 220, 0.55)";
    fogCtx.fillRect(0, 0, W, H);
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function wipe(x, y) {
    var radius = 28 * devicePixelRatio;
    var g = fogCtx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    fogCtx.globalCompositeOperation = "destination-out";
    fogCtx.fillStyle = g;
    fogCtx.beginPath();
    fogCtx.arc(x, y, radius, 0, Math.PI * 2);
    fogCtx.fill();
    fogCtx.globalCompositeOperation = "source-over";
  }

  function down(e) {
    e.preventDefault();
    RoomAudio.resume();
    wiping = true;
    last = pointerPos(e);
    wipe(last.x, last.y);
    canvas.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!wiping) return;
    e.preventDefault();
    var p = pointerPos(e);
    if (last) {
      var dx = p.x - last.x;
      var dy = p.y - last.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var steps = Math.max(1, Math.floor(dist / (8 * devicePixelRatio)));
      for (var i = 1; i <= steps; i++) {
        wipe(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
      }
    }
    last = p;
  }

  function up(e) {
    wiping = false;
    last = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  function regrowFog() {
    fogCtx.globalAlpha = 0.018;
    var pattern = fogCtx.createPattern(noiseTile, "repeat");
    fogCtx.fillStyle = pattern;
    fogCtx.fillRect(0, 0, W, H);
    fogCtx.fillStyle = "rgba(210, 215, 220, 0.012)";
    fogCtx.fillRect(0, 0, W, H);
    fogCtx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(scene, 0, 0);
    regrowFog();
    ctx.drawImage(fog, 0, 0);

    // glass reflection
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(0, 0, W * 0.35, H);
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  again.addEventListener("click", resetFog);
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
