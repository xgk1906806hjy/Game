(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");

  var energy = 0;
  var ripples = [];
  var dragging = false;
  var lastAngle = null;
  var lastTime = 0;
  var angVelSmooth = 0;
  var steady = 0;
  var W = 0;
  var H = 0;
  var cx = 0;
  var cy = 0;
  var R = 0;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    cx = W * 0.5;
    cy = H * 0.52;
    R = Math.min(W, H) * 0.28;
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    var x = ((e.clientX - rect.left) / rect.width) * W;
    var y = ((e.clientY - rect.top) / rect.height) * H;
    return { x: x, y: y };
  }

  function onRim(p) {
    var dx = p.x - cx;
    var dy = p.y - cy;
    var d = Math.sqrt(dx * dx + dy * dy);
    return d > R * 0.72 && d < R * 1.22;
  }

  function angleOf(p) {
    return Math.atan2(p.y - cy, p.x - cx);
  }

  function wrapDelta(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function down(e) {
    e.preventDefault();
    RoomAudio.resume();
    var p = pointerPos(e);
    if (!onRim(p)) return;
    dragging = true;
    lastAngle = angleOf(p);
    lastTime = performance.now();
    canvas.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!dragging) return;
    e.preventDefault();
    var p = pointerPos(e);
    var now = performance.now();
    var dt = Math.max(0.008, (now - lastTime) / 1000);
    var ang = angleOf(p);
    var dAng = wrapDelta(ang - lastAngle);
    var angVel = Math.abs(dAng) / dt;
    angVelSmooth += (angVel - angVelSmooth) * 0.25;

    var ideal = 4.5;
    var closeness = 1 - Math.min(1, Math.abs(angVelSmooth - ideal) / ideal);
    if (onRim(p) && angVelSmooth > 1.2) {
      steady = Math.min(1, steady + closeness * dt * 0.55);
      energy = Math.min(1, energy + closeness * dt * 0.7);
      if (Math.random() < dt * 4 * energy) {
        ripples.push({ r: R * 0.15, a: 0.35 + energy * 0.4 });
      }
    } else {
      steady = Math.max(0, steady - dt * 0.8);
    }

    lastAngle = ang;
    lastTime = now;
    RoomAudio.setDrone(energy);
  }

  function up(e) {
    if (!dragging) return;
    dragging = false;
    lastAngle = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  function reset() {
    energy = 0;
    steady = 0;
    angVelSmooth = 0;
    ripples = [];
    dragging = false;
    document.body.classList.remove("dimmed");
    RoomAudio.setDrone(0);
  }

  function draw() {
    var t = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);

    var g = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R * 2.2);
    g.addColorStop(0, "#2a241c");
    g.addColorStop(1, "#12100d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // outer bowl body
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 0.08, R * 1.12, R * 0.95, 0, 0, Math.PI * 2);
    var metal = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    metal.addColorStop(0, "#8a7a5a");
    metal.addColorStop(0.45, "#c8b88a");
    metal.addColorStop(1, "#5a4c34");
    ctx.fillStyle = metal;
    ctx.fill();

    // inner water
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
    var water = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, 4, cx, cy, R * 0.82);
    water.addColorStop(0, "#4a6a78");
    water.addColorStop(1, "#1a2a34");
    ctx.fillStyle = water;
    ctx.fill();

    // rim highlight
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 236, 190, " + (0.25 + energy * 0.45) + ")";
    ctx.lineWidth = 4 * devicePixelRatio;
    ctx.stroke();

    // ripples
    for (var i = ripples.length - 1; i >= 0; i--) {
      var rp = ripples[i];
      rp.r += (0.8 + energy * 1.4) * devicePixelRatio;
      rp.a *= 0.985;
      ctx.beginPath();
      ctx.arc(cx, cy, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(190, 220, 230, " + rp.a + ")";
      ctx.lineWidth = 1.5 * devicePixelRatio;
      ctx.stroke();
      if (rp.a < 0.02 || rp.r > R * 0.8) ripples.splice(i, 1);
    }

    // soft glow when singing
    if (energy > 0.05) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1.15 + Math.sin(t * 3) * 0.02), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 220, 150, " + energy * 0.2 + ")";
      ctx.lineWidth = (6 + energy * 10) * devicePixelRatio;
      ctx.stroke();
    }

    // decay
    if (!dragging) {
      energy = Math.max(0, energy * 0.992);
      RoomAudio.setDrone(energy);
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
  again.addEventListener("click", reset);
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
