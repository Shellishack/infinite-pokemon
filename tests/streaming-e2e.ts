import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';
import {CodexTransport,type RunResult} from '../game/server/harness.js';
import {fallbackStory} from '../game/engine/maps.js';
import {BrowserGame} from './browser-game.js';

class ControlledTransport extends CodexTransport {
  jobs:Array<{context:any;resolve:(result:RunResult)=>void;reject:(error:Error)=>void}>=[];
  override run(prompt:string){const paths=(prompt.match(/"(?:\\.|[^"\\])*"/g)??[]).map(text=>JSON.parse(text));const path=paths.find(value=>typeof value==='string'&&value.endsWith('context.json'));const context=JSON.parse(readFileSync(path,'utf8'));return new Promise<RunResult>((resolve,reject)=>this.jobs.push({context,resolve,reject}));}
  finish(index:number){const job=this.jobs[index],c=job.context;job.resolve({output:{snapshotId:c.snapshotId,story:fallbackStory(c.request.gx,c.request.gy,c.world.seed)},usage:null,duration:1});}
  override async cancelActive(){for(const job of this.jobs)job.reject(new Error('Test generation cancelled.'));}
  override async close(){await this.cancelActive();}
}
const original=CodexTransport.prototype.connect;let cliAttempts=0;CodexTransport.prototype.connect=async()=>{cliAttempts++;throw new Error('Browser fixtures must not connect Codex.');};
const app=await createGameServer({dataDir:resolve('.test-data','stream-ui-'+randomUUID()),port:0,adminPort:0,host:'127.0.0.1',fixture:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1100,height:950},reducedMotion:'reduce'});
const output=resolve('.test-data/verification');mkdirSync(output,{recursive:true});const checks:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:'+app.adminPort);await page.getByRole('button',{name:'Single player',exact:true}).click();await expect(page.getByLabel('Generation batch size')).not.toBeVisible();await page.getByText('Optional settings',{exact:true}).click();await expect(page.getByLabel('Generation batch size')).toHaveValue('3');await page.getByLabel('Generation batch size').selectOption('1');await expect.poll(()=>app.generator.batchSize()).toBe(1);await expect(page.getByLabel('Map generation depth')).toHaveValue('1');await page.getByLabel('Map generation depth').selectOption('0');await expect.poll(()=>app.world.renderDepth()).toBe(0);
  await page.getByRole('button',{name:'Connect to Codex',exact:true}).click();await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();await page.getByRole('dialog',{name:'A friendship begins'}).getByRole('button',{name:/Continue/}).click();
  assert.equal(app.store.regions().length,1);assert.equal(app.generator.status.used,0);
  const transport=new ControlledTransport(app.store.root);app.generator.fixture=false;app.generator.transport=transport;
  const player=()=>app.store.players()[0],driver=new BrowserGame(page,player,id=>app.store.region(id));await driver.interact(driver.object('guide'));await driver.continue();await driver.goTo({x:31,y:12});
  await page.keyboard.press('ArrowRight');const loading=page.getByRole('dialog',{name:'Preparing the next map'});await expect(loading).toBeVisible();await expect(page.locator('.map-loading')).toHaveAttribute('data-phase','generating');assert.equal(player().regionId,'0,0');assert.equal(app.store.region('1,0')!.published,false);
  await page.keyboard.press('d');assert.equal(player().regionId,'0,0');transport.jobs[0].reject(new Error('Deliberately failed test job'));await expect(page.locator('.map-loading')).toHaveAttribute('data-phase','failed');await page.getByRole('button',{name:'Retry generation'}).click();await expect.poll(()=>transport.jobs.length).toBe(2);await expect(page.locator('.map-loading')).toHaveAttribute('data-phase','generating');
  await page.screenshot({path:resolve(output,'map-loading.png'),fullPage:true});transport.finish(1);await expect.poll(()=>player().regionId).toBe('1,0');await expect(loading).toHaveCount(0);await driver.settle();assert.equal(app.store.regions().length,2);
  checks.push('Depth zero creates only the starting map, blocks travel until generation completes, exposes failures and retry, then enters automatically.');
  await driver.goTo({x:0,y:12});await page.keyboard.press('ArrowLeft');await expect.poll(()=>player().regionId).toBe('0,0');await driver.settle();assert.equal(transport.jobs.length,2);
  await driver.goTo({x:16,y:0});await page.keyboard.press('ArrowUp');await expect(loading).toBeVisible();await expect.poll(()=>transport.jobs.length).toBe(3);await page.getByRole('button',{name:'Cancel travel'}).click();await expect(loading).toHaveCount(0);transport.finish(2);await expect.poll(()=>app.generator.busy).toBe(false);assert.equal(player().regionId,'0,0');assert.equal(app.store.region('0,-1')!.published,false);
  await page.keyboard.press('ArrowUp');await expect.poll(()=>player().regionId).toBe('0,-1');await driver.settle();assert.equal(transport.jobs.length,3);
  checks.push('Cancellation leaves the player in place after a late completion; revisiting a cached map needs no new job.');
  app.generator.paused=true;await page.getByRole('button',{name:'Open game menu'}).click();await page.getByRole('button',{name:'SESSION',exact:true}).click();await page.getByText('Optional settings',{exact:true}).click();await page.getByLabel('Map generation depth').selectOption('2');await expect.poll(()=>app.world.renderDepth()).toBe(2);assert.equal(await page.getByLabel('Map generation depth').locator('option').count(),4);await expect(page.getByLabel('Generation batch size')).toHaveValue('1');await page.getByLabel('Generation batch size').selectOption('3');await expect.poll(()=>app.generator.batchSize()).toBe(3);await page.screenshot({path:resolve(output,'render-depth-settings.png'),fullPage:true});
  checks.push('Host changes depth from the game session settings; options are exactly0,1,2,3.');
  await page.keyboard.press('Escape');
  const indicator=page.locator('.generation-indicator');
  await expect(indicator).toBeVisible();await expect(indicator).toHaveAttribute('data-phase','paused');
  const count=app.generator.queue.length;assert.ok(count>1);
  app.generator.paused=false;void app.generator.pump();
  await expect(indicator).toHaveAttribute('data-phase','generating');await expect(indicator).toContainText(`${count} blocks remaining`);await expect.poll(()=>transport.jobs.length).toBe(6);assert.equal([...app.generator.mapJobs.values()].filter(job=>job.phase==='generating').length,3);
  assert.equal((await fetch('http://127.0.0.1:'+app.port+'/api/agent')).status,403);
  await page.getByRole('button',{name:'View agent activity',exact:true}).click();
  const agentPanel=page.getByRole('dialog',{name:'Agent activity'});await expect(agentPanel).toBeVisible();
  await expect(agentPanel).toContainText('World generation');await expect(agentPanel).toContainText('Preparing saved context and agent skill.');
  await expect(agentPanel).toContainText('running');
  await page.screenshot({path:resolve(output,'agent-activity.png'),fullPage:true});
  await page.keyboard.press('Escape');await expect(agentPanel).toHaveCount(0);
  await page.screenshot({path:resolve(output,'background-generation.png'),fullPage:true});
  const before={x:player().x,y:player().y};await driver.goTo({x:16,y:22});assert.notDeepEqual({x:player().x,y:player().y},before);
  for(let i=0;i<count;i++){
    await expect.poll(()=>transport.jobs.length).toBe(3+Math.min(count,i+3));
    await expect(indicator).toContainText(`${count-i} ${count-i===1?'block':'blocks'} remaining`);
    if(i===count-1){assert.equal(app.generator.queue.length,0);await expect(indicator).toBeVisible();}
    transport.finish(3+i);
  }
  await expect(indicator).toHaveCount(0);await expect.poll(()=>app.generator.busy).toBe(false);
  await page.getByRole('button',{name:'Open game menu'}).click();await page.getByRole('button',{name:'AGENT',exact:true}).click();
  await expect(agentPanel).toBeVisible();await expect(agentPanel).toContainText('Validated result saved to this run.');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(output,'agent-activity-mobile.png'),fullPage:true});
  await agentPanel.getByRole('button',{name:'Back to game'}).click();await expect(agentPanel).toHaveCount(0);
  checks.push('Agent details open from the indicator and menu, update with job completion, close by Escape/button, and require a run credential.');
  checks.push('Background indicator tracks queued and active maps through the final job, leaves movement usable, and disappears after completion.');
  assert.equal(cliAttempts,0);assert.deepEqual(errors,[]);
}catch(error){errors.push((error as Error).stack??String(error));process.exitCode=1;await page.screenshot({path:resolve(output,'streaming-failure.png'),fullPage:true});}
finally{const result={status:process.exitCode?'failed':'passed',cliAttempts,checks,errors};writeFileSync(resolve(output,'streaming-e2e.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();await app.close();CodexTransport.prototype.connect=original;}
