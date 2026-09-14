import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

test('the original soundtrack contains valid unclipped PCM audio with quiet loop boundaries',()=>{
 const manifest=JSON.parse(readFileSync(resolve('game/assets/audio/soundtrack.json'),'utf8'));assert.equal(manifest.tracks.length,12);
 for(const track of manifest.tracks){const wav=readFileSync(resolve('game/assets/audio',track.file));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt32LE(24),22050);assert.equal(wav.readUInt16LE(34),16);assert.equal(wav.readUInt32LE(40),wav.length-44);assert.ok(track.durationSeconds>7);let peak=0,sum=0;for(let i=44;i<wav.length;i+=2){const sample=wav.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}assert.ok(peak<.79&&peak>.7);assert.ok(Math.sqrt(sum/((wav.length-44)/2))>.1);assert.ok(Math.abs(wav.readInt16LE(44))<20);assert.ok(Math.abs(wav.readInt16LE(wav.length-2))<20);}
});
import {musicTheme,ambientMusicTheme} from '../game/client/MusicControls.js';
import type {GameState} from '../game/shared/model.js';

test('scenario selection prioritizes battles and services, and selects biome ambience for victory return',()=>{
 const state={me:{introDone:true,party:[{}],battle:null},region:{id:'1,1',biome:'meadow'}} as unknown as GameState;
 assert.equal(musicTheme(null),'title');assert.equal(musicTheme(state),'exploration');
 for(const biome of ['forest','coast','ruins'] as const){state.region.biome=biome;assert.equal(musicTheme(state),biome);}
 state.region.id='0,0';assert.equal(musicTheme(state),'town');state.region.theme='interior';assert.equal(musicTheme(state),'interior');assert.equal(musicTheme(state,'shop'),'shop');
 for(const [kind,track] of [['wild','battle'],['training','battle'],['trainer','trainer-battle'],['coop','guardian-battle']] as const){state.me.battle={kind,finished:false} as GameState['me']['battle'];assert.equal(musicTheme(state,'shop'),track);}
 state.me.battle!.finished=true;state.me.battle!.won=true;assert.equal(musicTheme(state),'victory');assert.equal(ambientMusicTheme(state),'interior');
});
