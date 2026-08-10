import { contextBridge, ipcRenderer } from "electron";

// Superfície mínima exposta ao renderer — contextIsolation ligado, então o
// renderer nunca tem acesso direto a `require`/Node. Rede, RxDB e toda a
// lógica de PDV rodam dentro do próprio renderer (Chromium), sem precisar
// de IPC: só o que é genuinamente do processo principal (versão do app)
// passa por aqui.
const api = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("armazixDesktop", api);

export type ArmazixDesktopApi = typeof api;
