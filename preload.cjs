const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("album", {
  init: () => ipcRenderer.invoke("album:init"),
  add: (note) => ipcRenderer.invoke("album:add", note),
  update: (id, patch) => ipcRenderer.invoke("album:update", id, patch),
  remove: (id) => ipcRenderer.invoke("album:remove", id),
  pickPhoto: () => ipcRenderer.invoke("album:pickPhoto"),
  saveSettings: (patch) => ipcRenderer.invoke("album:settings:save", patch),
  improveText: (text) => ipcRenderer.invoke("album:ai:improve", text),
  styleFromText: (text, song) => ipcRenderer.invoke("album:ai:style", text, song),
  openExternal: (url) => ipcRenderer.invoke("album:openExternal", url),
});
