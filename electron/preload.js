const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('enclav', {
  checkDocker: () => ipcRenderer.invoke('check-docker'),
  checkDockerImage: (imageRef) => ipcRenderer.invoke('check-docker-image', imageRef),
  pullDockerImage: (imageRef) => ipcRenderer.invoke('pull-docker-image', imageRef),
  runGateway: () => ipcRenderer.invoke('run-enclav-gateway'),
  checkGatewayStatus: () => ipcRenderer.invoke('check-gateway-status'),
  stopGateway: () => ipcRenderer.invoke('stop-enclav-gateway'),
  getOpenclawToken: () => ipcRenderer.invoke('get-openclaw-token'),
  approveOpenclawDevice: () => ipcRenderer.invoke('approve-openclaw-device'),
  startOpenclawContainer: () => ipcRenderer.invoke('start-openclaw-container'),
  setAnthropicEnv: (apiKey) => ipcRenderer.invoke('set-anthropic-env', apiKey)
});

