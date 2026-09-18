// Shared gameplay scenarios must produce equivalent outcomes in the browser
// runtime (MemoryStore) and the local runtime (SQLite Store).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {compileRegion} from '../game/engine/maps.js';
import {MemoryStore} from '../game/browser/memory-store.js';
import {validateRegion,LAYOUT_VERSION} from '../game/engine/maps.js';
import type {Region,Direction} from '../game/shared/model.js';

const PREVIEW_IDS=['0,0','0,-1','0,1','-1,0','1,0'];
function loadPackInto(store:MemoryStore|Store){
  const pack=JSON.parse(readFileSync(resolve('game/content/tutorial-world.json'),'utf8')) as {version:number;seed:string;name:string;regions:Region[]};
  assert.equal(pack.version,LAYOUT_VERSION);
  for(const region of pack.regions)validateRegion(region);
  store.transaction(()=>{store.setMeta('seed',pack.seed);store.setMeta('name',pack.name);store.setMeta('previewPackVersion',String(pack.version));store.setMeta('previewPromoted','false');for(const region of pack.regions)store.saveRegion(region);});
}

function scenario(store:MemoryStore|Store){
  const world=new World(store,new Set(PREVIEW_IDS));
  let now=1_000_000;world.now=()=>now;
  const {player}=world.createPlayer('Testa');
  const pid=player.id;
  world.apply(pid,'i0',{kind:'intro'});
  world.apply(pid,'i1',{kind:'starter',species:'bulbasaur'});
  // Walk a deterministic path, advancing the clock so each step settles.
  const moves:Direction[]=['east','east','east','north','north','west','south'];
  moves.forEach((direction,index)=>{now+=1000;world.apply(pid,'m'+index,{kind:'move',direction,seq:index});});
  now+=1000;
  world.tick();
  const after=store.player(pid)!;
  return {after,events:store.eventsFor(pid)};
}

test('preview scenario produces equivalent outcomes in memory and sqlite runtimes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ip-equiv-'));
  const sqliteStore=new Store(join(dir,'world'));
  const memoryStore=new MemoryStore();
  loadPackInto(sqliteStore);loadPackInto(memoryStore);
  try{
    const a=scenario(sqliteStore),b=scenario(memoryStore);
    assert.equal(a.after.regionId,b.after.regionId);
    assert.equal(a.after.x,b.after.x);
    assert.equal(a.after.y,b.after.y);
    assert.equal(a.after.steps,b.after.steps);
    assert.equal(a.after.coins,b.after.coins);
    assert.equal(a.after.tutorial,b.after.tutorial);
    assert.equal(a.after.party.length,b.after.party.length);
    assert.equal(a.after.party[0].species,b.after.party[0].species);
    assert.equal(a.after.visited.length,b.after.visited.length);
    assert.deepEqual(a.events.map(e=>e.kind),b.events.map(e=>e.kind));
    assert.equal(a.after.journal.length,b.after.journal.length);
  }finally{sqliteStore.close();rmSync(dir,{recursive:true,force:true});}
});

test('region hashes compiled by the engine are deterministic',()=>{
  const a=compileRegion(2,3,'seed-x');const b=compileRegion(2,3,'seed-x');
  assert.equal(a.hash,b.hash);
  assert.notEqual(compileRegion(2,4,'seed-x').hash,a.hash);
});
