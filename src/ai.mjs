// DeepSeek: улучшение текста и подбор оформления. Ключ живёт только в main-процессе.
import { PALETTES, STICKERS, SCALES, MOODS, moodFor, normalizeStyle, titleFromText } from "./logic.mjs";

const BASE = "https://api.deepseek.com";

async function chat({ apiKey, model, system, user, maxTokens = 700 }) {
  let res;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model === "deepseek-reasoner" ? "deepseek-reasoner" : "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(40000),
    });
  } catch {
    throw new Error("Нет связи с DeepSeek. Проверьте интернет.");
  }

  if (res.status === 401) throw new Error("Ключ не принят. Проверьте его в настройках.");
  if (res.status === 402) throw new Error("На балансе DeepSeek нет средств.");
  if (res.status === 429) throw new Error("Слишком много запросов. Подождите минуту.");
  if (!res.ok) throw new Error(`DeepSeek ответил ошибкой ${res.status}.`);

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""));
  } catch {
    throw new Error("Не удалось разобрать ответ ИИ.");
  }
}

export async function improveText({ apiKey, model, text }) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Сначала напишите пару слов.");
  const data = await chat({
    apiKey,
    model,
    system:
      "Ты бережный редактор личного дневника. Улучшай текст, сохраняя голос автора: без пафоса, канцелярита и выдуманных фактов. Верни строго JSON.",
    user:
      `Текст: """${source}"""\n\n` +
      'Верни JSON: {"title": "короткое название 3–6 слов", "text": "улучшенный текст, 1–3 абзаца, на языке автора"}.',
    maxTokens: 900,
  });
  const textOut = String(data.text ?? "").trim().slice(0, 5000);
  if (!textOut) throw new Error("ИИ вернул пустой текст.");
  return { title: String(data.title ?? "").trim().slice(0, 120) || titleFromText(textOut), text: textOut };
}

export async function styleFromText({ apiKey, model, text, song = {} }) {
  const source = String(text || "").trim() || "спокойный день без слов";
  const songTitle = String(song.title || "").trim();
  const energy = ["quiet", "medium", "loud"].includes(song.energy) ? song.energy : "medium";
  const energyLabel = { quiet: "тихая", medium: "средняя", loud: "громкая" }[energy];
  const fallback = moodFor(`${source} ${songTitle}`);
  const data = await chat({
    apiKey,
    model,
    system:
      "Ты арт-директор бумажного альбома воспоминаний. По тексту дня и песне подбираешь настроение, цвет бумаги, наклейки и музыку. Отвечай строго JSON, без пояснений.",
    user:
      `Текст дня: """${source}"""\n` +
      `Песня дня: """${songTitle || "не указана"}""" (характер: ${energyLabel})\n\n` +
      `Допустимые значения:\n` +
      `mood: ${Object.keys(MOODS).join(", ")}\n` +
      `palette: ${PALETTES.join(", ")}\n` +
      `stickers: ${STICKERS.join(", ")} (2–4 штуки)\n` +
      `scale: ${SCALES.join(", ")}\n` +
      `tempo: целое 48–140\n\n` +
      'Верни JSON: {"mood":"...","palette":"...","stickers":["..."],"scale":"...","tempo":84,"title":"название 3–6 слов"}.',
    maxTokens: 400,
  });
  const style = normalizeStyle(
    {
      mood: data.mood,
      palette: data.palette,
      stickers: data.stickers,
      tempo: Number(data.tempo),
      scale: data.scale,
    },
    fallback,
    source,
  );
  return { ...style, title: String(data.title ?? "").trim().slice(0, 120) || titleFromText(source) };
}
