// Portable save transfer: export shape from the browser runtime imports cleanly
// into a fresh local preview run; malformed or unsupported files fail safely.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {MemoryStore} from '../game/browser/memory-store.js';
import {buildPortableSave} from '../game/browser/portable.js';
import {parsePortableSave,applyPortableSave} from '../game/server/import.js';
import {loadPreviewPack} from '../game/server/preview.js';
import {validateRegion,LAYOUT_VERSION} from '../game/engine/maps.js';
import type {Region} from '../game/shared/model.js';

const PREVIEW_IDS=['0,0','0,-1','0,1','-1,0','1,0'];
function demoWorld(){
  const store=new MemoryStore();
  const pack=JSON.parse(readFileSync(resolve('game/content/tutorial-world.json'),'utf8')) as {version:number;seed:string;name:string;regions:Region[]};
  for(const region of pack.regions)validateRegion(region);
  store.transaction(()=>{store.setMeta('seed',pack.seed);store.setMeta('name',pack.name);store.setMeta('previewPackVersion',String(pack.version));store.setMeta('previewPromoted','false');for(const region of pack.regions)store.saveRegion(region);});
  const world=new World(store,new Set(PREVIEW_IDS));
  return {store,world};
}

test('exported demo progress imports into a fresh isolated run with new credentials',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ip-transfer-'));
  const local=new Store(join(dir,'run'));
  loadPreviewPack(local);
  try{
    // Play the demo for a bit, then export.
    const {store,world}=demoWorld();
    const {player}=world.createPlayer('Carla');
    world.apply(player.id,'i0',{kind:'intro'});world.apply(player.id,'s1',{kind:'starter',species:'charmander'});
    world.apply(player.id,'m1',{kind:'move',direction:'east',seq:1});
    world.apply(player.id,'m2',{kind:'move',direction:'east',seq:2});
    const text=JSON.stringify(buildPortableSave(store,store.player(player.id)!));

    const save=parsePortableSave(text);
    const before=local.players().length;
    const {player:imported,token}=applyPortableSave(local,save);
    assert.equal(local.players().length,before+1,'import adds exactly one player');
    assert.notEqual(imported.id,player.id,'new local identity');
    assert.equal(imported.name,'Carla');
    assert.equal(imported.party.length,1);
    assert.equal(imported.party[0].species,'charmander');
    assert.equal(imported.coins,store.player(player.id)!.coins);
    assert.equal(imported.tutorial,0);
    assert.ok(local.byToken(token),'new credentials authenticate');
    assert.equal(local.meta('hostPlayerId'),imported.id);
    assert.ok(PREVIEW_IDS.includes(imported.regionId as typeof PREVIEW_IDS[number]));
    // Continuity history carried over.
    assert.ok(local.eventsFor(imported.id).some(e=>e.kind==='arrival'));
    // The engine accepts the imported player immediately.
    const world2=new World(local,new Set(PREVIEW_IDS));
    const view=world2.view(imported.id,{state:'ready',message:'',queued:0,completed:0,failed:0,limit:0,used:0,mode:'preview'});
    assert.equal(view.me.name,'Carla');
    assert.ok(view.region.tiles.length>0);
  }finally{local.close();rmSync(dir,{recursive:true,force:true});}
});

test('malformed or unsupported saves are rejected without touching the run',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ip-transfer-bad-'));
  const local=new Store(join(dir,'run'));
  loadPreviewPack(local);
  try{
    const rejects=[['not json','{nope'],['wrong format',JSON.stringify({format:'other'})],['wrong pack',JSON.stringify({format:'infinite-pokemon-save',formatVersion:1,demoPackVersion:LAYOUT_VERSION-1})]];
    for(const [label,text] of rejects)assert.throws(()=>parsePortableSave(text),Error,label);
    // Out-of-bounds position is caught at apply time, before any player is added.
    const {store,world}=demoWorld();
    const {player}=world.createPlayer('Bound');
    world.apply(player.id,'i0',{kind:'intro'});world.apply(player.id,'s1',{kind:'starter',species:'squirtle'});
    const save=buildPortableSave(store,store.player(player.id)!);
    const bad={...save,position:{...save.position,x:999,y:999}};
    assert.throws(()=>applyPortableSave(local,parsePortableSave(JSON.stringify(bad))));
    assert.equal(local.players().length,0,'existing runs untouched');
    // Missing prepared-map reference is rejected.
    const missing={...save,worldChanges:[save.worldChanges[0]]};
    assert.throws(()=>parsePortableSave(JSON.stringify(missing)));
  }finally{local.close();rmSync(dir,{recursive:true,force:true});}
});
