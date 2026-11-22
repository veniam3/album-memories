// Наполняет альбом шестью демо-днями из папки demo/.
// Запуск: node demo.mjs            — в данные приложения (если альбом пуст)
//         node demo.mjs --force    — заменить существующие дни
//         node demo.mjs /путь/к/данным
// Скрипт не трогает настройки и ключ DeepSeek.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./src/store.mjs";
import { styleForMood } from "./src/logic.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const force = args.includes("--force");
const custom = args.find((a) => !a.startsWith("--"));

function defaultDataDir() {
  if (process.env.ALBUM_DATA) return process.env.ALBUM_DATA;
  const name = "album-memories";
  if (process.platform === "win32") return path.join(process.env.APPDATA || os.homedir(), name);
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", name);
  return path.join(os.homedir(), ".config", name);
}

const dataDir = path.resolve(custom || defaultDataDir());
const notesPath = path.join(dataDir, "notes.json");
const existing = (() => {
  try {
    return JSON.parse(fs.readFileSync(notesPath, "utf8"));
  } catch {
    return [];
  }
})();

if (Array.isArray(existing) && existing.length && !force) {
  console.log(`В альбоме уже ${existing.length} дней: ${dataDir}`);
  console.log("Чтобы заменить их демо-днями, запустите: node demo.mjs --force");
  process.exit(0);
}
if (force) {
  for (const file of ["notes.json", "settings.json"]) {
    try { fs.unlinkSync(path.join(dataDir, file)); } catch { /* файла нет */ }
  }
  try { fs.rmSync(path.join(dataDir, "days"), { recursive: true, force: true }); } catch { /* нет папки */ }
  try { fs.rmSync(path.join(dataDir, "photos"), { recursive: true, force: true }); } catch { /* нет папки */ }
}

// Ссылки ведут на поиск песни: полные треки не храним и не раздаём.
const search = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

const days = [
  {
    date: "2026-11-15",
    title: "Ночной мост и тишина",
    text: "Вышел проветриться поздним вечером. Город почти пустой, мост светится жёлтым, и наконец стало спокойно.",
    photo: "night-bridge.jpg",
    mood: "night",
    song: { title: "Molchat Doma — Судно (Борис Рижий)", url: search("Molchat Doma Судно"), energy: "medium" },
  },
  {
    date: "2026-11-16",
    title: "Тузик заболел, сидел рядом",
    text: "Тузик заболел. Лежит на полу, смотрит грустно и не хочет есть. Просидел с ним весь вечер, гладил и говорил, что всё пройдёт.",
    photo: "tuzik.jpg",
    mood: "sad",
    song: { title: "Billie Eilish — when the party's over", url: search("Billie Eilish when the party's over"), energy: "quiet" },
  },
  {
    date: "2026-11-18",
    title: "Выставка нашей арт-студии",
    text: "У нашей арт-студии была групповая выставка. Пришла подруга как гость, и мы сфотографировались у зелёной стены.",
    photo: "exhibition.jpg",
    mood: "love",
    song: { title: "Lana Del Rey — Video Games", url: search("Lana Del Rey Video Games"), energy: "quiet" },
  },
  {
    date: "2026-11-19",
    title: "Друг детства и закат",
    text: "Приехал мой друг детства. Гуляли по городу, болтали обо всём и смотрели закат с холма.",
    photo: "friend-sunset.jpg",
    mood: "dream",
    song: { title: "Coldplay — Yellow", url: search("Coldplay Yellow"), energy: "quiet" },
  },
  {
    date: "2026-11-20",
    title: "Цветной пикник с друзьями",
    text: "Устроили цветной пикник с друзьями. Объелись так, что животы болели, но было очень круто.",
    photo: "picnic.jpg",
    mood: "bright",
    song: { title: "Dua Lipa — Levitating", url: search("Dua Lipa Levitating"), energy: "loud" },
  },
  {
    date: "2026-11-21",
    title: "Фотобутка с подругой",
    text: "Гуляли с подругой весь день, зашли в фотобутку и сделали полосатые снимки. Смеялись до слёз.",
    photo: "photobooth.jpg",
    mood: "joy",
    song: { title: "Sabrina Carpenter — Espresso", url: search("Sabrina Carpenter Espresso"), energy: "medium" },
  },
];

const store = createStore(dataDir);

for (const day of days) {
  const style = styleForMood(day.mood, day.text);
  const source = path.join(here, "demo", day.photo);
  if (!fs.existsSync(source)) {
    console.error(`Нет файла ${source}`);
    process.exit(1);
  }
  store.add({
    date: day.date,
    title: day.title,
    text: day.text,
    photo: store.importPhoto(source),
    mood: style.mood,
    palette: style.palette,
    stickers: style.stickers,
    music: { tempo: style.tempo, scale: style.scale, seed: "" },
    song: day.song,
  });
}

console.log(`Готово: ${days.length} дня в ${dataDir}`);
console.log("Запустите приложение: pnpm start");
