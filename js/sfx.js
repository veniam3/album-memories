// Мелкие бумажные звуки интерфейса. Синтез на месте, без файлов и зависимостей.
let ctx = null;

function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function sfxOn() {
  return localStorage.getItem("album.sfx") !== "off";
}

export function setSfx(on) {
  localStorage.setItem("album.sfx", on ? "on" : "off");
}

function tone(ac, { freq, to = freq, dur = 0.06, type = "sine", gain = 0.03, delay = 0 }) {
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function paper(ac, { dur = 0.16, gain = 0.02, delay = 0 } = {}) {
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1900;
  filter.Q.value = 0.7;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t);
}

export function sfx(kind) {
  if (!sfxOn()) return;
  const ac = audio();
  if (!ac) return;
  if (kind === "tap") tone(ac, { freq: 760, to: 620, dur: 0.045, type: "triangle" });
  else if (kind === "page") paper(ac);
  else if (kind === "save") {
    tone(ac, { freq: 523, dur: 0.09, gain: 0.035 });
    tone(ac, { freq: 784, dur: 0.12, gain: 0.03, delay: 0.08 });
  } else if (kind === "like") tone(ac, { freq: 880, to: 1180, dur: 0.08, gain: 0.03 });
}
