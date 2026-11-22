import test from "node:test";
import assert from "node:assert/strict";
import {
  MOODS, STICKERS, moodFor, normalizeStyle, styleForMood, monthMatrix, formatDate, titleFromText,
  dateKey, notesOn, songFor, songUrlFor, weekMatrix, monthSummary,
} from "../src/logic.mjs";

test("moodFor понимает русские и английские слова", () => {
  assert.equal(moodFor("люблю тебя, сердце стучит"), "love");
  assert.equal(moodFor("дождь и очень грустно"), "sad");
  assert.equal(moodFor("ночь, луна и звёзды"), "night");
  assert.equal(moodFor(""), "calm");
});

test("normalizeStyle отбрасывает мусор от ИИ", () => {
  const style = normalizeStyle({ mood: "love", palette: "хакерский", stickers: ["heart", "bomb", "bow"], tempo: 999, scale: "blues" }, "calm");
  assert.equal(style.palette, "pink");
  assert.deepEqual(style.stickers, ["heart", "bow"]);
  assert.equal(style.tempo, 140);
  assert.equal(style.scale, "major");
});

test("наклейки: у каждого настроения свой пул, на день берётся 4", () => {
  for (const [mood, m] of Object.entries(MOODS)) {
    const style = styleForMood(mood, "текст дня");
    assert.equal(style.stickers.length, 4, mood);
    assert.equal(new Set(style.stickers).size, 4, mood);
    for (const s of style.stickers) {
      assert.ok(m.stickers.includes(s), `${mood}: ${s} нет в пуле`);
      assert.ok(STICKERS.includes(s), `${mood}: ${s} не проходит normalizeStyle`);
    }
  }
  const sets = new Set(["а", "б", "в"].map((s) => styleForMood("joy", s).stickers.join(",")));
  assert.ok(sets.size > 1, "seed должен менять набор наклеек");
});

test("monthMatrix: 42 клетки, ноябрь 2026 начинается в воскресенье", () => {
  const cells = monthMatrix(2026, 10);
  assert.equal(cells.length, 42);
  assert.equal(new Set(cells.map((c) => c.key)).size, 42);
  assert.equal(cells[6].key, "2026-11-01");
  assert.equal(cells[6].inMonth, true);
  assert.equal(cells[0].key, "2026-10-26");
  assert.equal(cells[0].inMonth, false);
});

test("даты и подписи", () => {
  assert.equal(formatDate("2026-11-20"), "20 ноября 2026");
  assert.equal(dateKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("titleFromText режет длинное название", () => {
  assert.equal(titleFromText("  привет   мир "), "привет мир");
  assert.equal(titleFromText(""), "Без названия");
  assert.ok(titleFromText("слово ".repeat(30)).length <= 60);
  assert.equal(
    titleFromText("Гуляли по парку, всё в жёлтых листьях. Пили какао."),
    "Гуляли по парку, всё в жёлтых листьях",
  );
});

test("notesOn возвращает только нужный день, свежие сверху", () => {
  const notes = [
    { id: "a", date: "2026-11-20", createdAt: "2026-11-20T10:00:00Z" },
    { id: "b", date: "2026-11-20", createdAt: "2026-11-20T12:00:00Z" },
    { id: "c", date: "2026-11-21", createdAt: "2026-11-21T09:00:00Z" },
  ];
  assert.deepEqual(notesOn(notes, "2026-11-20").map((n) => n.id), ["b", "a"]);
});

test("songFor подбирает песню по настроению и тексту", () => {
  const quiet = songFor("ночь, луна и тишина", "night");
  assert.equal(quiet.energy, "medium");
  assert.ok(quiet.title.includes(" — "));
  assert.ok(quiet.url.startsWith("https://www.youtube.com/results?search_query="));
  assert.equal(songFor("", "calm").energy, "quiet");
  assert.equal(songFor("", "bright").energy, "loud");
  assert.notEqual(songFor("совсем другой день", "joy").title, songFor("", "joy").title);
  assert.equal(songFor("", "joy").title, songFor("", "joy").title);
});

test("songUrlFor открывает прямую ссылку как есть", () => {
  const link = "https://music.yandex.ru/album/1/track/2";
  assert.equal(songUrlFor(link), link);
  assert.ok(songUrlFor("Molchat Doma Судно").startsWith("https://www.youtube.com/results?search_query="));
});

test("weekMatrix: неделя с понедельника по воскресенье", () => {
  const week = weekMatrix("2026-11-21");
  assert.equal(week.length, 7);
  assert.equal(week[0].key, "2026-11-16");
  assert.equal(week[6].key, "2026-11-22");
  assert.equal(week[5].day, 21);
  assert.ok(week.every((c) => c.inMonth));
});

test("monthSummary: заголовок по настроению и статистика", () => {
  const notes = [
    { date: "2026-11-01", mood: "night", photo: "a.jpg", song: { title: "The xx — Intro" }, createdAt: "1" },
    { date: "2026-11-01", mood: "night", photo: "", song: { title: "The xx — Intro" }, createdAt: "2" },
    { date: "2026-11-05", mood: "love", photo: "b.jpg", song: { title: "Sade — By Your Side" }, createdAt: "3" },
    { date: "2026-12-01", mood: "joy", photo: "", song: {}, createdAt: "4" },
  ];
  const s = monthSummary(notes, 2026, 10);
  assert.equal(s.title, "Ночной ноябрь");
  assert.equal(s.days, 2);
  assert.equal(s.photos, 2);
  assert.equal(s.notes.length, 3);
  assert.equal(s.song, "The xx — Intro");
  assert.deepEqual(s.moods[0], ["night", 2]);
  assert.equal(monthSummary(notes, 2025, 10).title, "Ноябрь");
});
