// Генеративная музыка под заметку: сид из id, лад и темп из настроения.
// Без файлов и зависимостей — Web Audio. Своего API генерации музыки пока нет.
// shortcut: локальный генератор вместо внешнего сервиса; заменить engine.play,
// когда появится API генерации треков (тогда достаточно <audio> с URL).
(function () {
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    penta: [0, 2, 4, 7, 9],
    dorian: [0, 2, 3, 5, 7, 9, 10],
  };
  const ROOTS = [196, 207.65, 220, 233.08, 246.94, 261.63];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function random(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  window.createMusicEngine = function createMusicEngine() {
    let ctx = null;
    let master = null;
    let timer = null;
    let track = null;
    let noise = null;
    const listeners = new Set();

    const emit = () => listeners.forEach((fn) => fn(engine.state()));

    function ensure() {
      if (ctx) return;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.16;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 3200;
      master.connect(filter);
      filter.connect(ctx.destination);

      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      noise = buffer;
    }

    function tone(freq, at, dur, type, volume) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(volume, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    }

    function hat(at) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      src.buffer = noise;
      gain.gain.setValueAtTime(0.05, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
      src.connect(hp);
      hp.connect(gain);
      gain.connect(master);
      src.start(at);
      src.stop(at + 0.06);
    }

    function schedule(step, at) {
      const scale = SCALES[track.scale] || SCALES.penta;
      const degree = scale[Math.floor(track.rand() * scale.length)];
      const octave = track.rand() > 0.72 ? 2 : 1;
      const beat = 60 / track.tempo / 2;

      if (step % 2 === 0 || track.rand() < 0.35) {
        tone(track.root * octave * 2 ** (degree / 12), at, beat * 1.8, "triangle", 0.22);
      }
      if (step % 8 === 0) tone(track.root / 2, at, beat * 3, "sine", 0.35);
      if (step % 8 === 4) tone(track.root / 2 * 1.498, at, beat * 2, "sine", 0.25);
      if (step % 2 === 0) hat(at);
      if (step % 16 === 0) {
        [0, scale[2], scale[4]].forEach((semi, i) => {
          tone(track.root * 2 ** (semi / 12), at + i * 0.02, beat * 8, "sine", 0.09);
        });
      }
    }

    function tick() {
      if (!ctx || !track) return;
      const beat = 60 / track.tempo / 2;
      while (track.next < ctx.currentTime + 0.3) {
        schedule(track.step, track.next);
        track.step = (track.step + 1) % 32;
        track.next += beat;
      }
    }

    const engine = {
      state() {
        return { playing: Boolean(ctx && track), noteId: track?.noteId || null };
      },

      play(note) {
        engine.stop();
        ensure();
        ctx.resume();
        const seed = hash(String(note?.music?.seed || note?.id || "album"));
        const scale = SCALES[note?.music?.scale] ? note.music.scale : "penta";
        // Характер песни двигает темп: тихая — медленнее, громкая — быстрее.
        const energyDelta = { quiet: -10, loud: 12 }[note?.song?.energy] || 0;
        const tempo = Math.min(140, Math.max(48, (Number(note?.music?.tempo) || 72) + energyDelta));
        track = {
          noteId: note?.id || null,
          tempo,
          scale,
          root: ROOTS[seed % ROOTS.length],
          rand: random(seed),
          step: 0,
          next: ctx.currentTime + 0.08,
        };
        timer = setInterval(tick, 120);
        tick();
        emit();
      },

      stop() {
        if (timer) clearInterval(timer);
        timer = null;
        track = null;
        if (ctx) {
          const old = ctx;
          ctx = null;
          master = null;
          old.close().catch(() => {});
        }
        emit();
      },

      toggle(note) {
        if (engine.state().playing && engine.state().noteId === note?.id) engine.stop();
        else engine.play(note);
      },

      onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };

    return engine;
  };
})();
