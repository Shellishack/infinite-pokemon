import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {createGameServer} from '../game/server/index.js';
import {CodexTransport} from '../game/server/harness.js';
import {BrowserGame} from './browser-game.js';

const original=CodexTransport.prototype.connect;let cliAttempts=0;
CodexTransport.prototype.connect=async function(){cliAttempts++;throw new Error('Dialogue preview must not call Codex.');};
const app=await createGameServer({dataDir:resolve('.test-data','dialogue-'+randomUUID()),port:0,adminPort:0,host:'127.0.0.1',fixture:false});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:695,height:784}});
const errors:string[]=[],checks:string[]=[];page.on('pageerror',error=>errors.push(error.message));
const output=resolve('.test-data/verification');mkdirSync(output,{recursive:true});
try{
  await page.goto('http://127.0.0.1:'+app.adminPort);await page.getByRole('button',{name:'Single player',exact:true}).click();await page.getByRole('button',{name:'Play tutorial preview'}).click();
  await page.getByRole('button',{name:'Skip introduction'}).click();await page.getByRole('dialog',{name:'Choose your first companion'}).getByRole('button',{name:/Bulbasaur/}).click();
  await expect(page.getByRole('dialog',{name:'A friendship begins'})).toBeVisible();await page.keyboard.press('e');await expect(page.getByRole('dialog')).toHaveCount(0);
  const child=[...app.previewChildren][0],player=()=>child.store.players()[0],driver=new BrowserGame(page,player,id=>child.store.region(id));
  await page.getByRole('button',{name:'Close objective',exact:true}).click();await expect(page.getByRole('region',{name:'Current objective'})).toHaveCount(0);
  await page.getByRole('button',{name:'Show objective',exact:true}).click();await expect(page.getByRole('region',{name:'Current objective'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('navigation',{name:'Game menu'})).toBeVisible();await expect(page.getByRole('region',{name:'Current objective'})).toBeVisible();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Close objective',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Single player',exact:true}).click();await expect(page.getByRole('button',{name:'Show objective',exact:true})).toBeVisible();
  checks.push('Escape toggles the menu while the objective stays visible; the objective Close button persists dismissal across reloads.');
  await driver.interact(driver.object('guide'));await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(player().tutorial,1);
  await expect(page.getByRole('region',{name:'Current objective'})).toBeVisible();
  for(const key of ['e','Space','Enter','Escape']){
    await driver.interact(driver.object('guide'));await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press(key);await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region',{name:'Current objective'})).toBeVisible();
  }
  checks.push('NPC dialogue closes with E, Space, Enter, or Escape; Escape closes only the modal, and a new lesson exposes its new objective.');
  await driver.interact(driver.object('guide'));await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await driver.interact(driver.object('guide'));await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:/Continue/}).focus();await page.keyboard.press('Space');await expect(page.getByRole('dialog')).toHaveCount(0);
  const steps=player().steps;await driver.goTo({x:16,y:14});assert.ok(player().steps>steps);
  await page.getByRole('button',{name:'Close objective',exact:true}).click();await page.screenshot({path:resolve(output,'dialogue-dismissed.png'),fullPage:true});
  checks.push('Close and Continue buttons work, and walking resumes after dialogue dismissal.');
  assert.equal(cliAttempts,0);assert.equal(child.generator.status.used,0);assert.deepEqual(errors,[]);
}catch(error){errors.push((error as Error).stack??String(error));process.exitCode=1;await page.screenshot({path:resolve(output,'dialogue-failure.png'),fullPage:true});}
finally{const result={status:process.exitCode?'failed':'passed',cliAttempts,checks,errors};writeFileSync(resolve(output,'dialogue.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();await app.close();CodexTransport.prototype.connect=original;}
