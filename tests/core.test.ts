import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Store } from '../game/server/store.js';
import { World } from '../game/engine/world.js';
import { compileRegion, validateRegion } from '../game/engine/maps.js';
import { WIDTH,HEIGHT,type Action,type Player } from '../game/shared/model.js';
import { command,visit,travel,standFacing } from './game-helpers.js';

function fixture(){const root=resolve('.test-data',randomUUID());const store=new Store(root);const world=new World(store);world.warmStart();const {player}=world.createPlayer('Ash');return{store,world,pid:player.id,root};}
function nextSouth(world:World,pid:string){travel(world,pid,'south');}
function win(world:World,pid:string){for(let i=0;i<50&&!world.store.player(pid)!.battle!.finished;i++)command(world,pid,{kind:'battle',action:'attack'});assert.equal(world.store.player(pid)!.battle!.won,true);command(world,pid,{kind:'battle',action:'close'});}

test('500 generated maps preserve four reciprocal entrances and reachable interaction anchors',()=>{for(let i=0;i<500;i++){const r=compileRegion(i%25-12,Math.floor(i/25)-10,'property-'+i);const result=validateRegion(r);assert.ok(result.reachable>100);assert.equal(r.tiles[16],1);assert.equal(r.tiles[(HEIGHT-1)*WIDTH+16],1);assert.equal(r.tiles[12*WIDTH],1);assert.equal(r.tiles[12*WIDTH+WIDTH-1],1);}});

test('the complete ordered tutorial follows four consecutive southward maps',()=>{
  const {world,store,pid}=fixture();try{
    command(world,pid,{kind:'intro'});command(world,pid,{kind:'starter',species:'bulbasaur'});visit(world,pid);command(world,pid,{kind:'talk'});assert.equal(store.player(pid)!.tutorial,1);
    nextSouth(world,pid);assert.equal(store.player(pid)!.regionId,'0,1');command(world,pid,{kind:'encounter'});win(world,pid);assert.equal(store.player(pid)!.tutorial,2);
    nextSouth(world,pid);command(world,pid,{kind:'talk'});command(world,pid,{kind:'encounter'});
    while(store.player(pid)!.battle!.enemy.hp>store.player(pid)!.battle!.enemy.maxHp*.6)command(world,pid,{kind:'battle',action:'attack'});
    const captureId=randomUUID();world.apply(pid,captureId,{kind:'battle',action:'capture'});const caught=store.player(pid)!;world.apply(pid,captureId,{kind:'battle',action:'capture'});assert.equal(store.player(pid)!.party.length,caught.party.length);assert.equal(caught.tutorial,3);command(world,pid,{kind:'battle',action:'close'});
    nextSouth(world,pid);command(world,pid,{kind:'heal'});command(world,pid,{kind:'switch',index:1});assert.equal(store.player(pid)!.tutorial,4);
    nextSouth(world,pid);visit(world,pid,'trainer');command(world,pid,{kind:'trainer'});win(world,pid);visit(world,pid);command(world,pid,{kind:'choice',choice:'protect'});
    assert.equal(store.player(pid)!.tutorial,5);assert.equal(store.player(pid)!.regionId,'0,4');assert.equal(store.meta('choice'),'protect');assert.equal(store.events(100).filter(e=>e.kind==='tutorial').length,5);
  }finally{store.close();}
});

test('failed and duplicate commands do not duplicate state; terrain cannot be walked through',()=>{
  const {world,store,pid}=fixture();try{assert.throws(()=>command(world,pid,{kind:'starter',species:'squirtle'}));command(world,pid,{kind:'intro'});const id=randomUUID();world.apply(pid,id,{kind:'starter',species:'squirtle'});world.apply(pid,id,{kind:'starter',species:'squirtle'});assert.equal(store.player(pid)!.party.length,1);assert.throws(()=>command(world,pid,{kind:'choice',choice:'explore'}));assert.equal(store.meta('choice'),null);
    const p=standFacing(world,pid,'guide');const blocked=command(world,pid,{kind:'move',direction:p.facing});assert.equal(blocked.movement?.accepted,false);assert.equal(store.player(pid)!.x,p.x);assert.equal(store.player(pid)!.y,p.y);
  }finally{store.close();}
});

test('shared choices are canonical while newcomer tutorial state stays personal',()=>{
  const {world,store,pid}=fixture();try{const {player:b}=world.createPlayer('Misty');for(const id of[pid,b.id]){const p=store.player(id)!;p.introDone=true;p.tutorial=4;p.tutorialFlags=['trainerWon'];p.lessonRegion=p.regionId;store.savePlayer(p);standFacing(world,id,'guide');}
    command(world,pid,{kind:'choice',choice:'protect'});command(world,b.id,{kind:'choice',choice:'explore'});assert.equal(store.meta('choice'),'protect');assert.equal(store.player(b.id)!.choice,'explore');const c=world.createPlayer('Brock').player;assert.equal(c.tutorial,0);assert.equal(store.player(pid)!.tutorial,5);
  }finally{store.close();}
});

test('a cooperative guardian resolves shared rounds and grants each participant once',()=>{
  const {world,store,pid}=fixture();try{const other=world.createPlayer('Misty').player;
    for(const id of[pid,other.id]){const p=store.player(id)!;Object.assign(p,{tutorial:5,introDone:true,party:[world.makeCreature('bulbasaur',12)]});store.savePlayer(p);standFacing(world,id,'waystone');world.online.add(id);command(world,id,{kind:'coop'});}
    for(let n=0;n<15&&!store.player(pid)!.battle!.finished;n++){command(world,pid,{kind:'battle',action:'special'});command(world,other.id,{kind:'battle',action:'special'});}
    assert.equal(store.player(pid)!.battle!.won,true);assert.equal(store.player(other.id)!.battle!.won,true);assert.equal(store.player(pid)!.coins,220);assert.equal(store.player(other.id)!.coins,220);
  }finally{store.close();}
});

test('context files distinguish planned maps from history, and backups restore canonical saves',async()=>{
  const {world,store,pid,root}=fixture();command(world,pid,{kind:'intro'});command(world,pid,{kind:'starter',species:'charmander'});
  const snap=store.snapshot(store.region('0,1')!);const manifest=JSON.parse(readFileSync(snap.path,'utf8'));assert.equal(manifest.sourceEventSeq,store.sequence());const maps=JSON.parse(readFileSync(join(snap.path,'..','maps.json'),'utf8'));assert.equal(maps.find((r:any)=>r.id==='0,1').status,'planned');assert.equal(maps.find((r:any)=>r.id==='0,0').status,'observed');
  const backup=join(root,'backup.sqlite');await store.backupTo(backup);store.close();const restoredRoot=join(root,'restored');mkdirSync(restoredRoot);copyFileSync(backup,join(restoredRoot,'world.sqlite'));const restored=new Store(restoredRoot);assert.equal(restored.player(pid)!.party[0].species,'charmander');assert.equal(restored.regions().length,5);restored.close();
});
