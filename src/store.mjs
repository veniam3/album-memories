// Хранилище альбома: notes.json + settings.json + папка photos.
// Всё локально, атомарная запись, фото копируются под случайным именем.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PALETTES, STICKERS, SCALES, dateKey, titleFromText } from "./logic.mjs";
import { bundleKey } from "./bundle.mjs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHOTO_RE = /^[a-z0-9-]{1,64}\.(jpg|jpeg|png|webp|gif|avif)$/i;
const EXT_RE = /\.(jpg|jpeg|png|webp|gif|avif)$/i;
const MODELS = ["deepseek-chat", "deepseek-reasoner"];

// Расширению из имени не верим: переименованный .txt иначе попадёт в альбом битой картинкой.
function isImageFile(file) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(file, "r");
  try { fs.readSync(fd, buf, 0, 12, 0); } finally { fs.closeSync(fd); }
  return (
    (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) || // jpeg
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || // png
    (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") || // webp
    buf.subarray(0, 3).toString() === "GIF" || // gif
    buf.subarray(4, 8).toString() === "ftyp" // avif
  );
}

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    try { fs.renameSync(file, `${file}.broken`); } catch { /* уже переименован */ }
    return fallback;
  }
}

function clamp(n, min, max, fallback) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

// Ссылку открывает ОС, поэтому пускаем только http(s): javascript:, file: и прочее — мимо.
function safeUrl(value) {
  const raw = String(value ?? "").trim().slice(0, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

const ENERGIES = ["quiet", "medium", "loud"];

function cleanNote(input = {}, id, createdAt) {
  const text = String(input.text ?? "").slice(0, 5000);
  const songTitle = String(input.song?.title ?? "").slice(0, 120).trim();
  return {
    id,
    createdAt,
    date: DATE_RE.test(input.date) ? input.date : dateKey(new Date()),
    title: String(input.title ?? "").slice(0, 120).trim() || titleFromText(text),
    text,
    photo: PHOTO_RE.test(input.photo ?? "") ? input.photo : null,
    palette: PALETTES.includes(input.palette) ? input.palette : "mint",
    mood: String(input.mood ?? "calm").slice(0, 20),
    stickers: Array.isArray(input.stickers) ? input.stickers.filter((s) => STICKERS.includes(s)).slice(0, 4) : [],
    song: {
      title: songTitle,
      url: safeUrl(input.song?.url),
      energy: ENERGIES.includes(input.song?.energy) ? input.song.energy : "medium",
    },
    music: {
      tempo: clamp(input.music?.tempo, 48, 140, 72),
      scale: SCALES.includes(input.music?.scale) ? input.music.scale : "penta",
      // Название песни задаёт мелодию: один и тот же день звучит одинаково.
      seed: songTitle ? songTitle.slice(0, 40) : String(input.music?.seed ?? "").slice(0, 40) || id,
    },
    liked: Boolean(input.liked),
  };
}

export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch { /* Windows не умеет */ }
  const notesPath = path.join(dir, "notes.json");
  const settingsPath = path.join(dir, "settings.json");
  const photosDir = path.join(dir, "photos");
  const daysDir = path.join(dir, "days");
  fs.mkdirSync(photosDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(daysDir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(photosDir, 0o700); fs.chmodSync(daysDir, 0o700); } catch { /* Windows не умеет */ }

  // Папка дня — витрина для жюри: текст, фото, песня и данные карточки.
  // Источник правды остаётся notes.json, поэтому сбой экспорта не ломает альбом.
  const daySlug = (title) => {
    const clean = String(title || "День")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "");
    return (clean || "День").slice(0, 60).trim() || "День";
  };

  const dayOwner = (folder) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(folder, "note.json"), "utf8")).id;
    } catch {
      return null;
    }
  };

  const findDay = (id) => {
    for (const name of fs.readdirSync(daysDir)) {
      const folder = path.join(daysDir, name);
      if (dayOwner(folder) === id) return folder;
    }
    return null;
  };

  const exportDay = (note) => {
    const old = findDay(note.id);
    const base = path.join(daysDir, daySlug(note.title));
    let target = base;
    if (fs.existsSync(target) && dayOwner(target) !== note.id) {
      let i = 2;
      while (fs.existsSync(`${base} (${i})`) && dayOwner(`${base} (${i})`) !== note.id) i += 1;
      target = `${base} (${i})`;
    }
    if (old && old !== target) fs.rmSync(old, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true, mode: 0o700 });
    writeAtomic(path.join(target, "note.json"), note);
    fs.writeFileSync(path.join(target, "text.txt"), note.text || "", { mode: 0o600 });
    fs.writeFileSync(
      path.join(target, "song.txt"),
      note.song?.title ? `${note.song.title}\n${note.song.url || ""}\n` : "",
      { mode: 0o600 },
    );
    const photo = note.photo ? path.join(photosDir, note.photo) : null;
    const keep = photo && fs.existsSync(photo) ? `photo${path.extname(photo)}` : null;
    for (const name of fs.readdirSync(target)) {
      if (name.startsWith("photo.") && name !== keep) fs.unlinkSync(path.join(target, name));
    }
    if (keep) {
      fs.copyFileSync(photo, path.join(target, keep));
      try { fs.chmodSync(path.join(target, keep), 0o600); } catch { /* Windows не умеет */ }
    }
  };

  const safeExport = (note) => {
    try {
      exportDay(note);
    } catch (err) {
      console.error("day export failed", err);
    }
  };

  let notes = readJson(notesPath, []);
  if (!Array.isArray(notes)) notes = [];
  // Приводим к схеме: старые/ручные записи не должны ломать рендер.
  notes = notes
    .filter((n) => n && typeof n.id === "string")
    .map((n) => cleanNote(n, n.id, typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString()));

  // Фото, на которые никто не ссылается (отменённое добавление), не копим.
  const usedPhotos = new Set(notes.map((n) => n.photo).filter(Boolean));
  for (const name of fs.readdirSync(photosDir)) {
    if (PHOTO_RE.test(name)) {
      try { fs.chmodSync(path.join(photosDir, name), 0o600); } catch { /* Windows не умеет */ }
      if (!usedPhotos.has(name)) {
        try { fs.unlinkSync(path.join(photosDir, name)); } catch { /* уже удалено */ }
      }
    }
  }

  // Чужие папки в days/ не трогаем; удаляем только папки исчезнувших заметок.
  for (const name of fs.readdirSync(daysDir)) {
    const folder = path.join(daysDir, name);
    const owner = dayOwner(folder);
    if (owner && !notes.some((n) => n.id === owner)) {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  }
  for (const note of notes) safeExport(note);

  const persist = () => writeAtomic(notesPath, notes);

  // scrypt дорогой: ключ разбираем один раз за запуск.
  let builtinCache;
  const builtinKey = () => (builtinCache ??= bundleKey());

  const settings = () => {
    const raw = readJson(settingsPath, {});
    return {
      apiKey: typeof raw.apiKey === "string" ? raw.apiKey.slice(0, 200) : "",
      model: MODELS.includes(raw.model) ? raw.model : "deepseek-chat",
    };
  };

  return {
    photosDir,

    list() {
      return notes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    add(input) {
      const id = crypto.randomUUID();
      const note = cleanNote(input, id, new Date().toISOString());
      if (!note.music.seed) note.music.seed = id;
      notes.push(note);
      persist();
      safeExport(note);
      return note;
    },

    update(id, patch = {}) {
      const index = notes.findIndex((n) => n.id === id);
      if (index === -1) throw new Error("not_found");
      const merged = cleanNote({ ...notes[index], ...patch }, notes[index].id, notes[index].createdAt);
      notes[index] = merged;
      persist();
      safeExport(merged);
      return merged;
    },

    remove(id) {
      const index = notes.findIndex((n) => n.id === id);
      if (index === -1) return false;
      const folder = findDay(id);
      const [gone] = notes.splice(index, 1);
      persist();
      if (folder) fs.rmSync(folder, { recursive: true, force: true });
      if (gone.photo && !notes.some((n) => n.photo === gone.photo)) {
        try { fs.unlinkSync(path.join(photosDir, gone.photo)); } catch { /* файла уже нет */ }
      }
      return true;
    },

    photoPath(name) {
      if (!PHOTO_RE.test(name || "")) return null;
      const file = path.join(photosDir, name);
      return fs.existsSync(file) ? file : null;
    },

    // Копирует выбранный файл в альбом. Расширение берём из имени и проверяем по списку.
    importPhoto(source) {
      const ext = path.extname(String(source || "")).toLowerCase();
      if (!EXT_RE.test(ext) || !isImageFile(source)) throw new Error("unsupported_photo");
      const name = `${crypto.randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
      const dest = path.join(photosDir, name);
      fs.copyFileSync(source, dest);
      try { fs.chmodSync(dest, 0o600); } catch { /* Windows не умеет */ }
      return name;
    },

    getSettings() {
      const s = settings();
      const builtin = Boolean(!s.apiKey && builtinKey());
      return { hasKey: Boolean(s.apiKey) || builtin, builtin, model: s.model };
    },

    getApiKey() {
      return settings().apiKey || builtinKey();
    },

    saveSettings(patch = {}) {
      const current = settings();
      const next = {
        apiKey: typeof patch.apiKey === "string" ? patch.apiKey.trim().slice(0, 200) : current.apiKey,
        model: MODELS.includes(patch.model) ? patch.model : current.model,
      };
      writeAtomic(settingsPath, next);
      return { hasKey: Boolean(next.apiKey) || Boolean(builtinKey()), builtin: Boolean(!next.apiKey && builtinKey()), model: next.model };
    },
  };
}

export { MODELS, PHOTO_RE };
