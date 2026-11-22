import { app, BrowserWindow, ipcMain, dialog, protocol, Menu, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./src/store.mjs";
import { improveText, styleFromText } from "./src/ai.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const ALLOWED = /\.(html|css|js|mjs|json|svg|png|jpe?g|webp|gif|avif|woff2?)$/i;

let store;
let win;

// Один экземпляр: два окна не должны чистить одни и те же фото.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: "album", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  win = new BrowserWindow({
    width: 430,
    height: 900,
    minWidth: 360,
    minHeight: 700,
    title: "Альбом",
    backgroundColor: "#d6bd97",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL("album://app/index.html");
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

async function serveApp(url) {
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.normalize(path.join(here, rel));
  if (!file.startsWith(here + path.sep) || !ALLOWED.test(file)) {
    return new Response("not found", { status: 404 });
  }
  try {
    const body = await fs.readFile(file);
    return new Response(body, {
      headers: { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

function ok(fn) {
  return async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err?.message || "Что-то пошло не так" };
    }
  };
}

if (gotLock) app.whenReady().then(() => {
  store = createStore(app.getPath("userData"));
  Menu.setApplicationMenu(null);

  protocol.handle("album", (request) => {
    const url = new URL(request.url);
    if (url.host === "app") return serveApp(url);
    if (url.host === "photo") {
      const file = store.photoPath(decodeURIComponent(url.pathname.replace(/^\/+/, "")));
      if (!file) return new Response("not found", { status: 404 });
      return fs.readFile(file).then((body) => new Response(body, {
        headers: {
          "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
          // Фото читается в canvas для цвета фона — нужен CORS.
          "access-control-allow-origin": "*",
        },
      }));
    }
    return new Response("not found", { status: 404 });
  });

  ipcMain.handle("album:init", ok(() => ({ notes: store.list(), settings: store.getSettings() })));

  ipcMain.handle("album:add", ok((input) => store.add(input)));
  ipcMain.handle("album:update", ok((id, patch) => store.update(id, patch)));
  ipcMain.handle("album:remove", ok((id) => store.remove(id)));

  ipcMain.handle("album:pickPhoto", ok(async () => {
    const picked = await dialog.showOpenDialog(win, {
      title: "Выберите фото",
      properties: ["openFile"],
      filters: [{ name: "Изображения", extensions: ["jpg", "jpeg", "png", "webp", "gif", "avif"] }],
    });
    if (picked.canceled || !picked.filePaths[0]) return null;
    return store.importPhoto(picked.filePaths[0]);
  }));

  ipcMain.handle("album:settings:save", ok((patch) => store.saveSettings(patch)));

  ipcMain.handle("album:ai:improve", ok((text) => improveText({
    apiKey: store.getApiKey(),
    model: store.getSettings().model,
    text,
  })));

  ipcMain.handle("album:ai:style", ok((text, song) => styleFromText({
    apiKey: store.getApiKey(),
    model: store.getSettings().model,
    text,
    song,
  })));

  // Песню не скачиваем: открываем ссылку в браузере пользователя.
  ipcMain.handle("album:openExternal", ok(async (value) => {
    const url = new URL(String(value));
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad_url");
    await shell.openExternal(url.href);
  }));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
