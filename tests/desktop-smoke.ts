import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { _electron as electron, expect, type ElectronApplication } from '@playwright/test';

const startedAt = new Date().toISOString();
const dataDir = resolve('.test-data', `desktop-${randomUUID()}`);
mkdirSync(dataDir, { recursive: true });
mkdirSync(resolve('.test-data/verification'), { recursive: true });
async function freePort(): Promise<number> {
  const reservation = createServer();
  return new Promise((done, reject) => {
    reservation.on('error', reject);
    reservation.listen(0, '127.0.0.1', () => {
      const port = (reservation.address() as { port: number }).port;
      reservation.close(error => error ? reject(error) : done(port));
    });
  });
}
const port = await freePort();
let adminPort = await freePort();
while (adminPort === port) adminPort = await freePort();
const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
const errors: string[] = [];
const checks: string[] = [];
let app: ElectronApplication | undefined;
let title = '', electronVersion = '', browserVersion = '';
let previewOrigin = '';
const harnessRequests: string[] = [];
let closed = false;
try {
  app = await electron.launch({
    args: ['--mute-audio','--user-data-dir=' + resolve(dataDir, 'electron-profile'), resolve('desktop/main.cjs')],
    cwd: resolve('.'),
    env: { ...env, NODE_BINARY: process.execPath, PORT: String(port), ADMIN_PORT: String(adminPort), INFINITE_DATA_DIR: resolve(dataDir, 'world') },
    timeout: 30000,
  });
  const page = await app.firstWindow({ timeout: 30000 });
  const game = page.frameLocator('#game');
  await expect(page.getByRole('navigation',{name:'Window controls'})).toBeVisible();
  await expect.poll(()=>page.locator('.desktop-brand-icon').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth===512)).toBe(true);
  page.on('request',request=>{if(/\/api\/host\/(connect|verify|login)$/.test(new URL(request.url()).pathname))harnessRequests.push(request.url());});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await expect(game.getByRole('button', { name: 'Single player' })).toBeVisible();
  await expect(game.getByRole('navigation',{name:'Title menu'}).getByRole('button')).toHaveCount(2);
  await expect(page.locator('body')).toHaveAttribute('data-phase','ready');
  assert.equal(await game.locator('body').evaluate(()=>typeof (window as any).desktop),'undefined');
  async function assertFits(){
    await expect.poll(()=>game.locator('body').evaluate(()=>{
      const box=document.querySelector('.console-shell')!.getBoundingClientRect();
      return box.top>=-1&&box.left>=-1&&box.bottom<=innerHeight+1&&box.right<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;
    })).toBe(true);
  }
  for(const [width,height] of [[1180,920],[1280,670],[880,650]]){
    await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setSize(width,height),{width,height});
    await expect.poll(async()=>Math.abs(await page.evaluate(()=>innerWidth)-width)).toBeLessThanOrEqual(1);
    await assertFits();
    for(const label of ['Single player','Multiplayer'])await expect(game.getByRole('button',{name:label,exact:true})).toBeInViewport({ratio:1});
  }
  await page.screenshot({path:resolve('.test-data/verification/desktop-title-fit.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1180,920));
  await assertFits();
  await page.screenshot({path:resolve('.test-data/verification/desktop-title.png')});
  await page.getByRole('button',{name:'Maximize window',exact:true}).click();
  await expect(page.getByRole('button',{name:'Restore window',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restore window',exact:true}).click();
  await expect(page.getByRole('button',{name:'Maximize window',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Minimize window',exact:true}).click();
  await expect.poll(()=>app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true);
  await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].restore();BrowserWindow.getAllWindows()[0].focus();});
  const windowBounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
  await expect.poll(()=>app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true);
  await expect(page.locator('body')).toHaveClass(/fullscreen/);await expect(page.locator('.titlebar')).not.toBeVisible();await assertFits();
  await page.screenshot({path:resolve('.test-data/verification/desktop-fullscreen.png')});
  await game.getByRole('navigation',{name:'Title menu'}).getByRole('button').first().focus();await page.keyboard.press('F11');
  await expect.poll(()=>app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false);
  await expect(page.locator('.titlebar')).toBeVisible();
  await game.getByRole('navigation',{name:'Title menu'}).getByRole('button').first().focus();await page.keyboard.press('F11');
  await expect(page.getByRole('button',{name:'Exit fullscreen',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
  await expect.poll(()=>app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds())).toEqual(windowBounds);
  checks.push('Native fullscreen hides the console frame, keeps the game fitted, supports F11 from the game iframe, and restores window bounds.');
  checks.push('Custom console frame persists, window buttons maximize/restore/minimize, and game content has no native-control bridge.');
  title = await page.title();
  assert.match(title, /Infinite Pokémon/i);
  const runtime = await app.evaluate(() => ({ electron: process.versions.electron, chrome: process.versions.chrome }));
  electronVersion = runtime.electron!; browserVersion = runtime.chrome!;
  const info = await (await fetch(`http://127.0.0.1:${adminPort}/api/info`)).json();
  assert.equal(info.hostAvailable, true);
  assert.equal(info.ready, false);
  assert.equal(info.generation.mode, 'codex');
  checks.push('Electron main entry launches the compiled local server with the configured Node executable, isolated world directory, and alternate ports.');
  checks.push('Desktop window loads the actual title screen and correct document title.');
  await game.getByRole('button',{name:'Mute music',exact:true}).click();
  await game.getByRole('button', { name: 'Single player' }).click();
  await expect(game.getByRole('region', { name: 'Connect to Codex',exact:true })).toBeVisible();
  await expect(game.getByRole('button', { name: 'Connect to Codex', exact: true })).toBeVisible();
  await expect(game.getByRole('checkbox')).toHaveCount(0);await expect(game.getByLabel('Generation batch size')).not.toBeVisible();await expect(game.getByLabel('Map generation depth')).not.toBeVisible();await expect(game.getByLabel('Generation job budget')).toHaveCount(0);await page.screenshot({path:resolve('.test-data/verification/desktop-connect-simple.png')});
  checks.push('Single player Codex setup opens in Electron with disconnected Codex and an inline token-use disclosure; no harness connection or model job is requested.');
  await game.getByRole('button', {name:'Play tutorial preview'}).click();
  await expect(game.getByRole('dialog', {name:'The valley beyond the map'})).toBeVisible();
  previewOrigin = new URL(page.frames().find(frame=>frame.parentFrame())!.url()).origin;
  assert.notEqual(new URL(previewOrigin).port, String(adminPort));
  const preview = await(await fetch(previewOrigin+'/api/bootstrap')).json();
  assert.equal(preview.preview,true);
  assert.equal(preview.ready,true);
  assert.equal(preview.status.mode,'preview');
  assert.equal(preview.status.used,0);await expect(game.getByRole('button',{name:'Enable music',exact:true})).toBeVisible();
  assert.deepEqual(harnessRequests,[]);
  checks.push('Electron follows the isolated preview child URL and loads the tutorial intro without any connect, login, verification, or token usage.');
  await page.screenshot({path:resolve('.test-data/verification/desktop-preview.png')});
  await game.getByRole('button',{name:'Skip introduction'}).click();
  await game.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();
  await game.getByRole('dialog',{name:'A friendship begins'}).getByRole('button',{name:/Continue/}).click();
  await game.locator('.game-canvas canvas').focus();await page.keyboard.press('Enter');await expect(game.getByRole('navigation',{name:'Game menu'})).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(game.getByRole('navigation',{name:'Game menu'})).toBeVisible();
  await game.getByRole('navigation',{name:'Game menu'}).getByRole('button').first().focus();await page.keyboard.press('Escape');await expect(game.getByRole('navigation',{name:'Game menu'})).toHaveCount(0);
  await game.locator('.game-canvas canvas').focus();await page.keyboard.press('F11');await expect(page.getByRole('button',{name:'Exit fullscreen'})).toBeVisible();
  await game.locator('.game-canvas canvas').focus();await page.keyboard.press('Escape');await expect(game.getByRole('navigation',{name:'Game menu'})).toBeVisible();
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),true);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Exit fullscreen'}).click();
  checks.push('Escape opens and closes the menu, even with an objective or fullscreen active; Enter no longer opens it.');
  for(const [width,height] of [[1280,670],[880,650]]){
    await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setSize(width,height),{width,height});
    await expect.poll(async()=>Math.abs(await page.evaluate(()=>innerWidth)-width)).toBeLessThanOrEqual(1);await assertFits();
    await expect(game.getByRole('button',{name:'Close objective'})).toBeInViewport({ratio:1});
    await expect(game.getByRole('button',{name:'Interact',exact:true})).toBeInViewport({ratio:1});
  }
  await expect.poll(()=>game.locator('.viewport').evaluate(view=>{const canvas=view.querySelector('canvas')!.getBoundingClientRect(),bounds=view.getBoundingClientRect();return Math.abs(canvas.width-bounds.width)<1&&Math.abs(canvas.height-bounds.height)<1;})).toBe(true);
  await page.screenshot({path:resolve('.test-data/verification/desktop-game-fit.png')});
  await game.getByRole('button',{name:'Close objective'}).click();await assertFits();
  await game.getByRole('button',{name:'Show objective'}).click();await assertFits();
  await game.getByRole('button',{name:'Open game menu'}).click();await game.getByRole('button',{name:'SESSION',exact:true}).click();
  await expect(game.getByRole('dialog',{name:'Session'})).toBeInViewport({ratio:1});
  await page.screenshot({path:resolve('.test-data/verification/desktop-settings-fit.png')});
  await page.keyboard.press('Escape');
  checks.push('Title buttons, gameplay controls and objective fit without page scrolling at normal, short-wide and minimum window sizes; dialogs remain usable.');
  assert.deepEqual(errors, []);
  checks.push('No renderer page errors or console errors.');
  const processHandle=app.process();
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await expect.poll(()=>processHandle.exitCode).not.toBeNull();closed = true;
  await expect.poll(async () => {
    try { await fetch(`http://127.0.0.1:${adminPort}/api/info`, { signal: AbortSignal.timeout(600) }); return false; }
    catch { return true; }
  }, { timeout: 5000 }).toBe(true);
  await expect.poll(async()=>{try{await fetch(previewOrigin+'/api/info',{signal:AbortSignal.timeout(600)});return false;}catch{return true;}},{timeout:5000}).toBe(true);
  checks.push('Closing Electron terminates both its main and preview game servers.');
  const blocker=createServer();await new Promise<void>(done=>blocker.listen(adminPort,'127.0.0.1',done));
  try{
    app=await electron.launch({args:['--mute-audio','--user-data-dir='+resolve(dataDir,'retry-profile'),resolve('desktop/main.cjs')],cwd:resolve('.'),env:{...env,NODE_BINARY:process.execPath,PORT:String(port),ADMIN_PORT:String(adminPort),INFINITE_DATA_DIR:resolve(dataDir,'retry-world')},timeout:30000});closed=false;
    const retryPage=await app.firstWindow();
    await expect(retryPage.getByRole('region',{name:'Game startup'})).toBeVisible();
    await retryPage.screenshot({path:resolve('.test-data/verification/desktop-startup.png')});
    await expect(retryPage.getByRole('button',{name:'Try again'})).toBeVisible({timeout:10000});
    await expect(retryPage.getByRole('region',{name:'Game startup'})).toContainText('EADDRINUSE');
    await expect(retryPage.getByRole('region',{name:'Game startup'})).toContainText('Choose another PORT');
    await new Promise<void>((done,reject)=>blocker.close(error=>error?reject(error):done()));
    await retryPage.getByRole('button',{name:'Try again'}).click();
    await expect(retryPage.frameLocator('#game').getByRole('button',{name:'Single player'})).toBeVisible({timeout:10000});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(880,650));
    await expect(retryPage.getByRole('button',{name:'Close game'})).toBeVisible();
    await expect.poll(()=>retryPage.frameLocator('#game').locator('body').evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await expect.poll(()=>retryPage.frameLocator('#game').locator('body').evaluate(()=>window.innerWidth)).toBeLessThan(880);
    await retryPage.screenshot({path:resolve('.test-data/verification/desktop-compact.png')});
    const retryProcess=app.process();await retryPage.getByRole('button',{name:'Close game'}).click();await expect.poll(()=>retryProcess.exitCode).not.toBeNull();closed=true;
    checks.push('Startup shows a themed loading/error screen, detects a busy port without adopting another server, retries successfully, and keeps controls usable at minimum window size.');
  }finally{if(blocker.listening)await new Promise<void>(done=>blocker.close(()=>done()));}
} catch (error) {
  if(app){const failedPage=app.windows()[0];if(failedPage){console.log(await failedPage.locator('body').innerText());console.log(failedPage.frames().map(frame=>frame.url()));const gameFrame=failedPage.frames().find(frame=>frame.parentFrame());if(gameFrame)console.log(await gameFrame.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,els:[...document.querySelectorAll('body,#root,.console-shell,.title-screen')].map(el=>({tag:el.className||el.tagName,w:el.getBoundingClientRect().width,css:getComputedStyle(el).width,min:getComputedStyle(el).minWidth}))}))); await failedPage.screenshot({path:resolve('.test-data/verification/desktop-failure.png')});}}
  errors.push((error as Error).stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (app && !closed) await app.close().catch(error => errors.push('Cleanup: ' + String(error)));
  const result = { status: process.exitCode ? 'failed' : 'passed', startedAt, completedAt: new Date().toISOString(), command: 'npx tsx tests/desktop-smoke.ts', node: process.version, electronVersion, browserVersion, title, port, adminPort, previewOrigin, dataDir, aiCalls: 0, harnessConnected: false, harnessRequests, checks, errors };
  mkdirSync(resolve('.test-data/verification'),{recursive:true});
  writeFileSync(resolve('.test-data/verification/desktop.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
