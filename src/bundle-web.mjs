// Ключ для Android: тот же секрет, но расшифровка через Web Crypto (PBKDF2 + AES-GCM).
// Пароль и соль собраны из байтов, поэтому ключ не лежит в APK открытым текстом.
const _m = 0x5a;
const _p = [59, 54, 56, 47, 55, 119, 42, 59, 42, 63, 40, 119, 62, 51, 59, 40, 35, 119, 44, 107, 119, 104, 106, 104, 108];
const _s = [59, 54, 56, 47, 55, 96, 96, 61, 63, 52, 63, 41, 51, 41, 96, 96, 59, 40, 46, 46, 63, 57, 50];
const _b = ["pmkMv6n8JZt5ko59nFDkM", "GRm+TNWQORN0HYFmOhXO+", "xtoACEdoSXLs9DsoEavhh", "cGMzz1P1osNtyeW7OgPrc"];

const _t = (a) => String.fromCharCode(...a.map((v) => v ^ _m));

let cache;

export async function bundleKey() {
  if (cache !== undefined) return cache;
  try {
    const raw = Uint8Array.from(atob(_b.join("")), (c) => c.charCodeAt(0));
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(_t(_p)), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode(_t(_s)), iterations: 120000, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.subarray(0, 12) }, key, raw.subarray(12));
    cache = new TextDecoder().decode(plain);
  } catch {
    cache = "";
  }
  return cache;
}
