import {
  MOODS, monthMatrix, monthName, monthGenitive, dateKey, parseDateKey,
  formatDate, moodFor, styleForMood, titleFromText, notesOn, paletteOfNote,
  moodLabel, songFor, songUrlFor, weekMatrix, monthSummary,
} from "../src/logic.mjs";
import { sfx, setSfx, sfxOn } from "./sfx.js";

const $ = (sel) => document.querySelector(sel);
const api = window.album;
const engine = window.createMusicEngine();

// Фото в desktop лежит в профиле (album://), в мобильной сборке — data URL.
const photoSrc = (photo) => (String(photo).startsWith("data:") ? photo : `album://photo/${encodeURIComponent(photo)}`);

// Средний цвет фото задаёт фон стола. Считается один раз на файл.
const tintCache = new Map();
function applyPhotoTint(photo) {
  const phone = document.querySelector(".phone");
  if (!photo) {
    phone.style.removeProperty("--photo-tint");
    return;
  }
  if (tintCache.has(photo)) {
    phone.style.setProperty("--photo-tint", tintCache.get(photo));
    return;
  }
  const img = document.querySelector(".photo__img");
  if (!img) return;
  const read = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 24;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 24, 24);
      const { data } = ctx.getImageData(0, 0, 24, 24);
      // Берём не средний цвет (он мутнеет), а самый насыщенный оттенок кадра.
      const bins = Array.from({ length: 12 }, () => ({ w: 0, n: 0, r: 0, g: 0, b: 0 }));
      let ar = 0, ag = 0, ab = 0, an = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        ar += r; ag += g; ab += b; an += 1;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const sat = max ? (max - min) / max : 0;
        const lum = (max + min) / 510;
        if (sat < 0.18 || lum < 0.08 || lum > 0.95) continue;
        const d = max - min;
        const hue = ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
        const bin = bins[Math.floor(hue / 30) % 12];
        const w = sat * (1 - Math.abs(lum - 0.55));
        bin.w += w; bin.n += 1; bin.r += r; bin.g += g; bin.b += b;
      }
      const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
      const use = best.n && best.w > an * 0.03
        ? [best.r / best.n, best.g / best.n, best.b / best.n]
        : [ar / an, ag / an, ab / an];
      if (!use.every(Number.isFinite)) return;
      const tint = `rgb(${use.map((v) => Math.round(v)).join(" ")})`;
      tintCache.set(photo, tint);
      phone.style.setProperty("--photo-tint", tint);
    } catch {
      // canvas недоступен — остаётся крафтовый фон
    }
  };
  if (img.complete && img.naturalWidth) read();
  else img.addEventListener("load", read, { once: true });
}

const EMPTY_ART = `<svg class="photo__art" viewBox="0 0 240 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbf1dc"/><stop offset="0.52" stop-color="#f7dcc4"/><stop offset="1" stop-color="#f9a8c7"/>
  </linearGradient></defs>
  <rect width="240" height="320" fill="url(#sky)"/>
  <circle cx="172" cy="88" r="42" fill="#ffe27a" stroke="#3b2c1f" stroke-width="3"/>
  <circle cx="172" cy="88" r="30" fill="none" stroke="#3b2c1f" stroke-width="1.5" stroke-dasharray="4 7" opacity="0.4"/>
  <g fill="#fbf1dc" stroke="#3b2c1f" stroke-width="2.5" stroke-linejoin="round">
    <path d="M24 92a13 13 0 0 1 25-4 11 11 0 0 1 16 4z"/>
    <path d="M156 148a10 10 0 0 1 19-3 8 8 0 0 1 12 3z"/>
  </g>
  <g stroke="#3b2c1f" stroke-width="2.2" fill="none" stroke-linecap="round">
    <path d="M44 128c4-4 8-4 12 0M63 120c3-3 6-3 9 0"/>
  </g>
  <path d="M-10 232Q58 176 134 226T250 216V330H-10Z" fill="#ffa487" stroke="#3b2c1f" stroke-width="3"/>
  <path d="M-10 262Q66 206 146 256T250 246V330H-10Z" fill="#a9e5b8" stroke="#3b2c1f" stroke-width="3"/>
  <path d="M-10 294Q74 250 154 288T250 280V330H-10Z" fill="#8edfd3" stroke="#3b2c1f" stroke-width="3"/>
  <g stroke="#3b2c1f" stroke-width="2" fill="#fbf1dc">
    <path d="M196 252l6-14 6 14z"/><rect x="194" y="252" width="16" height="14" rx="2"/>
  </g>
</svg>`;

const HEART = `<svg viewBox="0 0 100 92" aria-hidden="true"><path d="M50 84C24 66 6 49 6 31 6 17 17 7 30 7c9 0 16 4 20 10 4-6 11-10 20-10 13 0 24 10 24 24 0 18-18 35-44 53Z" fill="#f9a8c7" stroke="#3b2c1f" stroke-width="4" stroke-linejoin="round"/><path d="M26 20c-5 1-9 5-10 10" stroke="#fffdf7" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.9"/></svg>`;
const SPARKLE = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 3 61 39 97 50 61 61 50 97 39 61 3 50 39 39Z" fill="#ffe27a" stroke="#3b2c1f" stroke-width="5" stroke-linejoin="round"/></svg>`;
const BOW = `<svg viewBox="0 0 100 74" aria-hidden="true"><path d="M45 32C33 19 10 12 6 25c-4 13 19 20 35 11Z" fill="#c3abe8" stroke="#3b2c1f" stroke-width="4" stroke-linejoin="round"/><path d="M55 32c12-13 35-20 39-7 4 13-19 20-35 11Z" fill="#c3abe8" stroke="#3b2c1f" stroke-width="4" stroke-linejoin="round"/><path d="M42 44 33 68M58 44l9 24" stroke="#3b2c1f" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="37" r="9" fill="#ffe27a" stroke="#3b2c1f" stroke-width="4"/></svg>`;
const CASSETTE = `<div class="sticker sticker--cassette"><span class="cassette__label">album</span><span class="cassette__window"><i></i><b></b><i></i></span></div>`;

const SLOTS = [
  { top: "-16px", left: "-18px", rotate: "-13deg" },
  { top: "12px", right: "-18px", rotate: "12deg" },
  { top: "56%", left: "-32px", rotate: "-9deg" },
  { bottom: "92px", right: "-28px", rotate: "7deg" },
];

const SIZES = { heart: 54, sparkle: 38, bow: 64 };

let notes = [];
let settings = { hasKey: false, model: "deepseek-chat" };
let selectedDate = dateKey(new Date());
let weekDate = selectedDate; // день, вокруг которого показана неделя
let yearCursor = new Date().getFullYear();
let currentId = null;
let editingId = null;
let draft = null;
let busy = false;
let songTouched = false; // песню вписали руками — авто её не перебивает
let energyTouched = false; // характер менял человек — авто не перебивает
let toastTimer = null;

const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
));

function plural(n, one, few, many) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}

const memories = (n) => `${n} ${plural(n, "воспоминание", "воспоминания", "воспоминаний")}`;

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("is-open");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-open"), 2600);
}

function currentNote() {
  return notes.find((n) => n.id === currentId) || null;
}

function setCursorFromKey(key) {
  weekDate = key;
}

function replaceNote(note) {
  const index = notes.findIndex((n) => n.id === note.id);
  if (index === -1) notes.push(note);
  else notes[index] = note;
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ----------------------------- отрисовка ----------------------------- */

function renderNote() {
  const note = currentNote();
  const noteEl = $("#note");
  const accent = `var(--${note ? paletteOfNote(note) : "mint"})`;
  noteEl.style.setProperty("--note-accent", accent);
  document.querySelector(".phone").style.setProperty("--note-accent", accent);
  $("#note-title").textContent = note ? note.title : "Здесь появится воспоминание";
  $("#note-text").textContent = note
    ? note.text || "Без слов — только фото."
    : "Выберите фото, напишите пару слов. ИИ подберёт фон, наклейки и музыку.";
  $("#note-date").textContent = note ? `${formatDate(note.date)} · ${moodLabel(note.mood)}` : "";
}

function stickerMarkup(type, index) {
  const slot = SLOTS[index % SLOTS.length];
  const style = [
    slot.top && `top:${slot.top}`,
    slot.left && `left:${slot.left}`,
    slot.right && `right:${slot.right}`,
    slot.bottom && `bottom:${slot.bottom}`,
    `transform:rotate(${slot.rotate})`,
    `z-index:${3 + (index % 2)}`,
  ].filter(Boolean).join(";");

  if (type === "heart" || type === "sparkle" || type === "bow") {
    const svg = type === "heart" ? HEART : type === "sparkle" ? SPARKLE : BOW;
    return `<span class="sticker" style="${style};width:${SIZES[type]}px;height:auto">${svg}</span>`;
  }
  if (type === "cassette") return CASSETTE.replace('class="sticker sticker--cassette"', `class="sticker sticker--cassette" style="${style}"`);
  if (type === "tape") return `<span class="sticker sticker--tape" style="${style}"></span>`;
  return `<span class="sticker sticker--plaster" style="${style}"></span>`;
}

function renderStage() {
  const note = currentNote();
  const stage = $("#stage");

  if (!note) {
    delete stage.dataset.energy;
    applyPhotoTint(null);
    stage.innerHTML = `<div class="stage__inner">
      <figure class="photo">${EMPTY_ART}
        <div class="photo__fade"></div>
        <figcaption class="photo__caption"><div><b>Пока пусто</b><span>нажмите «Добавить»</span></div></figcaption>
      </figure>
    </div>`;
    return;
  }

  stage.style.setProperty("--note-accent", `var(--${paletteOfNote(note)})`);
  stage.dataset.energy = note.song?.energy || "medium";
  const image = note.photo
    ? `<img class="photo__img" src="${photoSrc(note.photo)}" alt="" crossorigin="anonymous">`
    : EMPTY_ART;
  const song = note.song || {};
  const songLine = song.title
    ? (song.url
      ? `<button class="photo__song" type="button" data-song="${esc(song.url)}" title="Открыть песню: ${esc(song.title)}">♪ ${esc(song.title)}</button>`
      : `<span class="photo__song" title="${esc(song.title)}">♪ ${esc(song.title)}</span>`)
    : "";

  stage.innerHTML = `<div class="stage__inner">
    <figure class="photo">
      ${image}
      <span class="photo__tint"></span>
      <div class="photo__fade"></div>
      <figcaption class="photo__caption">
        <div><b>${esc(note.title)}</b><span>${esc(formatDate(note.date))}</span>${songLine}</div>
        <button class="photo__like ${note.liked ? "is-on" : ""}" type="button" data-like aria-label="Нравится" aria-pressed="${note.liked}">
          <i class="icon i-like"></i>
        </button>
      </figcaption>
    </figure>
    ${note.stickers.map(stickerMarkup).join("")}
  </div>`;
  applyPhotoTint(note.photo);
}

function renderActions() {
  const note = currentNote();
  const index = notes.findIndex((n) => n.id === currentId);
  const state = engine.state();
  const play = $("#btn-play");

  play.disabled = !note;
  $("#btn-edit").disabled = !note;
  $("#btn-delete").disabled = !note;

  const playing = Boolean(state.playing);
  play.classList.toggle("is-playing", playing);
  play.setAttribute("aria-label", playing ? "Остановить музыку" : "Играть музыку");
  const playIcon = play.querySelector(".icon");
  playIcon.classList.toggle("i-music", !playing);
  playIcon.classList.toggle("i-pause", playing);

  $("#btn-prev").disabled = !notes.length || index === notes.length - 1;
  $("#btn-next").disabled = !notes.length || (index !== -1 && index === 0);
}

function latestNotesByDay() {
  const map = new Map();
  for (const note of notes) if (!map.has(note.date)) map.set(note.date, note);
  return map;
}

function renderCalendar() {
  const anchor = parseDateKey(weekDate);
  const summary = monthSummary(notes, anchor.getFullYear(), anchor.getMonth());
  const week = weekMatrix(weekDate);
  const first = parseDateKey(week[0].key);
  const last = parseDateKey(week[6].key);
  const range = first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ${monthGenitive(last.getMonth())}`
    : `${first.getDate()} ${monthGenitive(first.getMonth())} — ${last.getDate()} ${monthGenitive(last.getMonth())}`;

  $("#cal-title").textContent = summary.title;
  $("#cal-sub").textContent = `${anchor.getFullYear()} · ${range}`;
  const weekNotes = notes.filter((n) => week.some((cell) => cell.key === n.date));
  $("#cal-foot").textContent = `${memories(weekNotes.length)} на неделе`;

  const latest = latestNotesByDay();
  const today = dateKey(new Date());
  $("#cal-grid").innerHTML = week.map((cell) => {
    const note = latest.get(cell.key);
    const classes = ["cal__day"];
    if (!cell.inMonth) classes.push("is-out");
    if (cell.key === today) classes.push("is-today");
    if (cell.key === selectedDate) classes.push("is-active");
    if (note) classes.push("has-note");
    const dot = note ? ` style="--dot:var(--${paletteOfNote(note)})"` : "";
    return `<button class="${classes.join(" ")}" type="button" data-key="${cell.key}"${dot} aria-label="${esc(formatDate(cell.key))}">${cell.day}</button>`;
  }).join("");
}

function renderYear() {
  const latest = latestNotesByDay();
  const today = dateKey(new Date());
  $("#year-title").textContent = yearCursor;
  $("#year-sub").textContent = "12 месяцев";
  $("#year-grid").innerHTML = Array.from({ length: 12 }, (_, month) => {
    const summary = monthSummary(notes, yearCursor, month);
    const days = monthMatrix(yearCursor, month).map((cell) => {
      const note = latest.get(cell.key);
      const classes = ["ymonth__day"];
      if (!cell.inMonth) classes.push("is-out");
      if (cell.key === today) classes.push("is-today");
      if (cell.key === selectedDate) classes.push("is-active");
      if (note) classes.push("has-note");
      const dot = note ? ` style="--dot:var(--${paletteOfNote(note)})"` : "";
      return `<button class="${classes.join(" ")}" type="button" data-key="${cell.key}"${dot} aria-label="${esc(formatDate(cell.key))}"></button>`;
    }).join("");
    return `<div class="ymonth">
      <button class="ymonth__name" type="button" data-month="${month}">${monthName(month)}<span class="ymonth__count">${summary.days || ""}</span></button>
      <div class="ymonth__grid">${days}</div>
    </div>`;
  }).join("");
}

function renderSummary(year, month) {
  const summary = monthSummary(notes, year, month);
  $("#summary-title").textContent = summary.title;
  $("#summary-meta").textContent = summary.days
    ? `${monthName(month)} ${year} · ${summary.days} ${plural(summary.days, "день", "дня", "дней")} с записями · ${summary.photos} фото`
    : `${monthName(month)} ${year} · пока пусто`;
  $("#summary-moods").innerHTML = summary.moods.map(([mood, count]) => {
    const palette = MOODS[mood]?.palette || "mint";
    return `<span class="summary__mood" style="--dot:var(--${palette})">${moodLabel(mood)} · ${count}</span>`;
  }).join("");
  const shots = summary.notes.filter((n) => n.photo).slice(-6);
  $("#summary-collage").innerHTML = shots.length
    ? shots.map((note) => `<button class="summary__shot" type="button" data-key="${note.date}" style="--dot:var(--${paletteOfNote(note)})" aria-label="Открыть ${esc(formatDate(note.date))}"><img src="${photoSrc(note.photo)}" alt=""><span>${parseDateKey(note.date).getDate()}</span></button>`).join("")
    : '<p class="caption">В этом месяце нет фото — только слова и музыка.</p>';
  $("#summary-song").textContent = summary.song ? `Чаще всего звучала ♪ ${summary.song}` : "";
}

function openYear() {
  const anchor = parseDateKey(weekDate);
  yearCursor = anchor.getFullYear();
  renderYear();
  openSheet("#sheet-year");
  setTimeout(() => {
    $("#year-grid").querySelector(`[data-month="${anchor.getMonth()}"]`)?.scrollIntoView({ block: "center" });
  }, 360);
}

function openSummary(year, month) {
  renderSummary(year, month);
  openSheet("#sheet-summary");
}

function selectDay(key) {
  selectedDate = key;
  const list = notesOn(notes, key);
  currentId = list[0]?.id || null;
  setCursorFromKey(key);
  renderAll();
  sfx("tap");
}

function shiftWeek(delta) {
  const d = parseDateKey(weekDate);
  d.setDate(d.getDate() + delta * 7);
  weekDate = dateKey(d);
  const hit = weekMatrix(weekDate)
    .map((cell) => notesOn(notes, cell.key)[0])
    .find(Boolean);
  if (hit) {
    selectedDate = hit.date;
    currentId = hit.id;
  } else {
    selectedDate = weekDate;
    currentId = null;
  }
  renderAll();
  sfx("tap");
}

function renderCount() {
  $("#album-count").textContent = notes.length ? memories(notes.length) : "пока пусто";
}

function renderAll() {
  renderNote();
  renderStage();
  renderActions();
  renderCalendar();
  renderCount();
}

/* ----------------------------- заметки ----------------------------- */

function showNote(note, moveCalendar = true) {
  currentId = note ? note.id : null;
  if (note) {
    selectedDate = note.date;
    if (moveCalendar) setCursorFromKey(note.date);
  }
  renderAll();
}

async function toggleLike() {
  const note = currentNote();
  if (!note) return;
  const res = await api.update(note.id, { liked: !note.liked });
  if (!res.ok) return toast(res.error);
  sfx("like");
  replaceNote(res.data);
  renderAll();
}

async function removeNote() {
  const note = currentNote();
  if (!note) return;
  if (!confirm(`Удалить «${note.title}»?`)) return;
  const res = await api.remove(note.id);
  if (!res.ok) return toast(res.error);
  notes = notes.filter((n) => n.id !== note.id);
  if (engine.state().playing) engine.stop();
  const next = notes[0] || null;
  currentId = next?.id || null;
  if (next) { selectedDate = next.date; setCursorFromKey(next.date); }
  renderAll();
  toast("Удалено");
}

function step(direction) {
  if (!notes.length) return;
  const index = notes.findIndex((n) => n.id === currentId);
  if (index === -1) return showNote(notes[0]);
  const next = direction === "older" ? index + 1 : index - 1;
  if (next < 0 || next >= notes.length) return toast("Это край альбома");
  showNote(notes[next]);
}

/* ----------------------------- добавление ----------------------------- */

function setPhotoPreview(name) {
  const img = $("#photo-preview");
  const hint = $("#photo-hint");
  if (name) {
    img.src = photoSrc(name);
    img.hidden = false;
    hint.innerHTML = '<i class="icon i-camera"></i>Заменить фото';
  } else {
    img.removeAttribute("src");
    img.hidden = true;
    hint.innerHTML = '<i class="icon i-camera"></i>Выбрать фото';
  }
}

function paintMoodChips() {
  document.querySelectorAll("[data-mood]").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.mood === draft?.mood);
  });
}

function paintEnergyChips() {
  document.querySelectorAll("#energy-chips [data-energy]").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.energy === (draft?.song?.energy || "medium"));
  });
}

function applyStyle(style, withTitle = false) {
  draft.mood = style.mood;
  draft.palette = style.palette;
  draft.stickers = [...style.stickers];
  draft.music = { tempo: style.tempo, scale: style.scale, seed: draft.music?.seed || "" };
  if (withTitle && style.title) draft.title = style.title;
  paintMoodChips();
  suggestSong();
}

// Песня по умолчанию подбирается сама по настроению; вписанную руками не трогаем.
function suggestSong() {
  if (!draft || songTouched) return;
  const song = songFor(`${$("#draft-text").value} ${draft.title || ""}`, draft.mood);
  $("#draft-song").value = song.title;
  draft.song = {
    title: song.title,
    url: song.url,
    energy: energyTouched ? draft.song?.energy || song.energy : song.energy,
  };
  paintEnergyChips();
}

function songFromForm() {
  const title = $("#draft-song").value.trim();
  return {
    title,
    // Своё название получает поиск YouTube, у сохранённой песни остаётся её ссылка.
    url: draft?.song?.title === title ? draft.song.url || "" : title ? songUrlFor(title) : "",
    energy: draft?.song?.energy || "medium",
  };
}

function openAdd(note = null) {
  editingId = note?.id || null;
  if (note) {
    draft = {
      ...note,
      stickers: [...note.stickers],
      music: { ...note.music },
      song: { ...(note.song || {}) },
    };
  } else {
    const style = styleForMood("calm");
    draft = {
      photo: null, text: "", title: "", date: selectedDate, mood: style.mood, palette: style.palette,
      stickers: style.stickers, music: { tempo: style.tempo, scale: style.scale, seed: "" }, liked: false,
      song: { title: "", url: "", energy: "medium" },
    };
  }

  $("#add-title").textContent = note ? "Изменить воспоминание" : "Новое воспоминание";
  $("#draft-text").value = draft.text || "";
  $("#draft-date").value = draft.date || selectedDate;
  $("#draft-song").value = draft.song.title || "";
  songTouched = !!note;
  energyTouched = !!note;
  $("#ai-status").textContent = settings.hasKey ? "" : "ключа нет — стиль подберётся локально";
  setPhotoPreview(draft.photo);
  paintMoodChips();
  suggestSong();
  paintEnergyChips();
  openSheet("#sheet-add");
}

async function pickPhoto() {
  const res = await api.pickPhoto();
  if (!res.ok) return toast(res.error);
  if (!res.data) return;
  draft.photo = res.data;
  setPhotoPreview(draft.photo);
}

function setBusy(value, message = "") {
  busy = value;
  $("#btn-ai-text").disabled = value;
  $("#btn-ai-style").disabled = value;
  $("#btn-save").disabled = value;
  $("#ai-status").textContent = message;
}

async function runAI(kind) {
  if (busy) return;
  const text = $("#draft-text").value.trim();
  const song = songFromForm();

  if (!settings.hasKey) {
    if (kind === "style") {
      applyStyle(styleForMood(moodFor(`${text} ${song.title || ""}`)));
      toast("Без ключа: стиль по тексту и песне");
    } else {
      toast("Добавьте ключ DeepSeek в настройках");
    }
    return;
  }
  if (kind === "improve" && !text) return toast("Сначала напишите пару слов");

  setBusy(true, kind === "improve" ? "улучшаю текст…" : "подбираю стиль…");
  const res = kind === "improve" ? await api.improveText(text) : await api.styleFromText(text, song);
  setBusy(false);

  if (!res.ok) return toast(res.error);
  if (kind === "improve") {
    $("#draft-text").value = res.data.text;
    draft.text = res.data.text;
    draft.title = res.data.title;
    toast("Текст обновлён");
  } else {
    applyStyle(res.data, true);
    toast(`Стиль: ${moodLabel(res.data.mood)} · ${res.data.palette}`);
  }
}

async function saveNote() {
  if (busy || !draft) return;
  suggestSong();
  const text = $("#draft-text").value.trim();
  if (!text && !draft.photo) return toast("Добавьте фото или пару слов");

  const song = songFromForm();

  const wasEditing = editingId;
  const payload = {
    text,
    photo: draft.photo,
    date: $("#draft-date").value || selectedDate,
    palette: draft.palette,
    mood: draft.mood,
    stickers: draft.stickers,
    music: draft.music,
    song,
    title: draft.title || titleFromText(text),
  };

  setBusy(true, "записываю…");
  const res = wasEditing ? await api.update(wasEditing, payload) : await api.add(payload);
  setBusy(false);
  if (!res.ok) return toast(res.error);

  sfx("save");
  replaceNote(res.data);
  selectedDate = res.data.date;
  currentId = res.data.id;
  setCursorFromKey(res.data.date);
  editingId = null;
  closeOverlays();
  renderAll();
  engine.play(res.data);
  toast(wasEditing ? "Воспоминание обновлено" : "Записано в альбом");
}

/* ----------------------------- настройки ----------------------------- */

function paintModelChips() {
  document.querySelectorAll("[data-model]").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.model === settings.model);
  });
}

function paintSfxChips() {
  document.querySelectorAll("#sfx-chips [data-sfx]").forEach((chip) => {
    chip.classList.toggle("is-active", (chip.dataset.sfx === "on") === sfxOn());
  });
}

function openSettings() {
  const input = $("#api-key");
  input.value = "";
  input.placeholder = settings.builtin
    ? "ключ встроен — поле можно не заполнять"
    : settings.hasKey ? "ключ сохранён — введите новый, чтобы заменить" : "sk-…";
  $("#key-status").textContent = settings.builtin
    ? "Используется встроенный ключ DeepSeek."
    : settings.hasKey ? "Ключ сохранён локально." : "Ключа нет: ИИ-кнопки работают в локальном режиме.";
  paintModelChips();
  paintSfxChips();
  openSheet("#sheet-settings");
}

async function saveKey(clear = false) {
  const key = $("#api-key").value.trim();
  const res = await api.saveSettings(clear ? { apiKey: "" } : { apiKey: key || undefined, model: settings.model });
  if (!res.ok) return toast(res.error);
  settings = res.data;
  $("#key-status").textContent = settings.builtin
    ? "Используется встроенный ключ DeepSeek."
    : settings.hasKey ? "Ключ сохранён локально." : "Ключ удалён.";
  $("#api-key").value = "";
  $("#api-key").placeholder = settings.builtin
    ? "ключ встроен — поле можно не заполнять"
    : settings.hasKey ? "ключ сохранён — введите новый, чтобы заменить" : "sk-…";
  toast(settings.builtin ? "Встроенный ключ" : settings.hasKey ? "Ключ сохранён" : "Ключ удалён");
}

/* ----------------------------- шторки ----------------------------- */

const scrim = $("#scrim");

function openSheet(selector) {
  sfx("page");
  document.querySelectorAll(".sheet").forEach((sheet) => {
    const open = `#${sheet.id}` === selector;
    sheet.classList.toggle("is-open", open);
    sheet.setAttribute("aria-hidden", String(!open));
  });
  scrim.classList.add("is-open");
  const first = document.querySelector(`${selector} textarea, ${selector} input`);
  if (first) setTimeout(() => first.focus(), 340);
}

function closeOverlays() {
  if (document.querySelector(".sheet.is-open")) sfx("page");
  document.querySelectorAll(".sheet").forEach((sheet) => {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
  });
  scrim.classList.remove("is-open");
}

/* ----------------------------- события ----------------------------- */

function bind() {
  $("#note-head").addEventListener("click", () => {
    const open = $("#note").classList.toggle("is-open");
    $("#note-head").setAttribute("aria-expanded", String(open));
  });

  $("#btn-prev").addEventListener("click", () => step("older"));
  $("#btn-next").addEventListener("click", () => step("newer"));
  $("#btn-add").addEventListener("click", () => openAdd());
  $("#btn-edit").addEventListener("click", () => {
    const note = currentNote();
    if (note) openAdd(note);
  });
  $("#btn-delete").addEventListener("click", removeNote);
  $("#btn-play").addEventListener("click", () => {
    if (engine.state().playing) return engine.stop();
    const note = currentNote();
    if (note) engine.play(note);
  });
  $("#btn-settings").addEventListener("click", openSettings);

  $("#stage").addEventListener("click", (event) => {
    const song = event.target.closest("[data-song]");
    if (song) {
      api.openExternal(song.dataset.song).then((res) => {
        if (!res.ok) toast(res.error);
      });
      return;
    }
    if (event.target.closest("[data-like]")) toggleLike();
  });

  $("#cal-grid").addEventListener("click", (event) => {
    const cell = event.target.closest("[data-key]");
    if (cell) selectDay(cell.dataset.key);
  });
  $("#cal-prev").addEventListener("click", () => shiftWeek(-1));
  $("#cal-next").addEventListener("click", () => shiftWeek(1));
  $("#cal-today").addEventListener("click", () => selectDay(dateKey(new Date())));
  $("#cal-open").addEventListener("click", openYear);
  $("#cal-year").addEventListener("click", openYear);
  $("#cal-summary").addEventListener("click", () => {
    const d = parseDateKey(weekDate);
    openSummary(d.getFullYear(), d.getMonth());
  });

  $("#year-prev").addEventListener("click", () => {
    yearCursor -= 1;
    renderYear();
    sfx("tap");
  });
  $("#year-next").addEventListener("click", () => {
    yearCursor += 1;
    renderYear();
    sfx("tap");
  });
  $("#year-grid").addEventListener("click", (event) => {
    const day = event.target.closest("[data-key]");
    if (day) {
      selectDay(day.dataset.key);
      closeOverlays();
      return;
    }
    const month = event.target.closest("[data-month]");
    if (!month) return;
    const index = Number(month.dataset.month);
    const today = new Date();
    const prefix = `${yearCursor}-${String(index + 1).padStart(2, "0")}-`;
    const first = notes.filter((n) => n.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date))[0];
    const key = today.getFullYear() === yearCursor && today.getMonth() === index
      ? dateKey(today)
      : first?.date || dateKey(new Date(yearCursor, index, 1));
    selectDay(key);
    closeOverlays();
  });

  $("#summary-collage").addEventListener("click", (event) => {
    const shot = event.target.closest("[data-key]");
    if (!shot) return;
    selectDay(shot.dataset.key);
    closeOverlays();
  });

  $("#pick-photo").addEventListener("click", pickPhoto);
  $("#btn-ai-text").addEventListener("click", () => runAI("improve"));
  $("#btn-ai-style").addEventListener("click", () => runAI("style"));
  $("#btn-save").addEventListener("click", saveNote);
  $("#draft-song").addEventListener("input", () => {
    songTouched = true;
  });

  $("#mood-chips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-mood]");
    if (!chip) return;
    applyStyle(styleForMood(chip.dataset.mood));
  });

  $("#energy-chips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-energy]");
    if (!chip || !draft) return;
    energyTouched = true;
    draft.song.energy = chip.dataset.energy;
    paintEnergyChips();
  });

  $("#model-chips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-model]");
    if (!chip) return;
    settings.model = chip.dataset.model;
    paintModelChips();
  });

  $("#sfx-chips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-sfx]");
    if (!chip) return;
    setSfx(chip.dataset.sfx === "on");
    paintSfxChips();
    if (chip.dataset.sfx === "on") sfx("tap");
  });

  $("#btn-save-key").addEventListener("click", () => saveKey(false));
  $("#btn-clear-key").addEventListener("click", () => saveKey(true));

  scrim.addEventListener("click", closeOverlays);
  document.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeOverlays));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOverlays();
  });

  engine.onChange(renderActions);

  // Ушли из приложения — музыка замолкает, кнопка возвращается в исходное состояние.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) engine.stop();
  });
  window.addEventListener("pagehide", () => engine.stop());
}

function buildChips() {
  $("#mood-chips").innerHTML = Object.entries(MOODS)
    .map(([key, mood]) => `<button class="chip" type="button" data-mood="${key}" style="--dot:var(--${mood.palette})">${mood.label}</button>`)
    .join("");
  $("#energy-chips").innerHTML = [["quiet", "тихая"], ["medium", "средняя"], ["loud", "громкая"]]
    .map(([id, label]) => `<button class="chip chip--plain" type="button" data-energy="${id}">${label}</button>`)
    .join("");
  $("#model-chips").innerHTML = [["deepseek-chat", "chat"], ["deepseek-reasoner", "reasoner"]]
    .map(([id, label]) => `<button class="chip chip--plain" type="button" data-model="${id}">${label}</button>`)
    .join("");
}

function maybeMonthCheckup() {
  const now = new Date();
  if (now.getDate() > 3) return;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const key = `${prev.getFullYear()}-${prev.getMonth()}`;
  if (localStorage.getItem("album.monthSeen") === key) return;
  const summary = monthSummary(notes, prev.getFullYear(), prev.getMonth());
  if (!summary.days) return;
  localStorage.setItem("album.monthSeen", key);
  setTimeout(() => openSummary(prev.getFullYear(), prev.getMonth()), 1000);
}

async function init() {
  buildChips();
  bind();

  const res = await api.init();
  if (!res.ok) {
    toast(res.error);
    return;
  }
  notes = res.data.notes;
  settings = res.data.settings;

  const latest = notes[0];
  if (latest) {
    currentId = latest.id;
    selectedDate = latest.date;
    setCursorFromKey(latest.date);
  }
  renderAll();
  maybeMonthCheckup();
}

init();
