(function (global) {
  "use strict";

  var ctx = null;
  var master = null;
  var drone = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return ctx;
  }

  function noiseBuffer(duration) {
    var c = ensure();
    if (!c) return null;
    var len = Math.max(1, Math.floor(c.sampleRate * duration));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function RoomAudio() {}

  RoomAudio.resume = function () {
    var c = ensure();
    if (c && c.state === "suspended") {
      c.resume();
    }
  };

  RoomAudio.setDrone = function (energy) {
    var c = ensure();
    if (!c || !master) return;
    energy = Math.max(0, Math.min(1, energy || 0));

    if (!drone) {
      drone = {
        gains: [],
        oscs: [],
      };
      var freqs = [196, 294.2, 392.8];
      for (var i = 0; i < freqs.length; i++) {
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = "sine";
        osc.frequency.value = freqs[i];
        g.gain.value = 0;
        osc.connect(g);
        g.connect(master);
        osc.start();
        drone.oscs.push(osc);
        drone.gains.push(g);
      }
    }

    var now = c.currentTime;
    var levels = [0.18, 0.12, 0.08];
    for (var j = 0; j < drone.gains.length; j++) {
      drone.gains[j].gain.cancelScheduledValues(now);
      drone.gains[j].gain.setTargetAtTime(
        levels[j] * energy,
        now,
        energy > 0.05 ? 0.08 : 0.35
      );
    }
  };

  RoomAudio.crack = function () {
    var c = ensure();
    if (!c || !master) return;
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(0.12);
    var filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    var g = c.createGain();
    g.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    var now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    src.start(now);
    src.stop(now + 0.13);
  };

  RoomAudio.click = function () {
    var c = ensure();
    if (!c || !master) return;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = 880;
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(master);
    var now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
  };

  RoomAudio.pop = function () {
    var c = ensure();
    if (!c || !master) return;
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(0.18);
    var filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    var g = c.createGain();
    g.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    var now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.42, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.16);
    src.start(now);
    src.stop(now + 0.18);
  };

  RoomAudio.crackle = function (intensity) {
    var c = ensure();
    if (!c || !master) return;
    intensity = Math.max(0.2, Math.min(1, intensity || 0.5));
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(0.05);
    var filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    var g = c.createGain();
    g.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    var now = c.currentTime;
    var peak = 0.08 * intensity;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    src.start(now);
    src.stop(now + 0.05);
  };

  RoomAudio.bounce = function (intensity) {
    var c = ensure();
    if (!c || !master) return;
    intensity = Math.max(0.15, Math.min(1, intensity || 0.5));
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 520 + intensity * 380;
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(master);
    var now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12 * intensity, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);
    osc.start(now);
    osc.stop(now + 0.08);
  };

  RoomAudio.pluck = function (freq) {
    var c = ensure();
    if (!c || !master) return;
    freq = freq || 440;
    var osc = c.createOscillator();
    var g = c.createGain();
    var filter = c.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = freq * 4;
    g.gain.value = 0.0001;
    osc.connect(filter);
    filter.connect(g);
    g.connect(master);
    var now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.start(now);
    osc.stop(now + 0.95);
  };

  RoomAudio.thud = function (intensity) {
    var c = ensure();
    if (!c || !master) return;
    intensity = Math.max(0.2, Math.min(1, intensity || 0.6));
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 90 + intensity * 40;
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(master);
    var now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.35 * intensity, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.3);

    var src = c.createBufferSource();
    src.buffer = noiseBuffer(0.08);
    var filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    var ng = c.createGain();
    ng.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(ng);
    ng.connect(master);
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.18 * intensity, now + 0.005);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    src.start(now);
    src.stop(now + 0.09);
  };

  RoomAudio.drum = function (freq) {
    var c = ensure();
    if (!c || !master) return;
    freq = freq || 120;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(master);
    var now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.4, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.5);

    var src = c.createBufferSource();
    src.buffer = noiseBuffer(0.06);
    var filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq * 3;
    var ng = c.createGain();
    ng.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(ng);
    ng.connect(master);
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.2, now + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    src.start(now);
    src.stop(now + 0.07);
  };

  global.RoomAudio = RoomAudio;
})(typeof window !== "undefined" ? window : this);
