import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';

const app=await createGameServer({dataDir:resolve('.test-data','connection-flow-'+randomUUID()),port:0,adminPort:0,fixture:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({reducedMotion:'reduce'});
try{
  await page.goto('http://127.0.0.1:'+app.adminPort);
  await page.getByRole('button',{name:'Single player',exact:true}).click();
  await expect(page.getByRole('region',{name:'Connect to Codex',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let attempts=0;
  await page.route('**/api/host/verify',async route=>{attempts++;if(attempts===1)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test connection is unavailable.'})});else await route.continue();});
  await page.getByRole('button',{name:'Connect to Codex',exact:true}).click();
  const error=page.getByRole('dialog',{name:'Connection problem'});await expect(error).toContainText('Test connection is unavailable.');assert.equal(attempts,1);
  await error.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'The valley beyond the map'})).toBeVisible();assert.equal(attempts,2);
  await expect(page.getByRole('dialog',{name:'Starting your adventure'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Continue adventure'})).toHaveCount(0);
  assert.equal(app.generator.verified,true);
  console.log('Connection flow passed: inline setup, error-only popup, explicit retry, direct game entry. Fixture only.');
}finally{await browser.close();await app.close();}
