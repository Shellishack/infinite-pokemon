import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { compileRegion, fallbackStory, LAYOUT_VERSION, upgradeLegacyLayouts, validateRegion } from '../game/engine/maps.js';
import { loadPreviewPack, PREVIEW_REGION_IDS } from '../game/server/preview.js';
import { Store } from '../game/server/store.js';
import { getScene, solidAt } from '../game/shared/scene.js';
import { WIDTH, HEIGHT, type Player, type Region, type MapFeature } from '../game/shared/model.js';

const coordinates=[[0,0],[0,-1],[0,1],[1,0],[-1,0]];
const seed='layout-v2-game-check';
const fresh=()=>new Store(resolve('.test-data','layout-v2-'+randomUUID()));
function legacyRegion(gx:number,gy:number):Region {
  const r=compileRegion(gx,gy,seed);delete r.objects;delete r.scenes;delete r.spawn;delete r.layoutVersion;
  r.tiles=Array.from({length:WIDTH*HEIGHT},(_,i)=>{const x=i%WIDTH,y=Math.floor(i/WIDTH);return x>=15&&x<=17||y>=11&&y<=13?1:x===0||y===0||x===WIDTH-1||y===HEIGHT-1?2:0;});
  r.hash='legacy-'+r.id;r.published=true;r.source='authored';return r;
}
function player():Player{return {id:'saved-trainer',name:'Ari',color:2,regionId:'0,0',x:6,y:5,facing:'north',party:[{id:'companion',species:'squirtle',level:9,hp:37,maxHp:60,xp:12}],storage:[],active:0,balls:11,potions:3,coins:287,tutorial:3,tutorialFlags:['healed'],lessonRegion:'0,-1',introDone:true,visited:['0,0','0,-1'],journal:['Caught a companion before the upgrade.'],battle:null,choice:'protect',steps:193,collectedItems:['0,0:supply-item']};}

test('five opening layouts differ in terrain, route topology, NPC positions, and landmarks',()=>{
  const regions=coordinates.map(([x,y])=>compileRegion(x,y,seed));
  for(const region of regions){assert.equal(region.layoutVersion,LAYOUT_VERSION);assert.equal(validateRegion(region).exits,4);assert.ok(region.scenes?.length);assert.ok(!solidAt(region,region.spawn!.x,region.spawn!.y));}
  for(let a=0;a<regions.length;a++)for(let b=a+1;b<regions.length;b++){
    const differences=regions[a].tiles.filter((t,i)=>t!==regions[b].tiles[i]).length;
    assert.ok(differences>250,'Each scene needs substantially different geometry, not a palette or name swap.');
  }
  assert.equal(new Set(regions.map(r=>{const o=r.objects!.find(x=>x.role==='guide')!;return o.x+','+o.y;})).size,5);
  const[ town,forest,river,coast,ruins ]=regions;
  assert.equal(town.scenes!.length,2);assert.ok(forest.tiles.filter(t=>t===2).length>300);
  assert.ok(river.tiles.filter(t=>t===4).length>60);assert.ok(river.tiles.includes(7));
  assert.ok(coast.tiles.filter(t=>t===4).length>200);assert.ok(coast.tiles.filter(t=>t===7).length>70);
  assert.ok(ruins.tiles.filter(t=>t===8).length>90);
});

test('all visible building doors are real, walls block movement, and interior arrivals/exits are safe',()=>{
  for(const [x,y]of coordinates){const region=compileRegion(x,y,seed);
    for(const building of region.objects!.filter(o=>o.kind==='building')){
      assert.equal(building.solid,false);const doors=region.objects!.filter(o=>o.kind==='door'&&o.x>=building.x&&o.x<building.x+building.width!&&o.y>=building.y&&o.y<building.y+building.height!);
      assert.ok(doors.length>0,'A visible house must not have a decorative unusable door.');
      for(let yy=building.y;yy<building.y+building.height!;yy++)for(let xx=building.x;xx<building.x+building.width!;xx++){
        const isDoor=doors.some(d=>d.x===xx&&d.y===yy);assert.equal(region.tiles[yy*WIDTH+xx],isDoor?1:6);assert.equal(solidAt(region,xx,yy),!isDoor);
      }
      for(const door of doors){const inside=getScene(region,door.targetScene);assert.equal(inside.theme,'interior');assert.ok(!solidAt(inside,door.arrival!.x,door.arrival!.y));
        const exit=inside.objects!.find(o=>o.kind==='door'&&o.targetScene==='outdoor')!;assert.ok(exit);assert.deepEqual(exit.arrival,{x:door.x,y:door.y+1});assert.ok(!solidAt(region,exit.arrival!.x,exit.arrival!.y));
        assert.ok(inside.objects!.some(o=>o.role==='healer'));assert.ok(inside.objects!.some(o=>o.id==='room-pc'));
      }
    }
  }
});

test('feature proposals preserve entrances, interactable access, safe spawns, and deterministic layout hashes',()=>{
  const features:MapFeature[]=[{kind:'pond',x:13,y:8,width:6,height:4},{kind:'trees',x:15,y:16,width:6,height:4},{kind:'stones',x:3,y:4,width:6,height:4},{kind:'trees',x:23,y:7,width:6,height:4},{kind:'pond',x:9,y:13,width:6,height:4}];
  for(let i=0;i<80;i++){
    const x=i%13-6,y=Math.floor(i/13)-3,story={...fallbackStory(x,y,seed),features};
    const r=compileRegion(x,y,seed,story);assert.doesNotThrow(()=>validateRegion(r));assert.equal(compileRegion(x,y,seed,story).hash,r.hash);
    for(const index of[16,(HEIGHT-1)*WIDTH+16,12*WIDTH,12*WIDTH+WIDTH-1])assert.equal(r.tiles[index],1);
  }
});

test('legacy layout migration backs up the original save and preserves progress, story, receipts, and NPC memory',()=>{
  const store=fresh();try{
    store.setMeta('seed',seed);const old=legacyRegion(0,0);old.source='codex';old.name='An established model-authored town';old.hook='An established promise must survive the layout upgrade.';store.saveRegion(old);
    const before=player();store.addPlayer(before,'private-browser-token');store.saveNpc(old.id,{visits:{[before.id]:4},memories:['Ari kept a promise.'],mood:'rest',intention:'Remember the old promise.',revision:8});store.receipt(before.id,'accepted-action',{text:'Already granted'});store.event(before.id,old.id,'capture','Ari caught a Squirtle.');
    const result=upgradeLegacyLayouts(store);assert.equal(result.upgraded,1);assert.equal(result.movedPlayers,1);assert.ok(existsSync(result.backupPath!));
    const after=store.player(before.id)!;assert.ok(!solidAt(store.region(old.id)!,after.x,after.y));
    assert.deepEqual({...after,x:before.x,y:before.y},before);assert.equal(store.byToken('private-browser-token')!.id,before.id);
    const updated=store.region(old.id)!;assert.equal(updated.name,old.name);assert.equal(updated.hook,old.hook);assert.equal(updated.source,'codex');assert.equal(updated.published,true);assert.notEqual(updated.hash,old.hash);
    assert.equal(store.npc(old.id).memories[0],'Ari kept a promise.');assert.deepEqual(store.receiptResult(before.id,'accepted-action'),{text:'Already granted'});assert.equal(store.events().length,1);
    const backup=new DatabaseSync(result.backupPath!,{readOnly:true});try{const saved=JSON.parse(String(backup.prepare('SELECT data FROM players WHERE id=?').get(before.id)!.data));assert.deepEqual(saved,before);assert.equal(JSON.parse(String(backup.prepare('SELECT data FROM regions WHERE id=?').get(old.id)!.data)).hash,old.hash);}finally{backup.close();}
    const count=readdirSync(join(store.root,'backups')).length;assert.deepEqual(upgradeLegacyLayouts(store),{upgraded:0,movedPlayers:0});assert.equal(readdirSync(join(store.root,'backups')).length,count);
  }finally{store.close();}
});

test('preview pack version two installs exactly five regions and upgrades v1 without resetting the trainer',()=>{
  const pack=JSON.parse(readFileSync(resolve('game/content/tutorial-world.json'),'utf8'));assert.equal(pack.version,2);assert.equal(pack.regions.length,5);
  const freshStore=fresh();try{loadPreviewPack(freshStore);assert.equal(freshStore.regions().length,5);assert.equal(freshStore.meta('previewPackVersion'),'2');for(const r of freshStore.regions()){assert.equal(r.source,'authored');assert.equal(r.published,true);assert.doesNotThrow(()=>validateRegion(r));}}finally{freshStore.close();}
  const store=fresh();try{
    store.setMeta('seed',seed);store.setMeta('previewPackVersion','1');store.setMeta('previewPromoted','false');store.setMeta('sessionMode','singleplayer');
    for(const[x,y]of coordinates)store.saveRegion(legacyRegion(x,y));const before=player();store.addPlayer(before,'preview-browser-token');loadPreviewPack(store);
    assert.equal(store.meta('previewPackVersion'),'2');assert.equal(store.meta('previewPromoted'),'false');assert.equal(store.regions().length,5);assert.deepEqual(new Set(store.regions().map(r=>r.id)),PREVIEW_REGION_IDS);
    assert.deepEqual(store.player(before.id)!.party,before.party);assert.equal(store.player(before.id)!.tutorial,3);assert.equal(store.player(before.id)!.coins,287);assert.ok(store.meta('lastLayoutMigrationBackup'));
    const files=readdirSync(join(store.root,'backups'));loadPreviewPack(store);assert.deepEqual(readdirSync(join(store.root,'backups')),files);
  }finally{store.close();}
});
