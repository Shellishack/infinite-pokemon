import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SFX_CUES} from '../game/shared/sfx.js';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {standFacing} from './game-helpers.js';
test('all registered effects have valid short unclipped WAV recordings',()=>{
 const manifest=JSON.parse(readFileSync('game/assets/audio/sfx/manifest.json','utf8'));assert.deepEqual(manifest.effects.map((effect:any)=>effect.id),[...SFX_CUES]);
 for(const effect of manifest.effects){const wav=readFileSync(resolve('game/assets/audio/sfx',effect.file));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),22050);assert.equal(wav.readUInt16LE(34),16);assert.ok(effect.durationSeconds>.03&&effect.durationSeconds<2);let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)/32768));assert.ok(peak>.05&&peak<.66);assert.equal(wav.readInt16LE(44),0);assert.equal(wav.readInt16LE(wav.length-2),0);}
});
test('successful actions return semantic effects and receipts preserve the same result',()=>{
 const store=new Store(resolve('.test-data','sfx-'+randomUUID())),world=new World(store);let now=100000;world.now=()=>now;
 try{world.warmStart();const p=world.createPlayer('Listener').player;world.apply(p.id,randomUUID(),{kind:'intro'});assert.ok(world.apply(p.id,randomUUID(),{kind:'starter',species:'bulbasaur'}).sounds?.includes('send-out'));
  const saveId=randomUUID(),saved=world.apply(p.id,saveId,{kind:'save'});assert.deepEqual(saved.sounds,['save']);assert.deepEqual(world.apply(p.id,saveId,{kind:'save'}),saved);
  standFacing(world,p.id,'guide');const bump=world.apply(p.id,randomUUID(),{kind:'move',direction:store.player(p.id)!.facing});assert.deepEqual(bump.sounds,['bump']);
  now+=1000;assert.ok(world.apply(p.id,randomUUID(),{kind:'heal'}).sounds?.includes('heal'));
  const rejected=randomUUID();assert.throws(()=>world.apply(p.id,rejected,{kind:'buyItem',itemId:'potion',quantity:1}));assert.equal(store.receiptResult(p.id,rejected),undefined);
 }finally{store.close();}
});
