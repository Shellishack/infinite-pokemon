import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';
import {compileRegion,fallbackStory,validateRegion} from '../game/engine/maps.js';
import {BrowserGame} from './browser-game.js';

const app=await createGameServer({dataDir:resolve('.test-data','design-ui-'+randomUUID()),port:0,adminPort:0,fixture:true});
const proposal={...fallbackStory(0,0,app.store.meta('seed')!),npcBehaviors:[{sceneId:'outdoor' as const,npcId:'guide',behavior:{movement:'wander' as const,radius:2,intervalSeconds:2,waypoints:[]}}],interiors:[{sceneId:'sanctuary' as const,name:'Mosslight Reading House',furniture:[{kind:'bookcase' as const,name:'Trail records',text:'Records of travelers exploring the valley.',x:10,y:8,width:2,height:3},{kind:'table' as const,name:'Reading desk',text:'A lantern lights a well-traveled map.',x:14,y:7,width:4,height:1},{kind:'bed' as const,name:'Traveler cot',text:'Fresh linen waits for tired companions.',x:20,y:12,width:2,height:2}],rugs:[{x:14,y:12,width:3,height:4}]}]};
const region=compileRegion(0,0,app.store.meta('seed')!,proposal);validateRegion(region);app.store.saveRegion(region);
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1100,height:1050},reducedMotion:'reduce'}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
mkdirSync(resolve('.test-data/verification'),{recursive:true});
try{
  await page.goto('http://127.0.0.1:'+app.adminPort);await page.getByRole('button',{name:'Single player',exact:true}).click();await page.getByRole('button',{name:'Connect to Codex',exact:true}).click();await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();await page.getByRole('dialog',{name:'A friendship begins'}).getByRole('button',{name:/Continue/}).click();
  const player=()=>app.store.players()[0],driver=new BrowserGame(page,player,id=>id===player().regionId?app.world.view(player().id,app.generator.status).region:app.store.region(id));
  await expect.poll(()=>Number(app.store.db.prepare('SELECT COUNT(*) n FROM npc_motion').get()!.n),{timeout:8000}).toBeGreaterThan(0);
  const moving=app.world.view(player().id,app.generator.status).region.objects!.find(object=>object.id==='guide')!;assert.ok(moving.motion);
  await page.screenshot({path:resolve('.test-data/verification/generated-npc-movement.png'),fullPage:true});
  await driver.goTo(driver.object('healing-door'));await expect.poll(()=>player().sceneId).toBe('sanctuary');await driver.settle();
  await expect(page.locator('.location-sign')).toContainText('Mosslight Reading House');
  await page.screenshot({path:resolve('.test-data/verification/generated-interior.png'),fullPage:true});
  await driver.interact(driver.object('generated-furniture-1'));await expect(page.getByRole('dialog',{name:'Reading desk'})).toContainText('A lantern lights');await driver.continue();
  await driver.interact(driver.object('healer'));await driver.continue();
  await driver.goTo(driver.object('room-exit'));await expect.poll(()=>player().sceneId).toBeUndefined();
  assert.deepEqual(errors,[]);console.log('Generated NPC movement and interior UI passed: animation data, room rendering, furniture interaction, healing and exit. No provider calls.');
}finally{await browser.close();await app.close();}
