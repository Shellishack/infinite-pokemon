import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';
import {CodexTransport} from '../game/server/harness.js';
import {EXTRA_CREATURES} from '../game/shared/content.js';
import {creatureInfo,creatureKey} from '../game/shared/model.js';
import {BrowserGame} from './browser-game.js';

const original=CodexTransport.prototype.connect;let cliAttempts=0;CodexTransport.prototype.connect=async()=>{cliAttempts++;throw new Error('Variety preview must not use Codex.');};
const main=await createGameServer({dataDir:resolve('.test-data','variety-'+randomUUID()),port:0,adminPort:0,host:'127.0.0.1'});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1100,height:1000},reducedMotion:'reduce'});
const out=resolve('.test-data/verification');mkdirSync(out,{recursive:true});const errors:string[]=[],checks:string[]=[];page.on('pageerror',error=>errors.push(error.message));
const close=async(title:string)=>page.getByRole('dialog',{name:title,exact:true}).getByRole('button',{name:'Close',exact:true}).click();
const next=async(title:string)=>page.getByRole('dialog',{name:title,exact:true}).getByRole('button',{name:/Continue/}).click();
const menu=async(name:string)=>{await page.getByRole('button',{name:'Open game menu'}).click();await page.getByRole('button',{name,exact:true}).click();};
try{
  await page.goto('http://127.0.0.1:'+main.adminPort);await page.getByRole('button',{name:'Single player',exact:true}).click();await page.getByRole('button',{name:'Play tutorial preview'}).click();await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();await next('A friendship begins');
  const app=[...main.previewChildren][0],player=()=>app.store.players()[0],driver=new BrowserGame(page,player,id=>app.store.region(id));
  // Test-only setup, not an in-game grant or a live model result.
  const seeded=player();seeded.coins=2000;seeded.party.push(app.world.content.make(EXTRA_CREATURES[3].base,5,EXTRA_CREATURES[3]));app.store.savePlayer(seeded);
  const region=app.store.region('0,0')!;region.shopGoods=[{name:'Garden Tonic',description:'A locally blended tonic for tired companions.',effect:'heal',tier:2,icon:'herb',color:'#78ac86'}];region.hash+='-fixture-stock';app.store.saveRegion(region);
  await driver.goTo(driver.object('healing-door'));assert.equal(player().sceneId,'sanctuary');await driver.interact(driver.object('merchant'));const shop=page.getByRole('dialog',{name:'Trail shop'});await expect(shop).toBeVisible();await expect(shop).toContainText('Garden Tonic');
  const money=player().coins;await shop.locator('.catalog-row').filter({hasText:'Super Potion'}).getByRole('button').click();await next('Purchase complete');assert.ok(player().coins<money);assert.equal(player().items!['super-potion'],1);
  await shop.locator('.catalog-row').filter({hasText:'Great Ball'}).getByRole('button').click();await next('Purchase complete');await shop.locator('.catalog-row').filter({hasText:'Bicycle'}).getByRole('button').click();await next('A new way to travel');assert.ok(player().ownedVehicles!.includes('bicycle'));
  await page.screenshot({path:resolve(out,'variety-shop.png'),fullPage:true});await close('Trail shop');
  await driver.interact(driver.object('breeder'));const nursery=page.getByRole('dialog',{name:'Companion nursery'});await expect(nursery).toBeVisible();await nursery.getByLabel('First parent').selectOption(player().party[0].id);await nursery.getByLabel('Second parent').selectOption(player().party[1].id);await nursery.getByRole('button',{name:/Pair companions/}).click();await next('An egg to care for');assert.ok(player().egg);await close('Companion nursery');
  await driver.goTo(driver.object('room-exit'));await driver.goTo({x:16,y:14});
  for(let i=0;i<40&&player().egg;i++){const steps=player().steps;await page.keyboard.press(player().x<20?'ArrowRight':'ArrowLeft');await expect.poll(()=>player().steps).toBeGreaterThan(steps);await driver.settle();}
  await expect(page.getByRole('dialog',{name:'Your egg hatched!'})).toBeVisible();await next('Your egg hatched!');assert.equal(player().party.length,3);assert.equal(player().party[2].profile!.source,'hybrid');assert.equal(player().stats!.captures,0);
  await menu('CODEX');await expect(page.getByRole('dialog',{name:'Companion codex'})).toContainText(player().party[2].profile!.name);await page.screenshot({path:resolve(out,'variety-hybrids.png'),fullPage:true});await close('Companion codex');
  checks.push('Shop buys preset and local recipe goods with coins; nursery pairs owned parents, hatches one hybrid, and shows inherited traits/art in the codex.');
  await menu('RIDES');await page.getByRole('button',{name:'Ride',exact:true}).click();await expect.poll(()=>player().vehicleId).toBe('bicycle');await close('Your rides');await page.keyboard.press('ArrowLeft');await driver.settle();assert.equal(player().movement!.duration,110);await page.screenshot({path:resolve(out,'variety-bicycle.png'),fullPage:true});
  const p=player();p.vehicleId=undefined;p.tutorial=2;p.lessonRegion=p.regionId;app.world.startBattle(p,'training');const profile=EXTRA_CREATURES[6];p.battle!.enemy=app.world.content.make(profile.base,3,profile);p.battle!.enemy.hp=1;p.battle!.log=[`A wild ${profile.name} appeared!`];app.store.savePlayer(p);await driver.readyBattle();await expect(page.locator('.gba-status.enemy')).toContainText(profile.name.toUpperCase());await page.getByRole('button',{name:'BAG',exact:true}).click();await page.getByRole('button',{name:/GREAT BALL/}).click();await driver.readyBattle();await driver.closeBattle();assert.equal(player().stats!.captures,1);assert.ok(player().stats!.caughtSpecies.includes(profile.id));assert.equal(creatureKey(player().party.at(-1)!),profile.id);
  await menu('RECORDS');await expect(page.getByRole('dialog',{name:'Run leaderboards'})).toContainText('(you)');await page.getByLabel('Rank by').selectOption('species');await expect(page.locator('.leaderboard li.you strong')).toHaveText('1');await page.screenshot({path:resolve(out,'variety-leaderboard.png'),fullPage:true});await close('Run leaderboards');
  checks.push('Bicycle uses faster server movement; a distinct-profile capture retains its identity and increments the run leaderboard without counting the hatch.');
  await page.setViewportSize({width:390,height:844});await menu('CODEX');await expect.poll(()=>page.evaluate(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0))).toBe(true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,'variety-mobile.png'),fullPage:true});
  assert.equal(cliAttempts,0);assert.deepEqual(errors,[]);checks.push('All static/recipe images load and the collection UI fits a390px viewport.');
}catch(error){errors.push((error as Error).stack??String(error));process.exitCode=1;await page.screenshot({path:resolve(out,'variety-failure.png'),fullPage:true});}
finally{const result={status:process.exitCode?'failed':'passed',cliAttempts,setup:'Seeded test coins, second parent, local item recipe, and weakened profile encounter; not a provider trial.',checks,errors};writeFileSync(resolve(out,'variety-e2e.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();await main.close();CodexTransport.prototype.connect=original;}
