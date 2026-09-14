import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from '../game/server/store.js';
import { World,GameError } from '../game/engine/world.js';
import { WIDTH,HEIGHT,WALK_MS,type Player,type SceneObject,type GenerationStatus } from '../game/shared/model.js';
import { standFacing,command } from './game-helpers.js';

function fixture(){
  const store=new Store(resolve('.test-data',randomUUID())),world=new World(store);world.warmStart();
  const region=store.region('0,0')!;region.tiles=Array(WIDTH*HEIGHT).fill(1);region.tiles[6*WIDTH+14]=2;region.spawn={x:16,y:14};
  region.objects=[
    {id:'guide',kind:'npc',role:'guide',name:'Professor Fern',x:10,y:10,solid:true},
    {id:'trainer',kind:'npc',role:'trainer',name:'Trainer Juniper',x:20,y:10,solid:true},
    {id:'sign',kind:'sign',x:6,y:6,solid:true,text:'The north path leads home.'},
    {id:'fence',kind:'fence',x:7,y:6,width:2,solid:true},
    {id:'supply-item',kind:'item',x:9,y:6,solid:true,item:'potion'},
    {id:'healing-door',kind:'door',x:8,y:8,solid:false,targetScene:'sanctuary',arrival:{x:16,y:17},facing:'north'},
    {id:'waystone',kind:'waystone',x:18,y:15,solid:true,text:'The stone hums softly.'},
  ];
  const tiles=Array(WIDTH*HEIGHT).fill(1);for(let x=0;x<WIDTH;x++){tiles[x]=2;tiles[(HEIGHT-1)*WIDTH+x]=2;}for(let y=0;y<HEIGHT;y++){tiles[y*WIDTH]=2;tiles[y*WIDTH+WIDTH-1]=2;}
  region.scenes=[{id:'sanctuary',name:'Rest House',theme:'interior',spawn:{x:16,y:17},tiles,objects:[
    {id:'healer',kind:'npc',role:'healer',name:'Nurse Willow',x:16,y:6,solid:true},
    {id:'room-pc',kind:'furniture',x:18,y:6,solid:true,name:'Pokémon PC'},
    {id:'room-exit',kind:'door',x:16,y:18,solid:false,targetScene:'outdoor',arrival:{x:8,y:9},facing:'south'},
  ]}];store.saveRegion(region);
  const {player}=world.createPlayer('Ash');Object.assign(player,{introDone:true,tutorial:1,lessonRegion:'0,0',party:[world.makeCreature('bulbasaur')]});store.savePlayer(player);
  let now=1000;world.now=()=>now;return {store,world,pid:player.id,setTime:(time:number)=>{now=time;},position:(values:Partial<Player>)=>{const p=store.player(player.id)!;Object.assign(p,values);p.movement=undefined;world.lastMove.delete(p.id);store.savePlayer(p);return p;}};
}

test('server movement reserves160ms steps, acknowledges early rejection, schedules20ms tolerance, and rejects stale sequences',()=>{
  const {store,world,pid,setTime,position}=fixture();try{
    position({x:10,y:12,facing:'south'});const firstId=randomUUID(),first=world.apply(pid,firstId,{kind:'move',direction:'north',seq:1});assert.deepEqual(first.movement,{seq:1,fromX:10,fromY:12,toX:10,toY:11,startedAt:1000,duration:WALK_MS,accepted:true,regionId:'0,0',sceneId:undefined});
    assert.equal(store.player(pid)!.y,11);setTime(1100);const early=world.apply(pid,randomUUID(),{kind:'move',direction:'east',seq:2});assert.equal(early.code,'MOVE_TOO_FAST');assert.equal(early.movement!.accepted,false);assert.equal(early.movement!.seq,2);assert.equal(early.movement!.duration,0);assert.equal(early.movement!.toY,11);assert.equal(store.player(pid)!.facing,'east');assert.deepEqual(store.player(pid)!.movement,JSON.parse(JSON.stringify(first.movement)));
    setTime(1140);const queued=world.apply(pid,randomUUID(),{kind:'move',direction:'east',seq:3});assert.equal(queued.movement!.accepted,true);assert.equal(queued.movement!.startedAt,1160);assert.equal(queued.movement!.duration,160);assert.equal(store.player(pid)!.x,11);
    assert.throws(()=>world.apply(pid,randomUUID(),{kind:'interact'}),(error:unknown)=>error instanceof GameError&&error.code==='MOVEMENT_PENDING');
    setTime(1400);const stale=world.apply(pid,randomUUID(),{kind:'move',direction:'west',seq:2});assert.equal(stale.code,'STALE_MOVE');assert.equal(stale.movement!.toX,11);assert.equal(store.player(pid)!.x,11);assert.equal(store.player(pid)!.movement!.seq,3);assert.equal(store.player(pid)!.facing,'east');
    assert.deepEqual(world.apply(pid,firstId,{kind:'move',direction:'north',seq:1}),JSON.parse(JSON.stringify(first)));assert.equal(store.player(pid)!.x,11);
  }finally{store.close();}
});

test('NPCs, signs, fences, and solid terrain block movement while the requested facing persists',()=>{
  const {store,world,pid,position}=fixture();try{
    for(const target of ['guide','sign','fence']){const p=standFacing(world,pid,target),facing=p.facing;const blocked=command(world,pid,{kind:'move',direction:facing});assert.equal(blocked.code,'MOVE_BLOCKED');assert.equal(blocked.movement!.accepted,false);assert.equal(store.player(pid)!.x,p.x);assert.equal(store.player(pid)!.y,p.y);assert.equal(store.player(pid)!.facing,facing);}
    position({x:13,y:6,facing:'north'});const tree=command(world,pid,{kind:'move',direction:'east'});assert.equal(tree.movement!.accepted,false);assert.equal(store.player(pid)!.facing,'east');assert.equal(store.player(pid)!.x,13);
  }finally{store.close();}
});

test('talk and interaction require the immediately adjacent cell in the facing direction',()=>{
  const {store,world,pid,position}=fixture();try{
    position({x:10,y:12,facing:'north'});assert.throws(()=>command(world,pid,{kind:'talk'}),/Face something next/);
    position({x:9,y:10,facing:'north'});assert.throws(()=>command(world,pid,{kind:'interact'}),/Face something next/);
    position({x:9,y:10,facing:'east'});const dialogue=command(world,pid,{kind:'talk'});assert.equal(dialogue.interaction!.role,'guide');assert.equal(store.player(pid)!.x,9);assert.equal(store.npc('0,0').visits[pid],1);
    position({x:6,y:7,facing:'north'});assert.equal(command(world,pid,{kind:'talk'}).text,'The north path leads home.');assert.equal(store.npc('0,0').visits[pid],1);
    assert.throws(()=>command(world,pid,{kind:'heal'}),/Face your guide/);assert.throws(()=>command(world,pid,{kind:'trainer'}),/face them/);
  }finally{store.close();}
});

test('walking onto a door enters an embedded scene, nurse and PC work, and exiting does not bounce back indoors',()=>{
  const {store,world,pid,position}=fixture();try{
    position({x:8,y:9,facing:'north',tutorial:3,tutorialFlags:['switched']});const entered=command(world,pid,{kind:'move',direction:'north'});assert.equal(entered.movement!.duration,0);assert.equal(entered.movement!.sceneId,'sanctuary');assert.equal(entered.movement!.regionId,'0,0');
    let p=store.player(pid)!;assert.equal(p.sceneId,'sanctuary');assert.deepEqual(p.returnPosition,{x:8,y:9});assert.equal(p.lessonRegion,'0,0');assert.equal(p.x,16);assert.equal(p.y,17);assert.equal(p.facing,'north');assert.equal(store.regions().length,5);
    command(world,pid,{kind:'move',direction:'north'});assert.equal(store.player(pid)!.sceneId,'sanctuary');
    standFacing(world,pid,'healer');p=store.player(pid)!;p.party[0].hp=1;store.savePlayer(p);command(world,pid,{kind:'interact'});assert.equal(store.player(pid)!.party[0].hp,store.player(pid)!.party[0].maxHp);assert.equal(store.player(pid)!.tutorial,4);
    standFacing(world,pid,'room-pc');assert.match(command(world,pid,{kind:'interact'}).text!,/PC is ready/);
    standFacing(world,pid,'room-exit');const outside=command(world,pid,{kind:'interact'});assert.equal(outside.movement!.duration,0);assert.equal(outside.movement!.sceneId,undefined);p=store.player(pid)!;assert.equal(p.sceneId,undefined);assert.equal(p.x,8);assert.equal(p.y,9);assert.equal(p.facing,'south');assert.equal(p.returnPosition,undefined);
    command(world,pid,{kind:'move',direction:'south'});assert.equal(store.player(pid)!.sceneId,undefined);assert.equal(store.player(pid)!.y,10);assert.equal(store.regions().length,5);
  }finally{store.close();}
});

test('facing-door interaction enters, room borders cannot allocate outdoor maps, and player visibility follows scenes',()=>{
  const {store,world,pid,position}=fixture();try{
    position({x:8,y:9,facing:'north'});const entered=command(world,pid,{kind:'interact'});assert.equal(entered.movement!.sceneId,'sanctuary');const other=world.createPlayer('Misty').player;world.online.add(pid);world.online.add(other.id);
    const generation={state:'ready',queued:0,completed:0,mode:'test'} as GenerationStatus;let inside=world.view(pid,generation);assert.equal(inside.region.sceneId,'sanctuary');assert.equal(inside.players.length,1);assert.equal(inside.players[0].id,pid);assert.equal(world.view(other.id,generation).players.length,1);assert.equal(inside.serverTime,world.now());
    position({x:1,y:1,sceneId:'sanctuary',facing:'north'});const wall=command(world,pid,{kind:'move',direction:'north'});assert.equal(wall.code,'MOVE_BLOCKED');assert.equal(store.regions().length,5);
    position({x:1,y:0,sceneId:'sanctuary',facing:'north'});const edge=command(world,pid,{kind:'move',direction:'north'});assert.equal(edge.code,'ROOM_BOUNDARY');assert.equal(store.regions().length,5);assert.equal(store.player(pid)!.regionId,'0,0');
  }finally{store.close();}
});

test('collectible items grant once and stop blocking their owner',()=>{
  const {store,world,pid}=fixture();try{
    const before=standFacing(world,pid,'supply-item'),id=randomUUID(),result=world.apply(pid,id,{kind:'interact'});assert.match(result.text!,/Potion/);assert.equal(store.player(pid)!.potions,before.potions+1);assert.deepEqual(store.player(pid)!.collectedItems,['0,0:outdoor:supply-item']);
    world.apply(pid,id,{kind:'interact'});assert.equal(store.player(pid)!.potions,before.potions+1);assert.throws(()=>command(world,pid,{kind:'interact'}),/Face something/);
    const step=command(world,pid,{kind:'move',direction:before.facing});assert.equal(step.movement!.accepted,true);assert.equal(store.player(pid)!.x,9);assert.equal(store.player(pid)!.y,6);
  }finally{store.close();}
});

test('defeat respawns at the map spawn with authoritative warp feedback and actual battle item logs',()=>{
  const {store,world,pid}=fixture();try{
    standFacing(world,pid,'trainer');command(world,pid,{kind:'trainer'});let p=store.player(pid)!;p.party[0].hp=1;store.savePlayer(p);const defeated=command(world,pid,{kind:'battle',action:'attack'});
    p=store.player(pid)!;assert.equal(p.battle!.finished,true);assert.equal(p.battle!.won,false);assert.equal(p.x,16);assert.equal(p.y,14);assert.equal(defeated.movement!.duration,0);assert.equal(defeated.movement!.accepted,true);assert.equal(defeated.movement!.regionId,'0,0');
    command(world,pid,{kind:'battle',action:'close'});standFacing(world,pid,'trainer');command(world,pid,{kind:'trainer'});p=store.player(pid)!;p.party[0].hp-=10;store.savePlayer(p);command(world,pid,{kind:'potion'});assert.ok(store.player(pid)!.battle!.log.some(line=>line.includes('recovered 10 HP')));
  }finally{store.close();}
});
