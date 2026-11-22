// Чистые правила приложения: палитры, настроения, музыка, календарь.
// Без DOM и Node — чтобы тестировать обычным node --test.

export const PALETTES = ["pink", "mint", "sky", "lemon", "lavender", "coral", "teal"];
export const STICKERS = ["heart", "sparkle", "cassette", "bow", "tape", "plaster"];
export const SCALES = ["major", "minor", "penta", "dorian"];

export const MOODS = {
  joy: { label: "радость", palette: "lemon", tempo: 104, scale: "major", stickers: ["sparkle", "heart", "tape"] },
  calm: { label: "покой", palette: "mint", tempo: 72, scale: "penta", stickers: ["tape", "sparkle", "heart"] },
  love: { label: "нежность", palette: "pink", tempo: 84, scale: "major", stickers: ["heart", "bow", "cassette"] },
  sad: { label: "грусть", palette: "sky", tempo: 60, scale: "minor", stickers: ["tape", "heart", "plaster"] },
  night: { label: "ночь", palette: "lavender", tempo: 68, scale: "dorian", stickers: ["cassette", "sparkle", "tape"] },
  bright: { label: "драйв", palette: "coral", tempo: 112, scale: "major", stickers: ["sparkle", "heart", "cassette"] },
  dream: { label: "мечта", palette: "teal", tempo: 76, scale: "penta", stickers: ["sparkle", "bow", "cassette"] },
};

const KEYWORDS = {
  joy: ["рад", "счаст", "весел", "смех", "смеш", "праздн", "солнц", "улыб", "happy", "fun", "laugh", "joy"],
  calm: ["спокой", "тихо", "утро", "чай", "прогул", "лес", "море", "дома", "спать", "calm", "quiet", "walk", "home"],
  love: ["люб", "объят", "поцел", "сердц", "родн", "близк", "love", "kiss", "hug"],
  sad: ["груст", "тоск", "плак", "дожд", "одинок", "потер", "устал", "sad", "rain", "cry", "alone", "tired"],
  night: ["ноч", "луна", "звезд", "вечер", "закат", "темн", "night", "moon", "star", "evening"],
  bright: ["концерт", "вечерин", "танц", "бег", "спорт", "драйв", "громк", "party", "dance", "run", "loud"],
  dream: ["сон", "мечт", "волшеб", "сказк", "туман", "dream", "magic", "fog"],
};

export function moodFor(text = "") {
  const low = String(text).toLowerCase();
  let best = "calm";
  let bestScore = 0;
  for (const [mood, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) if (low.includes(w)) score += 1;
    if (score > bestScore) { best = mood; bestScore = score; }
  }
  return best;
}

export function styleForMood(mood) {
  const m = MOODS[mood] || MOODS.calm;
  return { mood: MOODS[mood] ? mood : "calm", palette: m.palette, stickers: [...m.stickers], tempo: m.tempo, scale: m.scale };
}

export function normalizeStyle(raw = {}, fallbackMood = "calm") {
  const mood = MOODS[raw.mood] ? raw.mood : MOODS[fallbackMood] ? fallbackMood : "calm";
  const base = styleForMood(mood);
  const stickers = Array.isArray(raw.stickers) ? raw.stickers.filter((s) => STICKERS.includes(s)).slice(0, 4) : [];
  return {
    mood,
    palette: PALETTES.includes(raw.palette) ? raw.palette : base.palette,
    stickers: stickers.length ? stickers : base.stickers,
    tempo: Number.isFinite(raw.tempo) ? Math.min(140, Math.max(48, Math.round(raw.tempo))) : base.tempo,
    scale: SCALES.includes(raw.scale) ? raw.scale : base.scale,
  };
}

// Только общественное достояние: композиторы умерли больше 70 лет назад,
// аудио не хранится — ссылка ведёт на поиск записи.
const SONGS = {
  joy: ["Scott Joplin — The Entertainer", "Scott Joplin — Maple Leaf Rag", "Traditional — When the Saints Go Marching In"],
  calm: ["Erik Satie — Gymnopédie No. 1", "Claude Debussy — Clair de Lune", "Johann Sebastian Bach — Air on the G String"],
  love: ["Claude Debussy — Arabesque No. 1", "Frédéric Chopin — Nocturne Op. 9 No. 2", "Robert Schumann — Träumerei"],
  sad: ["Frédéric Chopin — Prelude Op. 28 No. 4", "Edvard Grieg — The Death of Åse", "Jules Massenet — Élégie"],
  night: ["Modest Mussorgsky — Night on Bald Mountain", "Claude Debussy — Rêverie", "Frédéric Chopin — Nocturne Op. 27 No. 1"],
  bright: ["Gioachino Rossini — William Tell Overture", "Ludwig van Beethoven — Ode to Joy", "Wolfgang Amadeus Mozart — Turkish March"],
  dream: ["Pyotr Tchaikovsky — Dance of the Sugar Plum Fairy", "Erik Satie — Gnossienne No. 1", "Franz Schubert — Ave Maria"],
};

const SONG_ENERGY = { joy: "loud", bright: "loud", love: "medium", night: "medium", calm: "quiet", dream: "quiet", sad: "quiet" };

export function songUrlFor(title = "") {
  const value = String(title).trim();
  // Своя ссылка на сервис важнее поиска: её и открываем.
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(value)}`;
}

// Песня дня подбирается сама: настроение задаёт характер, текст — вариант из списка.
export function songFor(text = "", mood = "calm") {
  const list = SONGS[mood] || SONGS.calm;
  let hash = 0;
  for (const ch of String(text).toLowerCase().replace(/\s+/g, " ").trim()) {
    hash = (hash * 31 + ch.codePointAt(0)) % 100000;
  }
  const title = list[hash % list.length];
  return {
    title,
    url: songUrlFor(title),
    energy: SONG_ENERGY[mood] || "medium",
  };
}

export function titleFromText(text = "") {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return "Без названия";
  // Название — первая фраза, а не обрубок на полуслове.
  const sentence = clean.split(/(?<=[.!?…])\s+/)[0] || clean;
  const words = sentence.split(" ").slice(0, 7).join(" ").replace(/[.,;:!?…]+$/, "");
  return words.length > 60 ? `${words.slice(0, 57)}…` : words;
}

const pad = (n) => String(n).padStart(2, "0");

export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function monthName(index) {
  return ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"][index] || "";
}

export function monthGenitive(index) {
  return ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"][index] || "";
}

export function formatDate(key) {
  const d = parseDateKey(key);
  return `${d.getDate()} ${monthGenitive(d.getMonth())} ${d.getFullYear()}`;
}

// 42 клетки, неделя с понедельника: всегда шесть строк — календарь не прыгает.
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  const start = new Date(year, month, 1 - offset);
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      key: dateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  return cells;
}

// Неделя вокруг дня: понедельник — воскресенье, для нижней полоски.
export function weekMatrix(key) {
  const base = parseDateKey(key);
  const offset = (base.getDay() + 6) % 7;
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      key: dateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === base.getMonth() && d.getFullYear() === base.getFullYear(),
    };
  });
}

const MONTH_MOOD_ADJECTIVE = {
  joy: "солнечный", calm: "тихий", love: "нежный", sad: "грустный",
  night: "ночной", bright: "яркий", dream: "туманный",
};

const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;

// Чек-ап месяца: заголовок по частому настроению, статистика и песня.
export function monthSummary(notes, year, month) {
  const prefix = `${year}-${pad(month + 1)}-`;
  const list = notes
    .filter((n) => String(n.date).startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const counts = {};
  for (const note of list) counts[note.mood] = (counts[note.mood] || 0) + 1;
  const moods = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const mood = moods[0]?.[0] || "";
  const name = monthName(month);
  const adjective = MONTH_MOOD_ADJECTIVE[mood] || "";
  const title = list.length ? (adjective ? `${cap(adjective)} ${name}` : cap(name)) : cap(name);
  const songs = {};
  for (const note of list) {
    const title = note.song?.title;
    if (title) songs[title] = (songs[title] || 0) + 1;
  }
  const song = Object.entries(songs).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return {
    title,
    notes: list,
    days: new Set(list.map((n) => n.date)).size,
    photos: list.filter((n) => n.photo).length,
    moods,
    song,
  };
}

export function notesOn(notes, key) {
  return notes.filter((n) => n.date === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function paletteOfNote(note) {
  return PALETTES.includes(note?.palette) ? note.palette : "mint";
}

export function moodLabel(mood) {
  return (MOODS[mood] || MOODS.calm).label;
}
