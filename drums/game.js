(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");

  var W = 0;
  var H = 0;
  var drums = [];
  var ripples = [];

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    buildDrums();
  }

  function buildDrums() {
    drums = [
      { x: W * 0.28, y: H * 0.55, r: Math.min(W, H) * 0.16, freq: 90, label: "低", press: 0, hue: 28 },
      { x: W * 0.55, y: H * 0.42, r: Math.min(W, H) * 0.12, freq: 140, label: "中", press: 0, hue: 18 },
      { x: W * 0.75, y: H * 0.58, r: Math.min(W, H) * 0.09, freq: 200, label: "高", press: 0, hue: 8 },
      { x: W * 0.42, y: H * 0.72, r: Math.min(W, H) * 0.07, freq: 280, label: "叮", press: 0, hue: 40 },
    ];
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function hit(p) {
    for (var i = drums.length - 1; i >= 0; i--) {
      var d = drums[i];
      var dx = p.x - d.x;
      var dy = p.y - d.y;
      if (dx * dx + dy * dy <= d.r * d.r) {
        d.press = 1;
        RoomAudio.drum(d.freq);
        ripples.push({
          x: p.x,
          y: p.y,
          r: 4 * devicePixelRatio,
          a: 0.7,
          color: "hsla(" + d.hue + ",70%,60%,",
        });
        return true;
      }
    }
    return false;
  }

  function down(e) {
    e.preventDefault();
    RoomAudio.resume();
    hit(pointerPos(e));
  }

  function drawDrum(d) {
    var squash = 1 - d.press * 0.12;
    var ry = d.r * squash;
    var rx = d.r * (1 + d.press * 0.06);

    // body
    ctx.beginPath();
    ctx.ellipse(d.x, d.y + d.r * 0.35, rx * 0.92, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#3a2a1c";
    ctx.fill();

    // head
    var g = ctx.createRadialGradient(
      d.x - rx * 0.25,
      d.y - ry * 0.3,
      4,
      d.x,
      d.y,
      rx
    );
    g.addColorStop(0, "hsl(" + d.hue + ", 45%, " + (62 - d.press * 10) + "%)");
    g.addColorStop(1, "hsl(" + d.hue + ", 40%, " + (38 - d.press * 6) + "%)");
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,20,0.5)";
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.stroke();

    // rim studs
    for (var i = 0; i < 10; i++) {
      var ang = (i / 10) * Math.PI * 2;
      var sx = d.x + Math.cos(ang) * rx * 0.92;
      var sy = d.y + Math.sin(ang) * ry * 0.92;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = "#c9b080";
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,240,220,0.55)";
    ctx.font = 12 * devicePixelRatio + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(d.label, d.x, d.y);

    d.press *= 0.88;
    if (d.press < 0.02) d.press = 0;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#181410");
    bg.addColorStop(1, "#0e0c0a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // floor glow
    ctx.fillStyle = "rgba(80, 50, 20, 0.15)";
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.82, W * 0.35, H * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    for (var i = 0; i < drums.length; i++) drawDrum(drums[i]);

    for (var r = ripples.length - 1; r >= 0; r--) {
      var rp = ripples[r];
      rp.r += 2.5 * devicePixelRatio;
      rp.a *= 0.92;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 220, 160, " + rp.a + ")";
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.stroke();
      if (rp.a < 0.04) ripples.splice(r, 1);
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", down);
  again.addEventListener("click", function () {
    ripples = [];
    for (var i = 0; i < drums.length; i++) drums[i].press = 0;
  });
  window.addEventListener("resize", resize);

  resize();
  loop();
})();
