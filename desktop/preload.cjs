const { contextBridge, ipcRenderer } = require('electron');
if (process.isMainFrame) contextBridge.exposeInMainWorld('desktop', {
  state: () => ipcRenderer.invoke('desktop:state'),
  control: action => { if (['minimize', 'maximize', 'fullscreen', 'exit-fullscreen', 'close', 'retry'].includes(action)) ipcRenderer.send('desktop:control', action); },
  onState: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('desktop:state', listener); return () => ipcRenderer.removeListener('desktop:state', listener); },
  onWindow: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('desktop:window', listener); return () => ipcRenderer.removeListener('desktop:window', listener); },
});
