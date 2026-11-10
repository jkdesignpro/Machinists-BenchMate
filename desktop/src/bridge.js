// Injected by the desktop wrapper before the page's own scripts run.
// app/app.js calls window.BenchMateSave(name, data, type) from saveFile()
// when it exists; here it opens the native save dialog and writes the file.
(function () {
  'use strict';
  const invoke = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args);
  async function toText(data) {
    if (typeof data === 'string') return data;
    if (data instanceof Blob) return data.text();
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
    return String(data);
  }
  window.BenchMateSave = async function (name, data, type) {
    try {
      const contents = await toText(data);
      // Resolves to the saved path, or null when the dialog was cancelled.
      return await invoke('save_file', { name: String(name || 'benchmate.txt'), contents, mime: String(type || '') });
    } catch (e) {
      alert('Could not save the file: ' + (e && e.message ? e.message : e));
      return null;
    }
  };
})();
