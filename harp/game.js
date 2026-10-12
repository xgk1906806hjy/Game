(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");

  var NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25];
  var COLORS = ["#e07070", "#e09860", "#e0c060", "#90c070", "#60b8a0", "#60a0d0", "#7080d0", "#a070d0", "#d070b0", "#e07090"];
  var W = 0;
  var H = 0;
  var strings = [];
  var dragging = false;
  var lastX = null;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    buildStrings();
  }

  function buildStrings() {
    strings = [];
    var n = NOTES.length;
    var left = W * 0.12;
    var right = W * 0.88;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      strings.push({
        x: left + t * (right - left),
        freq: NOTES[i],
        color: COLORS[i],
        amp: 0,
        phase: 0,
        hitCool: 0,
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

  function pluckNear(x, fromX) {
    for (var i = 0; i < strings.length; i++) {
      var s = strings[i];
      if (s.hitCool > 0) continue;
      var crossed =
        fromX != null &&
        ((fromX < s.x && x >= s.x) || (fromX > s.x && x <= s.x));
      var near = Math.abs(x - s.x) < 10 * devicePixelRatio;
      if (crossed || near) {
        s.amp = 1;
        s.phase = 0;
        s.hitCool = 8;
        RoomAudio.pluck(s.freq);
        if (!crossed) break;
      }
    }
  }

  function down(e) {
    e.preventDefault();
    RoomAudio.resume();
    dragging = true;
    var p = pointerPos(e);
    lastX = p.x;
    pluckNear(p.x, null);
    canvas.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!dragging) return;
    e.preventDefault();
    var p = pointerPos(e);
    pluckNear(p.x, lastX);
    lastX = p.x;
  }

  function up(e) {
    dragging = false;
    lastX = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a1420");
    bg.addColorStop(1, "#0e0b12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // harp frame
    ctx.strokeStyle = "#c9b896";
    ctx.lineWidth = 8 * devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.12);
    ctx.quadraticCurveTo(W * 0.5, H * 0.02, W * 0.92, H * 0.18);
    ctx.lineTo(W * 0.88, H * 0.88);
    ctx.quadraticCurveTo(W * 0.5, H * 0.95, W * 0.1, H * 0.85);
    ctx.closePath();
    ctx.stroke();

    var topY = H * 0.16;
    var botY = H * 0.84;

    for (var i = 0; i < strings.length; i++) {
      var s = strings[i];
      if (s.hitCool > 0) s.hitCool--;
      s.phase += 0.55;
      s.amp *= 0.965;

      ctx.beginPath();
      var steps = 28;
      for (var k = 0; k <= steps; k++) {
        var t = k / steps;
        var y = topY + t * (botY - topY);
        var wave = Math.sin(t * Math.PI) * Math.sin(s.phase) * s.amp * 14 * devicePixelRatio;
        var x = s.x + wave;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 0.45 + s.amp * 0.55;
      ctx.lineWidth = (2 + s.amp * 2) * devicePixelRatio;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (s.amp > 0.15) {
        ctx.beginPath();
        ctx.arc(s.x, (topY + botY) / 2, s.amp * 18 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255," + s.amp * 0.08 + ")";
        ctx.fill();
      }
    }
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
    for (var i = 0; i < strings.length; i++) strings[i].amp = 0;
  });
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
