import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from '../game/server/store.js';
import { World } from '../game/engine/world.js';
import type { Action, GenerationStatus, Player } from '../game/shared/model.js';
import {command,standFacing} from './game-helpers.js';

function fixture(){
  const root=resolve('.test-data',randomUUID()),store=new Store(root),world=new World(store);
  world.warmStart();const {player}=world.createPlayer('Ash');return {root,store,world,pid:player.id};
}
function graduate(world:World,pid:string){
  const p=world.store.player(pid)!;Object.assign(p,{tutorial:5,introDone:true,party:[world.makeCreature('bulbasaur',12)]});
  world.store.savePlayer(p);world.online.add(pid);return standFacing(world,pid,'waystone');
}
function group(world:World,pid:string){
  const other=world.createPlayer('Misty').player;for(const id of [pid,other.id]){graduate(world,id);command(world,id,{kind:'coop'});}return other.id;
}

test('durable retries return the original response after restarting without repeating rewards',()=>{
  const {root,store,world,pid}=fixture();command(world,pid,{kind:'intro'});
  const id=randomUUID(),result=world.apply(pid,id,{kind:'starter',species:'squirtle'}),seq=store.sequence();store.close();
  const restored=new Store(root);try{const resumed=new World(restored);assert.deepEqual(resumed.apply(pid,id,{kind:'starter',species:'squirtle'}),result);assert.equal(restored.sequence(),seq);assert.equal(restored.player(pid)!.party.length,1);}finally{restored.close();}
});

test('existing receipt tables migrate without losing acknowledged commands',()=>{
  const {root,store,pid}=fixture(),id=randomUUID();store.db.exec('DROP TABLE receipts; CREATE TABLE receipts (player_id TEXT NOT NULL,command_id TEXT NOT NULL,PRIMARY KEY(player_id,command_id))');store.db.prepare('INSERT INTO receipts VALUES (?,?)').run(pid,id);store.close();
  const restored=new Store(root);try{assert.deepEqual(restored.receiptResult(pid,id),{});restored.receipt(pid,randomUUID(),{title:'Saved'});}finally{restored.close();}
});

test('guest state omits other trainers private NPC visits and memory',()=>{
  const {store,world,pid}=fixture();try{
    const other=world.createPlayer('Misty').player;store.saveNpc('0,0',{visits:{[pid]:2,[other.id]:17},memories:['Misty shared a private plan'],mood:'curious',intention:'Protect the Waystone',revision:1});
    const state=world.view(pid,{state:'ready',queued:0,completed:0,mode:'test'} as GenerationStatus);
    assert.deepEqual(state.npc.visits,{[pid]:2});assert.deepEqual(state.npc.memories,[]);assert.equal(store.npc('0,0').visits[other.id],17);
  }finally{store.close();}
});

test('a lone trainer can abandon a waiting guardian without earning rewards',()=>{
  const {store,world,pid}=fixture();try{
    graduate(world,pid);command(world,pid,{kind:'coop'});assert.throws(()=>command(world,pid,{kind:'battle',action:'attack'}),/second trainer/);
    assert.deepEqual(store.player(pid)!.battle!.actions,{});command(world,pid,{kind:'battle',action:'run'});assert.equal(store.player(pid)!.battle!.finished,true);assert.equal(store.player(pid)!.coins,100);
    command(world,pid,{kind:'battle',action:'close'});assert.equal(store.player(pid)!.battle,null);
  }finally{store.close();}
});

test('disconnect cancels a waiting group and allows another guardian to be started',()=>{
  const {store,world,pid}=fixture();try{
    const other=group(world,pid);command(world,pid,{kind:'battle',action:'attack'});world.disconnect(other);
    for(const id of [pid,other]){assert.equal(store.player(id)!.battle!.finished,true);assert.equal(store.player(id)!.coins,100);}
    assert.equal(world.online.has(other),false);command(world,pid,{kind:'battle',action:'close'});command(world,pid,{kind:'coop'});assert.equal(store.player(pid)!.battle!.finished,false);
  }finally{store.close();}
});

test('timed-out partners guard, shared rounds advance once, and fully idle groups leave peacefully',()=>{
  const {store,world,pid}=fixture();try{
    const other=group(world,pid),before=store.player(other)!.party[0].hp;command(world,pid,{kind:'battle',action:'attack'});
    const deadline=store.player(pid)!.battle!.roundStartedAt!+30_001;world.tick(deadline);
    const after=store.player(pid)!;assert.equal(after.battle!.round,1);assert.ok(after.battle!.enemy.hp<after.battle!.enemy.maxHp);assert.equal(store.player(other)!.party[0].hp,before-3);
    assert.deepEqual(after.battle,store.player(other)!.battle);world.tick(deadline);assert.equal(store.player(pid)!.battle!.round,1);
    world.tick(deadline+30_001);for(const id of [pid,other]){assert.equal(store.player(id)!.battle!.finished,true);assert.equal(store.player(id)!.coins,100);}
  }finally{store.close();}
});

test('a late join is rejected and active survivors can finish after a partner leaves',()=>{
  const {store,world,pid}=fixture();try{
    const other=group(world,pid);command(world,pid,{kind:'battle',action:'attack'});command(world,other,{kind:'battle',action:'attack'});
    const third=world.createPlayer('Brock').player;graduate(world,third.id);assert.throws(()=>command(world,third.id,{kind:'coop'}),/already begun/);
    world.disconnect(other);assert.equal(store.player(pid)!.battle!.finished,false);
    while(!store.player(pid)!.battle!.finished)command(world,pid,{kind:'battle',action:'special'});
    assert.equal(store.player(pid)!.coins,220);assert.equal(store.player(other)!.coins,100);
  }finally{store.close();}
});

test('server restart recovers an unfinished cooperative encounter without phantom rewards',()=>{
  const {root,store,world,pid}=fixture();const other=group(world,pid);store.close();const restored=new Store(root);try{
    new World(restored);for(const id of [pid,other]){assert.equal(restored.player(id)!.battle!.finished,true);assert.equal(restored.player(id)!.battle!.won,false);assert.equal(restored.player(id)!.coins,100);}
  }finally{restored.close();}
});

test('guardian entry rejects empty or exhausted teams',()=>{
  const {store,world,pid}=fixture();try{const p=graduate(world,pid);p.party[0].hp=0;store.savePlayer(p);assert.throws(()=>command(world,pid,{kind:'coop'}),/Heal/);p.party=[];store.savePlayer(p);assert.throws(()=>command(world,pid,{kind:'coop'}),/Heal/);}finally{store.close();}
});

test('sixth captures stay in the party and later captures move to server storage',()=>{
  const {store,world,pid}=fixture();try{
    const p=graduate(world,pid);Object.assign(p,{tutorial:2,lessonRegion:'0,0',party:Array.from({length:5},()=>world.makeCreature('squirtle'))});store.savePlayer(p);standFacing(world,pid,'guide');
    const catchOne=()=>{command(world,pid,{kind:'encounter'});const current=store.player(pid)!;current.battle!.enemy.hp=1;store.savePlayer(current);command(world,pid,{kind:'battle',action:'capture'});return store.player(pid)!;};
    let current=catchOne();assert.equal(current.party.length,6);assert.equal(current.storage.length,0);assert.match(current.battle!.log.at(-1)!,/joined your team/);
    command(world,pid,{kind:'battle',action:'close'});current=store.player(pid)!;current.tutorial=2;current.lessonRegion='0,0';store.savePlayer(current);current=catchOne();assert.equal(current.party.length,6);assert.equal(current.storage.length,1);assert.match(current.battle!.log.at(-1)!,/safely stored/);assert.equal(current.tutorial,3);
  }finally{store.close();}
});

test('a trainer battle cannot skip the wild-battle lesson',()=>{
  const {store,world,pid}=fixture();try{
    const p=graduate(world,pid);Object.assign(p,{tutorial:1,lessonRegion:'0,0'});store.savePlayer(p);standFacing(world,pid,'trainer');command(world,pid,{kind:'trainer'});
    while(!store.player(pid)!.battle!.finished)command(world,pid,{kind:'battle',action:'special'});assert.equal(store.player(pid)!.tutorial,1);
  }finally{store.close();}
});
