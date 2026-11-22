// Мобильная замена Electron-моста: те же вызовы window.album, но данные в localStorage.
// Фото храним как data URL, поэтому album:// из desktop здесь не нужен.

import { PALETTES, STICKERS, SCALES, titleFromText } from "../src/logic.mjs";
import { improveText as aiImproveText, styleFromText as aiStyleFromText } from "../src/ai.mjs";
import { bundleKey } from "../src/bundle-web.mjs";

const NOTES_KEY = "album.notes.v1";
const SETTINGS_KEY = "album.settings.v1";
const SEEDED_KEY = "album.seeded.v1";
const ENERGIES = ["quiet", "medium", "loud"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const read = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
};

const safeUrl = (value) => {
  try {
    const url = new URL(String(value ?? "").trim().slice(0, 500));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

function clean(input = {}) {
  const text = String(input.text ?? "").slice(0, 5000);
  const songTitle = String(input.song?.title ?? "").slice(0, 120).trim();
  const id = typeof input.id === "string" && input.id ? input.id : crypto.randomUUID();
  const photo = String(input.photo ?? "");
  return {
    id,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString(),
    date: DATE_RE.test(input.date) ? input.date : new Date().toISOString().slice(0, 10),
    title: String(input.title ?? "").slice(0, 120).trim() || titleFromText(text),
    text,
    photo: photo.startsWith("data:image/") ? photo : null,
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
      seed: songTitle.slice(0, 40) || String(input.music?.seed ?? "").slice(0, 40) || id,
    },
    liked: Boolean(input.liked),
  };
}

const storedNotes = read(NOTES_KEY, []);
let notes = (Array.isArray(storedNotes) ? storedNotes : [])
  .filter((n) => n && typeof n.id === "string")
  .map(clean);

// Демо-сборка кладёт window.ALBUM_DEMO; пустая — просто стартует с чистого листа.
if (!notes.length && !localStorage.getItem(SEEDED_KEY)) {
  if (Array.isArray(window.ALBUM_DEMO) && window.ALBUM_DEMO.length) {
    notes = window.ALBUM_DEMO.map(clean);
    write(NOTES_KEY, notes);
  }
  try { localStorage.setItem(SEEDED_KEY, "1"); } catch { /* приватный режим */ }
}

const persist = () => write(NOTES_KEY, notes);
const sorted = () => notes.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

function pickPhoto() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);

    const done = (value) => {
      input.remove();
      resolve({ ok: true, data: value });
    };

    input.addEventListener("cancel", () => done(null), { once: true });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        done(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        done(null);
      }
    }, { once: true });

    input.click();
  });
}

const settings = () => ({ model: "deepseek-chat", ...read(SETTINGS_KEY, {}) });
let keyPromise;
const getApiKey = () => (keyPromise ??= bundleKey());
const keyState = async () => {
  const key = await getApiKey();
  return { hasKey: Boolean(key), builtin: Boolean(key), model: settings().model };
};

window.album = {
  init: async () => ({ ok: true, data: { notes: sorted(), settings: await keyState() } }),

  add: async (input) => {
    const note = clean(input);
    notes.push(note);
    if (!persist()) {
      notes = notes.filter((n) => n.id !== note.id);
      return { ok: false, error: "Память телефона заполнена: удалите пару фото" };
    }
    return { ok: true, data: note };
  },

  update: async (id, patch = {}) => {
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) return { ok: false, error: "not_found" };
    const merged = clean({ ...notes[index], ...patch, id });
    notes[index] = merged;
    persist();
    return { ok: true, data: merged };
  },

  remove: async (id) => {
    notes = notes.filter((n) => n.id !== id);
    persist();
    return { ok: true, data: true };
  },

  pickPhoto,

  saveSettings: async (patch = {}) => {
    const model = ["deepseek-chat", "deepseek-reasoner"].includes(patch.model) ? patch.model : settings().model;
    write(SETTINGS_KEY, { model });
    return { ok: true, data: await keyState() };
  },

  improveText: async (text) => {
    const apiKey = await getApiKey();
    if (!apiKey) return { ok: false, error: "Ключ ИИ недоступен" };
    try {
      return { ok: true, data: await aiImproveText({ apiKey, model: settings().model, text }) };
    } catch (err) {
      return { ok: false, error: err?.message || "ИИ недоступен" };
    }
  },

  styleFromText: async (text, song) => {
    const apiKey = await getApiKey();
    if (!apiKey) return { ok: false, error: "Ключ ИИ недоступен" };
    try {
      return { ok: true, data: await aiStyleFromText({ apiKey, model: settings().model, text, song }) };
    } catch (err) {
      return { ok: false, error: err?.message || "ИИ недоступен" };
    }
  },

  openExternal: async (value) => {
    try {
      const url = new URL(String(value));
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad_url");
      if (window.Android?.openUrl) window.Android.openUrl(url.href);
      else window.open(url.href, "_blank");
      return { ok: true, data: true };
    } catch {
      return { ok: false, error: "bad_url" };
    }
  },
};
