import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {createGameServer,type GameServer} from '../game/server/index.js';
import {CodexTransport} from '../game/server/harness.js';
import {BrowserGame} from './browser-game.js';

const original=CodexTransport.prototype.connect;let cliAttempts=0;
CodexTransport.prototype.connect=async function(){cliAttempts++;throw new Error('Save preview must not call Codex.');};
const main=await createGameServer({dataDir:resolve('.test-data','saves-ui-'+randomUUID()),port:0,adminPort:0,host:'127.0.0.1'});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
const output=resolve('.test-data/verification');mkdirSync(output,{recursive:true});const checks:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
const find=(server:GameServer,id:string):GameServer|undefined=>server.store.meta('runId')===id?server:[...server.previewChildren].map(child=>find(child,id)).find(Boolean);
const openSaves=async()=>{await page.getByRole('button',{name:'Open game menu'}).click();await page.getByRole('button',{name:'SAVES',exact:true}).click();await expect(page.locator('.save-current')).toBeVisible();};
const checkpoint=async(name:string)=>{await page.getByLabel('Save or run name').fill(name);await page.getByRole('button',{name:'Save checkpoint',exact:true}).click();await expect(page.getByRole('status')).toContainText('Checkpoint saved');};
try{
  await page.goto('http://127.0.0.1:'+main.adminPort);await page.getByRole('button',{name:'Single player',exact:true}).click();await page.getByRole('button',{name:'Play tutorial preview'}).click();await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();await page.getByRole('dialog',{name:'A friendship begins'}).getByRole('button',{name:/Continue/}).click();
  const originalRun=[...main.previewChildren][0],player=()=>originalRun.store.players()[0],driver=new BrowserGame(page,player,id=>originalRun.store.region(id));
  const savedPosition={x:player().x,y:player().y,steps:player().steps};await openSaves();await checkpoint('Partner chosen');await page.getByRole('dialog',{name:'Saves & runs'}).getByRole('button',{name:'Close',exact:true}).click();
  await driver.goTo({x:19,y:14});const laterSteps=player().steps;await openSaves();await checkpoint('Further along');
  await page.getByRole('region',{name:'Checkpoint tree'}).getByRole('button',{name:/Partner chosen/}).click();await page.getByLabel('Save or run name').fill('Other path');
  await page.screenshot({path:resolve(output,'saves-tree.png'),fullPage:true});await page.getByRole('button',{name:'Branch from checkpoint',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open game menu'})).toBeVisible();await openSaves();await expect(page.locator('.save-current')).toContainText('Other path');
  const bootstrap=await(await fetch(new URL('/api/bootstrap',page.url()))).json();const catalog=await(await fetch(new URL('/api/saves',page.url()),{headers:{'x-host-token':bootstrap.hostToken}})).json();
  const branch=find(main,catalog.currentRunId)!;assert.ok(branch);const forkPlayer=branch.store.players()[0];assert.deepEqual({x:forkPlayer.x,y:forkPlayer.y,steps:forkPlayer.steps},savedPosition);assert.equal(player().steps,laterSteps);assert.equal(forkPlayer.party[0].species,'bulbasaur');
  await checkpoint('Branch checkpoint');const branchCatalog=await(await fetch(new URL('/api/saves',page.url()),{headers:{'x-host-token':bootstrap.hostToken}})).json();assert.equal(branchCatalog.checkpoints.find((c:any)=>c.name==='Branch checkpoint').parentId,branchCatalog.checkpoints.find((c:any)=>c.name==='Partner chosen').id);
  checks.push('Named immutable checkpoints form a tree; branching restores earlier position and companions while the original keeps later progress.');
  await page.locator('.save-run').filter({hasText:'Tutorial run'}).click();await page.getByRole('button',{name:'Continue run',exact:true}).click();await expect(page.getByRole('button',{name:'Open game menu'})).toBeVisible();await driver.settle();assert.equal(player().steps,laterSteps);
  await openSaves();await page.getByLabel('Save or run name').fill('Fresh beginning');await page.getByRole('button',{name:'New tutorial run',exact:true}).click();await expect(page.getByRole('dialog',{name:'The valley beyond the map'})).toBeVisible();
  await page.getByRole('button',{name:'Saves & runs',exact:true}).click();await expect(page.locator('.save-current')).toContainText('Fresh beginning');await page.locator('.save-run').filter({hasText:'Tutorial run'}).click();await page.getByRole('button',{name:'Continue run',exact:true}).click();await expect(page.getByRole('button',{name:'Open game menu'})).toBeVisible();assert.equal(player().steps,laterSteps);
  checks.push('A run resumes its latest autosave; a fresh run gets its own introduction and can switch back without overwriting anything.');
  await page.setViewportSize({width:390,height:844});await openSaves();await page.screenshot({path:resolve(output,'saves-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  checks.push('Save browser remains usable at390px without horizontal overflow.');assert.equal(cliAttempts,0);assert.deepEqual(errors,[]);
}catch(error){errors.push((error as Error).stack??String(error));process.exitCode=1;await page.screenshot({path:resolve(output,'saves-failure.png'),fullPage:true});}
finally{const result={status:process.exitCode?'failed':'passed',cliAttempts,checks,errors};writeFileSync(resolve(output,'saves-e2e.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();await main.close();CodexTransport.prototype.connect=original;}
