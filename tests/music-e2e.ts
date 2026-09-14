import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';
import {BrowserGame} from './browser-game.js';
const app=await createGameServer({dataDir:resolve('.test-data','music-'+randomUUID()),port:0,adminPort:0});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});const page=await browser.newPage({viewport:{width:1100,height:1080},reducedMotion:'reduce'}),errors:string[]=[],audioRequests:string[]=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().endsWith('.wav')&&!request.url().includes('/audio/sfx/'))audioRequests.push(request.url());});
const controls=page.getByRole('group',{name:'Music controls'});
const playing=async(track:string)=>{await expect(controls).toHaveAttribute('data-track',track);await expect(controls).toHaveAttribute('data-music-status','playing');};
try{
 await page.goto('http://127.0.0.1:'+app.adminPort);await expect(controls).toHaveAttribute('data-music-status','ready');assert.equal(audioRequests.length,0);
 await page.getByRole('button',{name:'Single player',exact:true}).click();await playing('title');
 await page.getByRole('button',{name:'Mute music',exact:true}).click();await expect(controls).toHaveAttribute('data-music-status','muted');await page.reload();await expect(page.getByRole('button',{name:'Enable music',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Enable music',exact:true}).click();await playing('title');await page.getByLabel('Music volume').press('Home');await expect(controls).toHaveAttribute('data-music-status','muted');await page.getByLabel('Music volume').press('ArrowRight');await expect(page.getByLabel('Music volume')).toHaveValue('1');await playing('title');
 await page.getByRole('button',{name:'Single player',exact:true}).click();await page.getByRole('button',{name:'Play tutorial preview'}).click();await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();await page.getByRole('dialog',{name:'A friendship begins'}).getByRole('button',{name:/Continue/}).click();await playing('town');await expect(page.getByLabel('Music volume')).toHaveValue('1');
 const child=[...app.previewChildren][0],player=()=>child.store.players()[0],driver=new BrowserGame(page,player,id=>child.store.region(id));
 await driver.goTo(driver.object('healing-door'));await expect.poll(()=>player().sceneId).toBe('sanctuary');await playing('interior');await driver.goTo(driver.object('room-exit'));await expect.poll(()=>player().sceneId).toBeUndefined();await playing('town');
 await driver.interact(driver.object('guide'));await driver.continue();const learner=player();learner.tutorial=1;learner.lessonRegion=learner.regionId;child.store.savePlayer(learner);await driver.practice();await playing('battle');const p=player();p.battle!.enemy.hp=1;child.store.savePlayer(p);await expect(page.locator('.gba-health[data-side=enemy]')).toHaveAttribute('data-displayed-hp','1');await driver.attack();await playing('victory');await expect(controls).toHaveAttribute('data-track','town',{timeout:12000});await driver.closeBattle();
 await driver.goTo(driver.object('healing-door'));await playing('interior');await driver.interact(driver.object('merchant'));await playing('shop');await page.keyboard.press('Escape');await playing('interior');
 for(const [id,track] of [['0,-1','forest'],['1,0','coast'],['-1,0','ruins'],['0,1','exploration']]){const traveler=player();traveler.regionId=id;traveler.x=16;traveler.y=14;delete traveler.sceneId;delete traveler.movement;child.store.savePlayer(traveler);await playing(track);}
 assert.equal(child.generator.status.used,0);assert.deepEqual(errors,[]);assert.equal(new Set(audioRequests.map(url=>new URL(url).pathname)).size,10);
 mkdirSync(resolve('.test-data/verification'),{recursive:true});await page.screenshot({path:resolve('.test-data/verification/music-controls.png'),fullPage:true});writeFileSync(resolve('.test-data/verification/music.json'),JSON.stringify({passed:true,tracks:10,checks:['Gesture-gated playback','Mute and volume persistence across reloads and preview ports','Title/exploration/interior/battle transitions','One-shot victory returns to location ambience'],errors},null,2));console.log('Music playback checks passed. Ten scenario cues; no provider calls.');
}finally{await browser.close();await app.close();}
