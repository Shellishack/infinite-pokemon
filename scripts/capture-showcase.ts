// Captures real gameplay screenshots for the landing page showcase.
// Serves out/, plays the browser demo (with ?demo-debug=1 teleports), and saves
// four PNGs into game/assets/showcase/ (synced to public/ by the build).
// Run: npm run build && npx tsx scripts/capture-showcase.ts
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('out');
const outDir=resolve('game/assets/showcase');
mkdirSync(outDir,{recursive:true});
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
const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/game/?demo-debug=1`;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:960,height:640}});
page.on('console',m=>console.log('console:',m.type(),m.text().slice(0,200)));
page.on('response',r=>{if(r.status()===404)console.log('404:',r.url());});
page.on('pageerror',e=>console.log('pageerror:',String(e).slice(0,300)));
await page.goto(url,{waitUntil:'networkidle'});
await page.waitForSelector('.demo-panel');
await page.waitForSelector('.demo-name input',{timeout:5000}).catch(async()=>{console.log('input missing; panel html:',(await page.locator('.title-menu').innerHTML().catch(()=>'none')).slice(0,300));await page.screenshot({path:'C:/Users/ellis/AppData/Local/Temp/opencode/capture-fail.png'});throw new Error('input missing');});
await page.fill('.demo-name input','Willow');
await page.click('text=Start your adventure');
await page.waitForSelector('canvas');
// Intro
for(let i=0;i<3;i++){const btn=page.locator('button:has-text("Continue")').or(page.locator('button:has-text("Step into Willowbrook")')).first();if(await btn.count()){await btn.click();await page.waitForTimeout(500);}}
await page.locator('.starter-choices button').first().click();
await page.waitForTimeout(1200);
console.log('starter modal still open:',await page.locator('.starter-choices').count()>0,'| toast:',await page.locator('.toast').textContent().catch(()=>'none'));
await page.waitForTimeout(1200);
const viewport=page.locator('.viewport');
await viewport.screenshot({path:join(outDir,'exploration.png')});
console.log('exploration.png');

const key=(code:string,keyName:string)=>page.evaluate(([c,k])=>{const codes:Record<string,number>={ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,KeyE:69,Space:32,Escape:27};const down=new KeyboardEvent('keydown',{code:c,key:k,bubbles:true});Object.defineProperty(down,'keyCode',{value:codes[c]??0});window.dispatchEvent(down);const up=new KeyboardEvent('keyup',{code:c,key:k,bubbles:true});Object.defineProperty(up,'keyCode',{value:codes[c]??0});window.dispatchEvent(up);},[code,keyName] as const);
const closeDialog=async()=>{const next=page.locator('.dialogue-next');if(await next.count()){await next.click();await page.waitForTimeout(500);}};
// Battle: teleport in front of Trainer Rowan (23,15) and challenge them.
await closeDialog();
await page.evaluate(()=>(window as unknown as {__demoTeleport?:(x:number,y:number)=>void}).__demoTeleport?.(23,16));
await page.waitForTimeout(400);
await key('ArrowUp','ArrowUp'); // blocked by the trainer, but turns to face north
await page.waitForTimeout(600);
await key('KeyE','e'); // trainer battle starts immediately
await page.waitForTimeout(1500);
console.log('after E — location:',await page.locator('.location-sign h1').textContent().catch(()=>'?'),'| modals:',await page.locator('.modal').count(),'| battle stage:',await page.locator('.encounter-battle-stage').count(),'| objective:',(await page.locator('.objective-panel,.objective,.game-objective').textContent().catch(()=>'?'))?.slice(0,120));
await page.screenshot({path:'C:/Users/ellis/AppData/Local/Temp/opencode/after-e.png'});
await page.waitForSelector('.encounter-battle-stage',{timeout:10000}).catch(async()=>{console.log('no battle; dialog:',await page.locator('.dialogue-text').textContent().catch(()=>'?'));throw new Error('battle missing');});
await page.waitForTimeout(900);
await viewport.screenshot({path:join(outDir,'battle.png')});
console.log('battle.png');
// Finish the battle so export stays allowed: FIGHT → Tackle until finished.
for(let i=0;i<30;i++){
  if(await page.locator('.encounter-battle-stage').count()===0)break;
  const fight=page.getByRole('button',{name:'FIGHT',exact:true});
  if(await fight.count())await fight.click().catch(()=>{});
  await page.waitForTimeout(500);
  const tackle=page.getByRole('button',{name:/Tackle|Struggle/i}).first();
  if(await tackle.count())await tackle.click().catch(()=>{});
  await page.waitForTimeout(900);
  const cont=page.locator('.dialogue-next');
  if(await cont.count())await cont.click();
  await page.waitForTimeout(300);
}
await closeDialog();
await page.waitForTimeout(600);

// Interior: stand below the sanctuary door (7,7), face north, enter.
await page.evaluate(()=>(window as unknown as {__demoTeleport?:(x:number,y:number)=>void}).__demoTeleport?.(7,9));
await page.waitForTimeout(400);
await key('ArrowUp','ArrowUp');await page.waitForTimeout(500);
await key('ArrowUp','ArrowUp');await page.waitForTimeout(700);
await key('KeyE','e');
await page.waitForTimeout(1200);
const scene=await page.evaluate(()=>document.querySelector('.location-sign h1')?.textContent??'');
console.log('interior location:',scene);
await page.waitForTimeout(7000); // let transient interaction toasts clear
await viewport.screenshot({path:join(outDir,'interior.png')});
console.log('interior.png');

// Continuity: town map + journal evidence.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.locator('button:has-text("TOWN MAP")').click();
await page.waitForTimeout(500);
await page.locator('.pixel-window').last().screenshot({path:join(outDir,'continuity.png')});
console.log('continuity.png');
await browser.close();
server.close();
