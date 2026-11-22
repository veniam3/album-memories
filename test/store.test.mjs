import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStore } from "../src/store.mjs";

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "album-"));
  return { dir, store: createStore(dir) };
}

test("заметка сохраняется, читается после перезапуска и обновляется", () => {
  const { dir, store } = tmpStore();
  const note = store.add({ text: "первый день", date: "2026-11-20", palette: "pink", stickers: ["heart", "bow"] });

  assert.ok(note.id);
  assert.equal(note.title, "первый день");
  assert.equal(note.music.seed, note.id);

  const reopened = createStore(dir);
  assert.equal(reopened.list().length, 1);
  assert.equal(reopened.list()[0].palette, "pink");

  const updated = reopened.update(note.id, { liked: true, text: "новый текст" });
  assert.equal(updated.liked, true);
  assert.equal(updated.text, "новый текст");
  assert.equal(updated.music.seed, note.id);
});

test("чужие значения заменяются безопасными", () => {
  const { store } = tmpStore();
  const note = store.add({ text: "x", date: "не дата", palette: "neon", stickers: ["heart", "bomb"], music: { tempo: 9999 } });
  assert.equal(note.date.length, 10);
  assert.equal(note.palette, "mint");
  assert.deepEqual(note.stickers, ["heart"]);
  assert.equal(note.music.tempo, 140);
});

test("песня сохраняется, ссылка чистится, мелодия сеется названием", () => {
  const { store } = tmpStore();
  const note = store.add({
    text: "день",
    song: { title: "Frank Sinatra — Fly Me to the Moon", url: "javascript:alert(1)", energy: "loud" },
  });

  assert.equal(note.song.title, "Frank Sinatra — Fly Me to the Moon");
  assert.equal(note.song.url, "");
  assert.equal(note.song.energy, "loud");
  assert.equal(note.music.seed, note.song.title.slice(0, 40));

  const good = store.add({
    text: "день",
    song: { title: "Песня", url: "https://music.yandex.ru/track/1", energy: "quiet" },
  });
  assert.equal(good.song.url, "https://music.yandex.ru/track/1");
  assert.equal(good.song.energy, "quiet");
});

test("день лежит в отдельной папке с названием", () => {
  const { dir, store } = tmpStore();
  const src = path.join(dir, "src.png");
  fs.writeFileSync(src, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const photo = store.importPhoto(src);
  const note = store.add({
    text: "Гуляли по парку. Пили какао.",
    photo,
    song: { title: "Fly Me", url: "https://example.com/song" },
  });

  const days = path.join(dir, "days");
  assert.deepEqual(fs.readdirSync(days), ["Гуляли по парку"]);
  const folder = path.join(days, "Гуляли по парку");
  assert.equal(fs.readFileSync(path.join(folder, "text.txt"), "utf8"), "Гуляли по парку. Пили какао.");
  assert.match(fs.readFileSync(path.join(folder, "song.txt"), "utf8"), /Fly Me/);
  assert.ok(fs.existsSync(path.join(folder, "photo.png")));
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(path.join(folder, "photo.png")).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(store.photosDir, photo)).mode & 0o777, 0o600);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(folder, "note.json"), "utf8")).id, note.id);

  store.update(note.id, { title: "Осенний парк и какао" });
  assert.deepEqual(fs.readdirSync(days), ["Осенний парк и какао"]);

  store.remove(note.id);
  assert.deepEqual(fs.readdirSync(days), []);
});

test("удаление заметки убирает её фото", () => {
  const { store } = tmpStore();
  const src = path.join(store.photosDir, "..", "src.png");
  fs.writeFileSync(src, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const photo = store.importPhoto(src);
  const note = store.add({ text: "с фото", photo });

  assert.ok(fs.existsSync(path.join(store.photosDir, photo)));
  assert.equal(store.remove(note.id), true);
  assert.equal(fs.existsSync(path.join(store.photosDir, photo)), false);
});

test("photoPath не выпускает из папки", () => {
  const { store } = tmpStore();
  assert.equal(store.photoPath("../../etc/passwd"), null);
  assert.equal(store.photoPath("нет-такого.jpg"), null);
});

test("importPhoto отклоняет не-картинки", () => {
  const { dir, store } = tmpStore();
  const bad = path.join(dir, "virus.exe");
  fs.writeFileSync(bad, "MZ");
  assert.throws(() => store.importPhoto(bad), /unsupported_photo/);

  // Текст с картинным расширением — тоже не картинка.
  const fake = path.join(dir, "fake.jpg");
  fs.writeFileSync(fake, "not an image at all");
  assert.throws(() => store.importPhoto(fake), /unsupported_photo/);
});

test("ключ API не отдаётся в настройках, но сохраняется", () => {
  const { store } = tmpStore();
  // Ключ встроен в сборку: жюри не вводит его руками.
  const initial = store.getSettings();
  assert.equal(initial.builtin, true);
  assert.equal(initial.hasKey, true);
  assert.equal("apiKey" in initial, false);
  assert.match(store.getApiKey(), /^sk-[0-9a-f]{32}$/);

  store.saveSettings({ apiKey: "test-key-123", model: "deepseek-reasoner" });
  assert.deepEqual(store.getSettings(), { hasKey: true, builtin: false, model: "deepseek-reasoner" });
  assert.equal(store.getApiKey(), "test-key-123");

  // Удаление своего ключа возвращает встроенный, а не ломает ИИ.
  store.saveSettings({ apiKey: "" });
  assert.equal(store.getSettings().builtin, true);
  assert.match(store.getApiKey(), /^sk-[0-9a-f]{32}$/);
});
