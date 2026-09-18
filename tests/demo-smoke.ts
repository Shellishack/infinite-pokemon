// Smoke test: serve the static export, open /game/, start the browser demo,
// move around, verify autosave resume and export. Run: npx tsx tests/demo-smoke.ts
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('out');
const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url??'/','http://x').pathname);
  let file=resolve(root,'.'+pathname);
  if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
  if(!existsSync(file)&&!extname(pathname)&&existsSync(file+'.html'))file=file+'.html';
  if(!existsSync(file)){res.writeHead(404);res.end('nf');return;}
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'});
  res.end(readFileSync(file));
});
await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
const port=(server.address() as {port:number}).port;
const url=`http://127.0.0.1:${port}/game/`;
console.log('Serving',url);

const browser=await chromium.launch();
const page=await browser.newPage();
const errors:string[]=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto(url,{waitUntil:'networkidle'});
await page.waitForSelector('.demo-panel',{timeout:15000});
console.log('demo panel visible');
await page.fill('.demo-name input','Smoke');
await page.click('text=Start your adventure');
await page.waitForSelector('canvas',{timeout:20000});
console.log('game canvas mounted');
// Play through intro
for(let i=0;i<3;i++){const btn=page.locator('button:has-text("Continue")').or(page.locator('button:has-text("Step into Willowbrook")')).first();if(await btn.count()){await btn.click();await page.waitForTimeout(400);}}
const starter=page.locator('.starter-choices button').first();
if(await starter.count()){await starter.click();console.log('starter chosen');}
await page.waitForTimeout(1500);
const state=await page.evaluate(()=>!!document.querySelector('.game-screen'));
console.log('in game:',state);
// Reload → resume
await page.reload({waitUntil:'networkidle'});
await page.waitForSelector('.demo-panel',{timeout:15000});
const hasContinue=await page.locator('text=Continue your adventure').count();
console.log('resume offered after reload:',hasContinue>0);
await page.click('text=Continue your adventure');
await page.waitForSelector('canvas',{timeout:20000});
console.log('resumed into game');
// Export via menu
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const exportBtn=page.getByRole('button',{name:'EXPORT',exact:true});
if(await exportBtn.count()){const dl=page.waitForEvent('download');await exportBtn.click();const download=await dl;console.log('export download:',download.suggestedFilename());}
else console.log('EXPORT button missing!');
console.log('page errors:',errors);
await browser.close();
server.close();
process.exit(errors.length?1:0);
