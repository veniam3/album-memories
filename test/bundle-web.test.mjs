import test from "node:test";
import assert from "node:assert/strict";
import { bundleKey } from "../src/bundle-web.mjs";

test("ключ для Android расшифровывается тем же секретом", async () => {
  const key = await bundleKey();
  assert.match(key, /^sk-[a-z0-9]+$/i);
});
