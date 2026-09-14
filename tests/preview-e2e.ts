import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createGameServer } from '../game/server/index.js';
import { CodexTransport } from '../game/server/harness.js';
import { WIDTH } from '../game/shared/model.js';
import { BrowserGame } from './browser-game.js';

// Exercise the real production preview branch. Block external CLI access as a
// fail-fast assertion, without enabling the deterministic generator fixture.
const originalConnect = CodexTransport.prototype.connect;
let cliAttempts = 0;
CodexTransport.prototype.connect = async function () { cliAttempts++; throw new Error('A preview must never connect to Codex.'); };
const startedAt = new Date().toISOString();
const outputDir = resolve('.test-data/verification');
mkdirSync(outputDir, { recursive: true });
const main = await createGameServer({ dataDir: resolve('.test-data', 'preview-e2e-' + randomUUID()), port: 0, adminPort: 0, host: '127.0.0.1', fixture: false });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors: string[] = [], checks: string[] = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let child: Awaited<ReturnType<typeof createGameServer>> | undefined;
try {
  await page.goto('http://127.0.0.1:' + main.adminPort);
  await page.getByRole('button', { name: 'Single player', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play tutorial preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Play tutorial preview' }).click();
  await expect(page.getByRole('dialog', { name: 'The valley beyond the map' })).toBeVisible();
  assert.equal(main.previewChildren.size, 1);
  child = [...main.previewChildren][0];
  assert.equal(child!.generator.fixture, false);
  assert.equal(child!.preview, true);
  assert.equal(child!.store.regions().length, 5);
  const initialHashes = child!.store.regions().map(r => [r.id, r.hash]).sort();
  const player = () => child!.store.players()[0];
  const pid = player().id;
  checks.push('Single player opens an isolated five-area production preview without connecting or verifying Codex.');
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await page.getByRole('dialog', { name: 'Choose your first companion' }).getByRole('button', { name: /Bulbasaur/ }).click();
  await page.getByRole('dialog', { name: 'A friendship begins' }).getByRole('button', { name: /Continue/ }).click();
  await expect(page.locator('.preview-notice')).toContainText('5 prepared areas');
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
  const driver = new BrowserGame(page, player, id => child!.store.region(id));
  await driver.interact(driver.object('guide'));
  await driver.continue();
  assert.equal(player().tutorial, 1);
  await driver.travel('north', '0,-1');

  // Find a reachable northern edge from the actual forest geometry. The route
  // deliberately bends, so holding north from the spawn is not a valid test.
  const edge = Array.from({ length: WIDTH }, (_, x) => ({ x, y: 0 }))
    .map(point => ({ ...point, path: driver.pathTo(point) }))
    .filter(candidate => candidate.path !== undefined)
    .sort((a, b) => a.path!.length - b.path!.length)[0];
  assert.ok(edge, 'The prepared northern map must have a reachable north exit.');
  await driver.goTo(edge);
  const boundaryPosition = { x: player().x, y: player().y };
  await page.locator('.game-canvas canvas').focus();
  await page.keyboard.down('ArrowUp');
  try { await expect(page.getByRole('dialog', { name: 'The edge of the preview' })).toBeVisible(); }
  finally { await page.keyboard.up('ArrowUp'); }
  await expect(page.getByRole('dialog', { name: 'The edge of the preview' }).getByRole('button', { name: 'Connect to Codex' })).toBeVisible();
  assert.equal(player().regionId, '0,-1');
  assert.deepEqual({ x: player().x, y: player().y }, boundaryPosition);
  assert.equal(child!.store.regions().length, 5);
  await page.screenshot({ path: resolve(outputDir, 'preview-boundary.png'), fullPage: true });
  await driver.continue();
  checks.push('The finite edge rejects travel beyond the five authored areas and offers Connect to Codex without allocating a map.');
  await driver.practice();
  await driver.winBattle();
  assert.equal(player().tutorial, 2);
  await driver.travel('south', '0,0');
  await driver.practice();
  assert.equal(player().battle?.kind, 'training');
  for (let i = 0; i < 8 && player().battle!.enemy.hp > player().battle!.enemy.maxHp * .6; i++) {
    await driver.attack(false);
    assert.equal(player().battle?.finished, false, 'Practice target must remain alive for capture.');
  }
  assert.ok(player().battle!.enemy.hp <= player().battle!.enemy.maxHp * .6);
  await driver.readyBattle();
  await page.getByRole('button', { name: 'BAG', exact: true }).click();
  await page.getByRole('button', { name: /POKé BALL/ }).click();
  await expect.poll(() => player().tutorial).toBe(3);
  await driver.readyBattle();
  await driver.closeBattle();
  assert.equal(player().party.length, 2);
  await driver.travel('north', '0,-1');
  await driver.goTo(driver.object('healing-door'));
  await expect.poll(() => player().sceneId).toBe('sanctuary');
  assert.equal(child!.store.regions().length, 5, 'The cabin is an embedded room, not another world map.');
  await driver.interact(driver.object('healer'));
  await driver.continue();
  assert.ok(player().party.every(creature => creature.hp === creature.maxHp));
  await page.getByRole('button', { name: 'Open game menu' }).click();
  await page.getByRole('button', { name: 'Your team' }).click();
  await page.locator('.companion-card').nth(1).click();
  await expect.poll(() => player().tutorial).toBe(4);
  await driver.continue();
  await driver.goTo(driver.object('room-exit'));
  await expect.poll(() => player().sceneId).toBeUndefined();
  await driver.travel('south', '0,0');
  await driver.interact(driver.object('trainer'));
  await driver.readyBattle();
  await driver.winBattle();
  await driver.interact(driver.object('guide'));
  await page.getByRole('button', { name: 'Protect the Waystone', exact: true }).click();
  await expect.poll(() => player().tutorial).toBe(5);
  await driver.continue();
  checks.push('All five beginner lessons complete through town/forest revisits, with facing-adjacent guide interactions, battle menus, capture, indoor caretaker healing, party switching and the trainer/choice lesson.');
  assert.deepEqual(child!.store.regions().map(r => [r.id, r.hash]).sort(), initialHashes);
  assert.equal(child!.generator.status.used, 0);
  assert.equal(child!.generator.status.queued, 0);
  assert.equal(child!.generator.transport.child, null);
  assert.equal(child!.store.db.prepare('SELECT COUNT(*) AS count FROM jobs').get()!.count, 0);
  assert.equal(main.store.players().length, 0);
  assert.equal(main.store.regions().length, 0);
  assert.equal(cliAttempts, 0);
  checks.push('No CLI connection, model usage, queued generation, generation job, changed map hash, or original-world modification occurs.');
  await page.goto('http://127.0.0.1:' + main.adminPort);
  await page.getByRole('button', { name: 'Single player', exact: true }).click();
  await expect(page.locator('.preview-notice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open game menu' })).toBeVisible();
  assert.equal(main.previewChildren.size, 1);
  assert.equal(player().id, pid);
  assert.equal(player().tutorial, 5);
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
  await driver.goTo(driver.scene().spawn!);
  await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
  await expect(page.getByRole('button',{name:'Guardian with friends'})).toHaveCount(0);
  checks.push('Main Single player resumes the same separate preview save with completed tutorial and captured companion.');
  await page.screenshot({ path: resolve(outputDir, 'preview-complete.png'), fullPage: true });
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push((error as Error).stack ?? String(error));
  process.exitCode = 1;
} finally {
  const result = { status: process.exitCode ? 'failed' : 'passed', startedAt, completedAt: new Date().toISOString(), fixture: false, cliAttempts, modelCalls: 0, checks, errors };
  writeFileSync(resolve(outputDir, 'preview-e2e.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  await main.close();
  CodexTransport.prototype.connect = originalConnect;
}
