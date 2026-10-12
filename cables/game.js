(function () {
  "use strict";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var again = document.getElementById("again");
  var statusEl = document.getElementById("status");

  var COLORS = ["#c45c4a", "#4a8fc4", "#c4a14a", "#6a9a6a"];
  var SEGMENTS = 18;
  var W = 0;
  var H = 0;
  var cables = [];
  var sockets = [];
  var drag = null;
  var complete = false;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.floor(rect.width * devicePixelRatio);
    H = Math.floor(rect.height * devicePixelRatio);
    canvas.width = W;
    canvas.height = H;
    if (!cables.length) reset();
    else layoutSockets();
  }

  function layoutSockets() {
    sockets = [];
    for (var i = 0; i < 4; i++) {
      sockets.push({
        x: W * 0.86,
        y: H * (0.22 + i * 0.18),
        color: COLORS[i],
        id: i,
      });
    }
  }

  function makeCable(id) {
    var points = [];
    var anchorY = H * (0.22 + id * 0.18);
    var totalLen = W * 0.7;
    var rest = totalLen / (SEGMENTS - 1);
    var endX = W * (0.4 + ((id * 0.17 + Math.random() * 0.1) % 0.35));
    var endY = H * (0.18 + ((id * 0.23 + Math.random() * 0.2) % 0.62));
    for (var i = 0; i < SEGMENTS; i++) {
      var t = i / (SEGMENTS - 1);
      var wave = Math.sin(t * Math.PI * (2.5 + id * 0.4) + id) * H * 0.1;
      var x = W * 0.12 + (endX - W * 0.12) * t + (Math.random() - 0.5) * W * 0.04;
      var y = anchorY + (endY - anchorY) * t + wave;
      points.push({
        x: x,
        y: y,
        ox: x,
        oy: y,
        pinned: i === 0,
      });
    }
    points[0].x = W * 0.12;
    points[0].y = anchorY;
    points[0].ox = points[0].x;
    points[0].oy = points[0].y;
    points[SEGMENTS - 1].x = endX;
    points[SEGMENTS - 1].y = endY;
    points[SEGMENTS - 1].ox = endX;
    points[SEGMENTS - 1].oy = endY;
    return {
      id: id,
      color: COLORS[id],
      points: points,
      rest: rest,
      plugged: false,
      plugSocket: null,
    };
  }

  function reset() {
    layoutSockets();
    cables = [];
    for (var i = 0; i < 4; i++) cables.push(makeCable(i));
    drag = null;
    complete = false;
    statusEl.classList.remove("visible");
    statusEl.textContent = "";
    document.body.classList.remove("dimmed");
  }

  // expose for smoke tests
  window.__cableDebug = function () {
    return cables.map(function (c) {
      var end = c.points[SEGMENTS - 1];
      return { id: c.id, plugged: c.plugged, x: end.x, y: end.y };
    });
  };

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function hitPlug(p) {
    for (var i = cables.length - 1; i >= 0; i--) {
      var cable = cables[i];
      if (cable.plugged) continue;
      var end = cable.points[SEGMENTS - 1];
      var dx = p.x - end.x;
      var dy = p.y - end.y;
      if (dx * dx + dy * dy < Math.pow(28 * devicePixelRatio, 2)) {
        return cable;
      }
    }
    return null;
  }

  function down(e) {
    e.preventDefault();
    RoomAudio.resume();
    var p = pointerPos(e);
    var cable = hitPlug(p);
    if (!cable) return;
    drag = cable;
    canvas.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!drag) return;
    e.preventDefault();
    var p = pointerPos(e);
    var end = drag.points[SEGMENTS - 1];
    end.x = p.x;
    end.y = p.y;
    end.ox = p.x;
    end.oy = p.y;
  }

  function tryPlug(cable) {
    var end = cable.points[SEGMENTS - 1];
    var sock = sockets[cable.id];
    var dx = end.x - sock.x;
    var dy = end.y - sock.y;
    if (dx * dx + dy * dy < Math.pow(48 * devicePixelRatio, 2)) {
      cable.plugged = true;
      cable.plugSocket = sock;
      end.x = sock.x;
      end.y = sock.y;
      end.ox = sock.x;
      end.oy = sock.y;
      end.pinned = true;
      RoomAudio.click();
      checkComplete();
      return true;
    }
    return false;
  }

  function checkComplete() {
    for (var i = 0; i < cables.length; i++) {
      if (!cables[i].plugged) return;
    }
    complete = true;
    statusEl.textContent = "整齐了";
    statusEl.classList.add("visible");
    document.body.classList.add("dimmed");
  }

  function up(e) {
    if (!drag) return;
    tryPlug(drag);
    drag = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  function verlet(cable) {
    var pts = cable.points;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.pinned || (drag === cable && i === SEGMENTS - 1)) {
        p.ox = p.x;
        p.oy = p.y;
        continue;
      }
      var vx = (p.x - p.ox) * 0.92;
      var vy = (p.y - p.oy) * 0.92 + 0.02 * devicePixelRatio;
      p.ox = p.x;
      p.oy = p.y;
      p.x += vx;
      p.y += vy;
      p.x = Math.max(W * 0.1, Math.min(W * 0.9, p.x));
      p.y = Math.max(H * 0.08, Math.min(H * 0.92, p.y));
    }

    for (var iter = 0; iter < 6; iter++) {
      for (var j = 0; j < pts.length - 1; j++) {
        var a = pts[j];
        var b = pts[j + 1];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        var diff = (dist - cable.rest) / dist;
        var ox = dx * 0.5 * diff;
        var oy = dy * 0.5 * diff;
        if (!a.pinned && !(drag === cable && j === SEGMENTS - 1)) {
          a.x += ox;
          a.y += oy;
        }
        if (!b.pinned && !(drag === cable && j + 1 === SEGMENTS - 1)) {
          b.x -= ox;
          b.y -= oy;
        }
      }
      pts[0].x = W * 0.12;
      pts[0].y = H * (0.22 + cable.id * 0.18);
      if (cable.plugged) {
        pts[SEGMENTS - 1].x = cable.plugSocket.x;
        pts[SEGMENTS - 1].y = cable.plugSocket.y;
      } else if (drag === cable) {
        // keep plug where the pointer left it this frame
      }
    }
  }

  function drawCable(cable) {
    var pts = cable.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = cable.color;
    ctx.lineWidth = 5 * devicePixelRatio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // plug
    var end = pts[SEGMENTS - 1];
    ctx.beginPath();
    ctx.roundRect(
      end.x - 10 * devicePixelRatio,
      end.y - 7 * devicePixelRatio,
      20 * devicePixelRatio,
      14 * devicePixelRatio,
      3 * devicePixelRatio
    );
    ctx.fillStyle = cable.plugged ? cable.color : "#d8d0c4";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.stroke();
  }

  function drawSockets() {
    for (var i = 0; i < sockets.length; i++) {
      var s = sockets[i];
      ctx.beginPath();
      ctx.roundRect(
        s.x - 16 * devicePixelRatio,
        s.y - 18 * devicePixelRatio,
        32 * devicePixelRatio,
        36 * devicePixelRatio,
        6 * devicePixelRatio
      );
      ctx.fillStyle = "#1c1a16";
      ctx.fill();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.stroke();
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x - 6 * devicePixelRatio, s.y - 4 * devicePixelRatio, 2.5 * devicePixelRatio, 0, Math.PI * 2);
      ctx.arc(s.x + 6 * devicePixelRatio, s.y - 4 * devicePixelRatio, 2.5 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }

    // left panel
    ctx.fillStyle = "#1a1713";
    ctx.fillRect(0, 0, W * 0.08, H);
    for (var j = 0; j < 4; j++) {
      ctx.fillStyle = COLORS[j];
      ctx.beginPath();
      ctx.arc(W * 0.12, H * (0.22 + j * 0.18), 6 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // polyfill roundRect for older browsers
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
    bg.addColorStop(0, "#16130f");
    bg.addColorStop(1, "#0e0c0a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawSockets();
    for (var i = 0; i < cables.length; i++) {
      verlet(cables[i]);
      drawCable(cables[i]);
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
