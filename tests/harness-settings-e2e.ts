import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';

const app=await createGameServer({dataDir:resolve('.test-data','harness-settings-'+randomUUID()),port:0,adminPort:0,fixture:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1100,height:950},reducedMotion:'reduce'}),errors:string[]=[];
page.on('pageerror',error=>errors.push(error.message));mkdirSync(resolve('.test-data/verification'),{recursive:true});
try{
  await page.goto('http://127.0.0.1:'+app.adminPort);await page.getByRole('button',{name:'Single player',exact:true}).click();await page.getByRole('button',{name:'Connect to Codex',exact:true}).click();
  await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();await page.getByRole('dialog',{name:'A friendship begins'}).getByRole('button',{name:/Continue/}).click();
  const trainer=app.store.players()[0],hashes=app.store.regions().map(region=>region.hash);
  await page.getByRole('button',{name:'Open game menu'}).click();await page.getByRole('button',{name:'SESSION',exact:true}).click();
  await page.getByRole('button',{name:'Disconnect harness',exact:true}).click();await expect.poll(()=>app.generator.verified).toBe(false);assert.equal(app.generator.hasRememberedConnection(),false);
  await expect(page.getByRole('region',{name:'AI harness settings'})).toContainText('AI harness disconnected');assert.equal(app.store.players()[0].id,trainer.id);assert.deepEqual(app.store.regions().map(region=>region.hash),hashes);
  await page.getByRole('button',{name:'Switch harness',exact:true}).click();await page.screenshot({path:resolve('.test-data/verification/harness-settings.png'),fullPage:true});
  await page.getByRole('button',{name:'Switch and connect',exact:true}).click();await expect.poll(()=>app.generator.verified).toBe(true);await expect(page.getByRole('region',{name:'AI harness settings'})).toContainText('Connected to local Codex');
  assert.equal(app.store.players()[0].id,trainer.id);assert.equal(app.store.meta('sessionMode'),'singleplayer');
  for(const action of ['disconnect','switch-account','switch-connection'])assert.equal((await fetch(`http://127.0.0.1:${app.port}/api/host/${action}`,{method:'POST',headers:{'content-type':'application/json','x-host-token':app.hostToken},body:'{}'})).status,403);
  await page.getByRole('button',{name:'Switch harness',exact:true}).click();await page.getByRole('button',{name:'Switch Codex account',exact:true}).click();await expect(page.getByRole('link',{name:'Sign in to Codex'})).toBeVisible();assert.equal(app.generator.hasRememberedConnection(),false);
  await page.getByRole('button',{name:'I’ve signed in — continue'}).click();await expect.poll(()=>app.generator.verified).toBe(true);await expect(page.getByRole('dialog',{name:'Session',exact:true})).toHaveCount(0);
  assert.deepEqual(errors,[]);console.log('Harness settings UI passed: disconnect, reconnect, switch account and guest rejection. Fixture only; no Codex calls.');
}finally{await browser.close();await app.close();}
