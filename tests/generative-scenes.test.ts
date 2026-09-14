import {SaveLibrary} from '../game/server/saves.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {compileRegion,fallbackStory,validateRegion} from '../game/engine/maps.js';
import {getScene,solidAt} from '../game/shared/scene.js';
import {DIRECTIONS,type GenerationStatus} from '../game/shared/model.js';
import type {InteriorDesign,NpcBehavior} from '../game/shared/world-design.js';
const wandering:NpcBehavior={movement:'wander',radius:2,intervalSeconds:2,waypoints:[]};
const design:InteriorDesign={sceneId:'sanctuary',name:'Mosslight Reading House',furniture:[{kind:'bookcase',name:'Trail records',text:'Notes record the routes taken by local travelers.',x:10,y:8,width:2,height:3},{kind:'table',name:'Reading desk',text:'A lantern illuminates a map of the valley.',x:14,y:7,width:4,height:1},{kind:'bed',name:'Traveler cot',text:'Fresh linen waits for a weary companion.',x:20,y:12,width:2,height:2}],rugs:[{x:14,y:12,width:3,height:4}]};
const status:GenerationStatus={state:'ready',message:'fixture',queued:0,completed:0,failed:0,used:0,limit:0,mode:'test'};
test('generated interiors change layout and inspectable details while preserving working services and door links',()=>{
  const original=compileRegion(0,0,'design'),region=compileRegion(0,0,'design',{...fallbackStory(0,0,'design'),interiors:[design]});validateRegion(region);
  const before=original.scenes![0],after=region.scenes![0];assert.equal(after.name,design.name);assert.notDeepEqual(after.tiles,before.tiles);assert.notEqual(region.hash,original.hash);
  assert.deepEqual(after.objects.filter(o=>o.kind!=='furniture'),before.objects.filter(o=>o.kind!=='furniture'));
  assert.equal(after.objects.filter(o=>o.kind==='furniture').length,3);assert.equal(solidAt(getScene(region,'sanctuary'),10,8),true);assert.equal(solidAt(getScene(region,'sanctuary'),14,13),false);
});
test('interior proposals reject overlaps, blocked exits, unknown rooms and moving service NPCs',()=>{
  const make=(interiors:InteriorDesign[])=>validateRegion(compileRegion(0,0,'design',{...fallbackStory(0,0,'design'),interiors}));
  assert.throws(()=>make([{...design,furniture:[{...design.furniture[0],x:18,y:10,width:1,height:1}]}]),/overlaps/);
  assert.throws(()=>make([{...design,furniture:[{...design.furniture[0],x:16,y:18,width:1,height:1}]}]),/Unreachable/);
  assert.throws(()=>compileRegion(1,0,'design',{...fallbackStory(1,0,'design'),interiors:[{...design,sceneId:'home'}]}),/Unknown/);
  assert.throws(()=>compileRegion(0,0,'design',{...fallbackStory(0,0,'design'),npcBehaviors:[{sceneId:'sanctuary',npcId:'healer',behavior:wandering}]}),/Service NPCs/);
});
test('NPC motion stays bounded and authoritative, reserves both step tiles, freezes near players, and persists separately from map geometry',()=>{
  const store=new Store(resolve('.test-data','actors-'+randomUUID())),world=new World(store);let now=100_000;world.now=()=>now;
  try{
    const region=compileRegion(0,0,'actors',{...fallbackStory(0,0,'actors'),npcBehaviors:[{sceneId:'outdoor',npcId:'guide',behavior:wandering}]});validateRegion(region);store.saveRegion(region);
    const p=world.createPlayer('Observer').player;p.x=16;p.y=20;p.introDone=true;store.savePlayer(p);world.apply(p.id,randomUUID(),{kind:'starter',species:'bulbasaur'});p.party=store.player(p.id)!.party;world.online.add(p.id);
    const home=region.objects!.find(o=>o.id==='guide')!;world.tick(now);const scene=world.view(p.id,status).region,npc=scene.objects!.find(o=>o.id==='guide')!;
    assert.notDeepEqual({x:npc.x,y:npc.y},{x:home.x,y:home.y});assert.ok(npc.motion);assert.equal(solidAt(scene,home.x,home.y),true);assert.equal(solidAt(scene,npc.x,npc.y),true);assert.equal(store.region(region.id)!.hash,region.hash);
    now+=321;assert.equal(solidAt(world.view(p.id,status).region,home.x,home.y),false);
    const direction=(Object.entries(DIRECTIONS) as [keyof typeof DIRECTIONS,readonly[number,number]][]).find(([,d])=>!solidAt(world.view(p.id,status).region,npc.x-d[0],npc.y-d[1]))!;
    p.x=npc.x-direction[1][0];p.y=npc.y-direction[1][1];p.facing=direction[0];store.savePlayer(p);
    const blocked=world.apply(p.id,randomUUID(),{kind:'move',direction:direction[0]});assert.equal(blocked.movement?.accepted,false);assert.equal(blocked.code,'MOVE_BLOCKED');
    const stationary={x:npc.x,y:npc.y};now+=10_000;world.tick(now);const paused=world.view(p.id,status).region.objects!.find(o=>o.id==='guide')!;assert.deepEqual({x:paused.x,y:paused.y},stationary);
    assert.equal(world.apply(p.id,randomUUID(),{kind:'interact'}).interaction?.id,'guide');
    const reloaded=new World(store);reloaded.now=()=>now;assert.deepEqual(reloaded.view(p.id,status).region.objects!.find(o=>o.id==='guide')!.motion,npc.motion);
    p.x=16;p.y=20;store.savePlayer(p);for(let i=0;i<30;i++){now+=3000;world.tick(now);const actor=world.view(p.id,status).region.objects!.find(o=>o.id==='guide')!;assert.ok(Math.abs(actor.x-home.x)+Math.abs(actor.y-home.y)<=2);}
    const library=new SaveLibrary(store.root);library.register(store,false);const checkpoint=library.save(store,'Before divergence',randomUUID()),branch=library.fork(checkpoint.id,'Other path');
    const beforePose=store.db.prepare('SELECT data FROM npc_motion').get()!.data;
    const branchStore=new Store(library.path(branch.directory));try{const fork=new World(branchStore);fork.online.add(p.id);fork.tick(now+10_000);assert.equal(store.db.prepare('SELECT data FROM npc_motion').get()!.data,beforePose);assert.notEqual(branchStore.db.prepare('SELECT data FROM npc_motion').get()!.data,beforePose);}finally{branchStore.close();library.close();}
  }finally{store.close();}
});


test('patrol follows bounded waypoints and a stationary override stops the same actor',()=>{
  const store=new Store(resolve('.test-data','patrol-'+randomUUID())),world=new World(store);let now=100_000;world.now=()=>now;
  try{
    const region=compileRegion(0,0,'patrol',{...fallbackStory(0,0,'patrol'),npcBehaviors:[{sceneId:'outdoor',npcId:'guide',behavior:{movement:'patrol',radius:2,intervalSeconds:2,waypoints:[{x:1,y:0},{x:0,y:0}]}}]});store.saveRegion(region);
    const p=world.createPlayer('Watcher').player;p.x=16;p.y=20;store.savePlayer(p);world.online.add(p.id);const home=region.objects!.find(o=>o.id==='guide')!;
    world.tick(now);let actor=world.view(p.id,status).region.objects!.find(o=>o.id==='guide')!;assert.equal(actor.x,home.x+1);assert.equal(actor.y,home.y);
    now+=3000;world.tick(now);actor=world.view(p.id,status).region.objects!.find(o=>o.id==='guide')!;assert.equal(actor.x,home.x);
    const memory=store.npc(region.id);memory.behavior={...wandering,movement:'stationary'};store.saveNpc(region.id,memory);const before=store.db.prepare('SELECT data FROM npc_motion').get()!.data;now+=10_000;world.tick(now);assert.equal(store.db.prepare('SELECT data FROM npc_motion').get()!.data,before);
  }finally{store.close();}
});
