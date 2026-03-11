const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('enclav', {
  checkDocker: () => ipcRenderer.invoke('check-docker')
});

