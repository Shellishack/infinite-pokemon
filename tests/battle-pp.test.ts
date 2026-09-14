import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from '../game/server/store.js';
import { World } from '../game/engine/world.js';
import { ATTACK_PP,SPECIES } from '../game/shared/model.js';
import { command,standFacing } from './game-helpers.js';

function fixture(){const store=new Store(resolve('.test-data',randomUUID())),world=new World(store);world.warmStart();const p=world.createPlayer('Ash').player;Object.assign(p,{introDone:true,tutorial:5,party:[world.makeCreature('bulbasaur')]});store.savePlayer(p);standFacing(world,p.id,'trainer');return {store,world,pid:p.id};}

test('accepted moves consume persisted PP once; invalid and duplicate commands do not consume it again',()=>{
  const {store,world,pid}=fixture();try{
    command(world,pid,{kind:'trainer'});const before=store.player(pid)!.party[0].pp!;assert.deepEqual(before,{attack:ATTACK_PP,special:SPECIES.bulbasaur.specialPp});
    const id=randomUUID();world.apply(pid,id,{kind:'battle',action:'special'});assert.equal(store.player(pid)!.party[0].pp!.special,before.special-1);world.apply(pid,id,{kind:'battle',action:'special'});assert.equal(store.player(pid)!.party[0].pp!.special,before.special-1);
    const p=store.player(pid)!;p.party[0].pp={attack:0,special:2};store.savePlayer(p);const round=p.battle!.round,hp=p.battle!.enemy.hp;assert.throws(()=>command(world,pid,{kind:'battle',action:'attack'}),/no PP/);assert.equal(store.player(pid)!.battle!.round,round);assert.equal(store.player(pid)!.battle!.enemy.hp,hp);assert.deepEqual(store.player(pid)!.party[0].pp,{attack:0,special:2});
  }finally{store.close();}
});

test('legacy creatures gain PP on battle use, Struggle remains possible when both moves are exhausted, and rest restores PP',()=>{
  const {store,world,pid}=fixture();try{
    let p=store.player(pid)!;delete p.party[0].pp;store.savePlayer(p);command(world,pid,{kind:'trainer'});assert.deepEqual(store.player(pid)!.party[0].pp,{attack:35,special:25});
    p=store.player(pid)!;p.party[0].pp={attack:0,special:0};store.savePlayer(p);const hp=p.party[0].hp;command(world,pid,{kind:'battle',action:'attack'});p=store.player(pid)!;
    assert.ok(p.battle!.log.some(line=>line.includes('used Struggle!')));assert.ok(p.battle!.log.some(line=>line.includes('recoil damage.')));assert.ok(p.party[0].hp<hp);assert.deepEqual(p.party[0].pp,{attack:0,special:0});
    p.battle=null;store.savePlayer(p);standFacing(world,pid,'guide');command(world,pid,{kind:'heal'});assert.equal(store.player(pid)!.party[0].hp,store.player(pid)!.party[0].maxHp);assert.deepEqual(store.player(pid)!.party[0].pp,{attack:35,special:25});
  }finally{store.close();}
});

test('co-op spends PP only when the submitted round resolves, including repeated vote changes',()=>{
  const {store,world,pid}=fixture();try{
    const other=world.createPlayer('Misty').player;for(const id of [pid,other.id]){const p=store.player(id)!;Object.assign(p,{introDone:true,tutorial:5,party:[world.makeCreature('squirtle',12)]});store.savePlayer(p);standFacing(world,id,'waystone');world.online.add(id);command(world,id,{kind:'coop'});}
    command(world,pid,{kind:'battle',action:'attack'});command(world,pid,{kind:'battle',action:'special'});assert.deepEqual(store.player(pid)!.party[0].pp,{attack:35,special:25});command(world,other.id,{kind:'battle',action:'attack'});
    assert.deepEqual(store.player(pid)!.party[0].pp,{attack:35,special:24});assert.deepEqual(store.player(other.id)!.party[0].pp,{attack:34,special:25});
  }finally{store.close();}
});
