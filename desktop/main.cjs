const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { serverFailure } = require('./server-diagnostics.cjs');
// Reuse existing profiles so renaming the package cannot strand saved worlds.
if (!process.argv.some(arg => arg === '--user-data-dir' || arg.startsWith('--user-data-dir='))) {
  const legacyProfile = path.join(app.getPath('appData'), 'infinite-pokemon');
  const previousProfile = path.join(app.getPath('appData'), 'infinite-tamer-adventure');
  const profile = fs.existsSync(legacyProfile) ? legacyProfile : fs.existsSync(previousProfile) ? previousProfile : legacyProfile;
  fs.mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
}
app.setName('Infinite Pokémon');
const iconPath=path.resolve(__dirname,'../game/assets/branding/app-icon.ico');
const iconPng=path.resolve(__dirname,'../game/assets/branding/app-icon.png');
if(process.platform==='win32')app.setAppUserModelId('infinite-pokemon.game');
let server, win, starting = false, quitting = false;
let launchState = { phase: 'starting', message: 'Waking up your adventure…' };
const shellURL = pathToFileURL(path.join(__dirname, 'shell.html')).href;
function publish(next) {
  launchState = next;
  if (win && !win.isDestroyed()) win.webContents.send('desktop:state', next);
}
async function startServer() {
  if (starting || quitting) return;
  starting = true;
  publish({ phase: 'starting', message: 'Opening your saved worlds…' });
  const entry = path.resolve(__dirname, '../dist-server/game/server/index.js');
  try {
    if (!fs.existsSync(entry)) throw new Error('Build the game with npm run build, then try again.');
    server?.kill();
    const child = spawn(process.env.NODE_BINARY || 'node', [entry], {
      cwd: path.resolve(__dirname, '..'), windowsHide: true,
      env: { ...process.env, PORT: process.env.PORT || '0', ADMIN_PORT: process.env.ADMIN_PORT || '0', INFINITE_DATA_DIR: process.env.INFINITE_DATA_DIR || path.join(app.getPath('userData'), 'world') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server = child;
    let endpoint, failure, stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8192); });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      const match = /^Host console: (http:\/\/127\.0\.0\.1:\d+)$/.exec(line);
      if (match) endpoint = match[1];
    });
    child.on('error', error => { failure = `Could not launch Node (${error.code || error.message}). Install Node.js 22.13 or newer, or set NODE_BINARY to its executable, then retry.`; });
    // close follows stderr drainage; exit can precede the final error output.
    child.on('close', (code, signal) => {
      failure ??= serverFailure(stderr, code, signal);
      if (!quitting && server === child && !starting) publish({ phase: 'error', message: failure });
    });
    for (let i = 0; i < 100 && !quitting; i++) {
      if (failure) throw new Error(failure);
      if (endpoint) {
        try {
          const response = await fetch(endpoint + '/api/info', { signal: AbortSignal.timeout(600) });
          if (response.ok) {
            // The exported website serves the game client at /game/.
            const info = await response.json().catch(() => ({}));
            let url = (info.gameBase && info.gameBase !== '/') ? endpoint + info.gameBase : endpoint;
            if (info.gameBase && info.gameBase !== '/') url += '?embed=1';
            publish({ phase: 'loading', message: 'Opening the title screen…', url });
            return;
          }
        } catch {}
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (!quitting) throw new Error('Starting took too long. Retry to reopen your adventure.');
  } catch (error) {
    server?.kill();
    if (!quitting) publish({ phase: 'error', message: error.message });
  } finally { starting = false; }
}
app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1180, height: 920, minWidth: 880, minHeight: 650, frame: false,
    icon: process.platform==='win32'?iconPath:iconPng,
    backgroundColor: '#718099', title: 'Infinite Pokémon', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenu(null);
  if(process.platform==='win32')win.setAppDetails({appId:'infinite-pokemon.game',appIconPath:iconPath,relaunchDisplayName:'Infinite Pokémon'});
  if(process.platform==='darwin')app.dock?.setIcon(iconPng);
  const trusted = event => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === shellURL;
  ipcMain.handle('desktop:state', event => trusted(event) ? {...launchState,maximized:win.isMaximized(),fullscreen:win.isFullScreen()} : null);
  ipcMain.on('desktop:control', (event, action) => {
    if (!trusted(event)) return;
    if (action === 'minimize') win.minimize();
    if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    if (action === 'fullscreen') {win.setFullScreen(!win.isFullScreen());windowState();}
    if (action === 'exit-fullscreen') {win.setFullScreen(false);windowState();}
    if (action === 'close') win.close();
    if (action === 'retry' && launchState.phase === 'error') void startServer();
  });
  const windowState = () => win.webContents.send('desktop:window', { maximized: win.isMaximized(), fullscreen: win.isFullScreen() });
  win.on('maximize', windowState); win.on('unmaximize', windowState);
  win.on('enter-full-screen', () => setImmediate(windowState)); win.on('leave-full-screen', () => setImmediate(windowState));
  win.webContents.on('before-input-event', (event, input) => {
    if(input.type!=='keyDown'||input.isAutoRepeat||input.control||input.alt||input.meta)return;
    if(input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());windowState();}
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { const link = new URL(url); if (link.protocol === 'https:' && ['auth.openai.com', 'chatgpt.com'].includes(link.hostname)) void shell.openExternal(url); } catch {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-frame-navigate', event => {
    try { if (!event.isMainFrame && !['http:', 'https:'].includes(new URL(event.url).protocol)) event.preventDefault(); } catch { event.preventDefault(); }
  });
  await win.loadURL(shellURL);
  win.show();
  if(process.argv.includes('--fullscreen')){win.setFullScreen(true);windowState();}
  void startServer();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; server?.kill(); });
