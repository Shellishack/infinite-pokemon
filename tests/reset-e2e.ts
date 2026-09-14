import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';

const app=await createGameServer({dataDir:resolve('.test-data','reset-ui-'+randomUUID()),port:0,adminPort:0,fixture:true});
app.world.warmStart();app.world.createPlayer('Before reset');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1100,height:950},reducedMotion:'reduce'}),errors:string[]=[];
page.on('pageerror',error=>errors.push(error.message));
const output=resolve('.test-data/verification');mkdirSync(output,{recursive:true});
try{
  await page.goto('http://127.0.0.1:'+app.adminPort);
  await expect(page.getByRole('navigation',{name:'Title menu'}).getByRole('button')).toHaveCount(2);
  await page.getByRole('button',{name:'Home settings'}).click();
  await expect(page.getByRole('dialog',{name:'Home settings'})).toContainText('Full game reset');
  await page.getByRole('button',{name:'Reset entire game…'}).click();
  const confirm=page.getByRole('dialog',{name:'Reset entire game?'});
  await expect(confirm.getByRole('button',{name:'Erase game data'})).toBeDisabled();
  await confirm.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(app.store.players().length,1);
  await page.getByRole('button',{name:'Reset entire game…'}).click();await page.getByLabel('Type RESET to confirm').fill('RESET');
  await page.screenshot({path:resolve(output,'full-game-reset.png'),fullPage:true});
  await confirm.getByRole('button',{name:'Erase game data'}).click();
  await expect(page.getByRole('dialog',{name:'Game reset',exact:true})).toBeVisible();assert.equal(app.store.players().length,0);assert.equal(app.store.regions().length,0);
  await page.getByRole('dialog',{name:'Game reset',exact:true}).getByRole('button',{name:/Continue/}).click();
  await expect(page.getByRole('button',{name:'Single player',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Single player',exact:true}).click();await expect(page.getByRole('button',{name:'Connect to Codex',exact:true})).toBeVisible();
  assert.equal(app.generator.status.used,0);assert.deepEqual(errors,[]);
  writeFileSync(resolve(output,'reset-e2e.json'),JSON.stringify({passed:true,checks:['Two title choices remain','Separate Home settings reset','Typed confirmation and cancel','Fresh world after reset','No generation or model calls']},null,2));
  console.log('Full reset UI passed. No live worlds or Codex calls used.');
}finally{await browser.close();await app.close();}
