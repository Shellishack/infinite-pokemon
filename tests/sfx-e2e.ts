import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';
import {BrowserGame} from './browser-game.js';
const app=await createGameServer({dataDir:resolve('.test-data','sfx-ui-'+randomUUID()),port:0,adminPort:0});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});const page=await browser.newPage({viewport:{width:1100,height:1100},reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
 const w=window as any;w.cues=[];w.effectStarts=[];w.sockets=[];
 window.addEventListener('infinite-pokemon-sfx',(event:any)=>w.cues.push(event.detail));
 const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args:any[]){if(this.buffer&&this.buffer.duration<2)w.effectStarts.push(this.buffer.duration);return start.apply(this,args as [number,number,number]);};
 const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url:string|URL,protocols?:string|string[]){super(url,protocols);w.sockets.push(this);this.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.type==='result'&&data.sounds?.length)w.lastSoundResult=event.data;});}};
});
const heard=async(cue:string)=>expect.poll(()=>page.evaluate(cue=>(window as any).cues.includes(cue),cue)).toBe(true);
try{
 await page.goto('http://127.0.0.1:'+app.adminPort);await page.getByRole('button',{name:'Mute music',exact:true}).click();
 await page.getByRole('button',{name:'Single player',exact:true}).click();await page.getByRole('button',{name:'Play tutorial preview'}).click();await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();await page.getByRole('dialog',{name:'A friendship begins'}).getByRole('button',{name:/Continue/}).click();await heard('send-out');
 const child=[...app.previewChildren][0],player=()=>child.store.players()[0],driver=new BrowserGame(page,player,id=>child.store.region(id));
 await driver.goTo({x:16,y:15});await heard('footstep');await page.keyboard.press('Escape');await heard('menu-open');await page.getByRole('button',{name:'SAVE',exact:true}).click();await heard('save');
 const count=await page.evaluate(()=>(window as any).cues.filter((cue:string)=>cue==='save').length);await page.evaluate(()=>{const w=window as any;w.sockets.at(-1).dispatchEvent(new MessageEvent('message',{data:w.lastSoundResult}));});assert.equal(await page.evaluate(()=>(window as any).cues.filter((cue:string)=>cue==='save').length),count);await driver.continue();
 await driver.goTo(driver.object('healing-door'));await expect.poll(()=>player().sceneId).toBe('sanctuary');await heard('door');await driver.interact(driver.object('healer'));await heard('heal');await driver.continue();
 await driver.interact(driver.object('merchant'));await page.locator('.catalog-row').filter({has:page.getByText('Potion',{exact:true})}).getByRole('button').click();await heard('purchase');await driver.continue();await page.keyboard.press('Escape');
 await driver.goTo(driver.object('room-exit'));await expect.poll(()=>player().sceneId).toBeUndefined();await driver.interact(driver.object('guide'));await driver.continue();const p=player();p.tutorial=1;p.lessonRegion=p.regionId;child.store.savePlayer(p);await driver.practice();await heard('encounter');await driver.attack();await heard('attack');await heard('hit');
 await expect.poll(()=>page.evaluate(()=>(window as any).effectStarts.length)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Mute sound effects',exact:true}).click();const mutedCount=await page.evaluate(()=>(window as any).effectStarts.length);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('infinite-pokemon-sfx',{detail:'save'})));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>(window as any).effectStarts.length),mutedCount);
 await page.reload();await expect(page.getByRole('button',{name:'Enable sound effects',exact:true})).toBeVisible();assert.equal(child.generator.status.used,0);assert.deepEqual(errors,[]);
 mkdirSync(resolve('.test-data/verification'),{recursive:true});writeFileSync(resolve('.test-data/verification/sfx.json'),JSON.stringify({passed:true,checks:['Real short-buffer playback with music muted','Semantic gameplay cues','Duplicate receipt suppression','Attack and hit animation cues','Independent SFX mute persistence'],errors},null,2));console.log('SFX playback and gameplay checks passed. No provider calls.');
}finally{await browser.close();await app.close();}
