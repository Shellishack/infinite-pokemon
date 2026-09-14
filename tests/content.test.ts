import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {compileRegion,fallbackStory} from '../game/engine/maps.js';
import {SaveLibrary} from '../game/server/saves.js';
import {creatureBlueprintSchema,itemBlueprintSchema,vehicleBlueprintSchema,EXTRA_CREATURES,ITEMS} from '../game/shared/content.js';
import {ATTACK_PP,creatureInfo,creatureKey,damage,type Action} from '../game/shared/model.js';
import {standFacing,command} from './game-helpers.js';
import {TileMotion} from '../game/client/movement.js';

function fixture(){const store=new Store(resolve('.test-data','content-'+randomUUID())),world=new World(store);world.warmStart();const {player}=world.createPlayer('Trainer');store.setMeta('hostPlayerId',player.id);command(world,player.id,{kind:'intro'});command(world,player.id,{kind:'starter',species:'bulbasaur'});const p=store.player(player.id)!;p.coins=3000;store.savePlayer(p);return {store,world,pid:p.id};}
function service(world:World,pid:string,id:string){const p=world.store.player(pid)!;p.sceneId='sanctuary';p.x=16;p.y=17;delete p.movement;world.store.savePlayer(p);return standFacing(world,pid,id);}
test('shops use server prices, validate service proximity and inventory, and deduplicate purchases',()=>{
  const {store,world,pid}=fixture();try{
    assert.throws(()=>command(world,pid,{kind:'buyItem',itemId:'super-potion',quantity:1}),/shopkeeper/);
    service(world,pid,'room-shop');const price=world.content.shop(store.region('0,0')!).find(i=>i.id==='super-potion')!.price,coins=store.player(pid)!.coins,id=randomUUID();
    world.apply(pid,id,{kind:'buyItem',itemId:'super-potion',quantity:2});world.apply(pid,id,{kind:'buyItem',itemId:'super-potion',quantity:2});assert.equal(store.player(pid)!.coins,coins-price*2);assert.equal(store.player(pid)!.items!['super-potion'],2);
    const before=store.player(pid)!;assert.throws(()=>world.apply(pid,randomUUID(),{kind:'buyItem',itemId:'super-potion',quantity:-1} as Action),/between/);assert.equal(store.player(pid)!.coins,before.coins);
    before.coins=0;store.savePlayer(before);assert.throws(()=>command(world,pid,{kind:'buyItem',itemId:'ether',quantity:1}),/enough coins/);assert.equal(store.player(pid)!.items!.ether,undefined);
  }finally{store.close();}
});
test('new items heal, restore PP, revive and repel; existing large potion stacks are not truncated by battle rewards',()=>{
  const {store,world,pid}=fixture();try{
    let p=store.player(pid)!;p.items={'super-potion':1,ether:1,revive:1,repel:1};p.party[0].hp=1;p.party[0].pp={attack:1,special:1};p.potions=75;store.savePlayer(p);
    command(world,pid,{kind:'useItem',itemId:'super-potion'});assert.equal(store.player(pid)!.party[0].hp,store.player(pid)!.party[0].maxHp);
    command(world,pid,{kind:'useItem',itemId:'ether'});assert.equal(store.player(pid)!.party[0].pp!.attack,11);
    p=store.player(pid)!;p.party[0].hp=0;store.savePlayer(p);command(world,pid,{kind:'useItem',itemId:'revive'});assert.equal(store.player(pid)!.party[0].hp,Math.floor(store.player(pid)!.party[0].maxHp*.5));
    command(world,pid,{kind:'useItem',itemId:'repel'});assert.equal(store.player(pid)!.repelSteps,100);
    p=store.player(pid)!;world.startBattle(p,'training');world.reward(p,p.battle!);assert.equal(p.potions,75);
  }finally{store.close();}
});
test('hybrid eggs preserve parents, inherit identity and traits, hatch once, and stay isolated in checkpoint branches',()=>{
  const {store,world,pid}=fixture();const library=new SaveLibrary(store.root);library.register(store,false);let branch:Store|undefined;
  try{
    const p=store.player(pid)!;p.party.push(world.makeCreature('squirtle'));store.savePlayer(p);service(world,pid,'room-nursery');const parents=store.player(pid)!.party,id=randomUUID(),before=store.player(pid)!.coins;
    assert.throws(()=>command(world,pid,{kind:'breed',parentA:parents[0].id,parentB:'not-owned'}),/belong/);
    world.apply(pid,id,{kind:'breed',parentA:parents[0].id,parentB:parents[1].id});world.apply(pid,id,{kind:'breed',parentA:parents[0].id,parentB:parents[1].id});let now=store.player(pid)!;assert.equal(now.coins,before-120);assert.equal(now.party.length,2);assert.deepEqual(now.egg!.profile.types,['grass','water']);assert.equal(now.egg!.profile.source,'hybrid');
    const checkpoint=library.save(store,'Egg waiting',randomUUID()),fork=library.fork(checkpoint.id,'Other hatch');branch=new Store(library.path(fork.directory));
    const eggId=now.egg!.id;now.steps=now.egg!.hatchAtStep;const baby=world.content.step(now)!;world.content.step(now);store.savePlayer(now);assert.equal(now.party.length,3);assert.equal(now.egg,undefined);assert.equal(baby.level,1);assert.equal(baby.parents!.length,2);assert.equal(now.stats!.captures,0);assert.equal(branch.player(pid)!.egg!.id,eggId);assert.equal(branch.player(pid)!.party.length,2);
    assert.ok(baby.traits!.length>=1);assert.equal(creatureKey(baby),baby.profile!.id);
  }finally{branch?.close();library.close();store.close();}
});
test('generated species, goods, and vehicle profiles extend a persistent catalog with bounded effects and safe artwork recipes',()=>{
  const {store,world}=fixture();try{
    const {id,source,...blueprint}=EXTRA_CREATURES[0];const novel={...blueprint,name:'Mist Sprite',art:{...blueprint.art,form:'sprite' as const}};
    const region=compileRegion(3,0,'catalog',{...fallbackStory(3,0,'catalog'),creatures:[novel],shopGoods:[{name:'Misty Tonic',description:'A tonic made from local valley herbs.',effect:'heal',tier:2,icon:'herb',color:'#77aa88'}],vehicles:[{name:'Reed Cart',description:'A quiet cart for the riverside roads.',form:'cart',color:'#99bb77',speedTier:2}]});store.saveRegion(region);const catalog=world.content.region(region),profile=catalog.creatures[0];
    const creature=world.content.make(profile.base,4,profile);assert.equal(creatureInfo(creature).name,'Mist Sprite');assert.equal(creatureInfo(creature).specialPp,20);assert.notEqual(creatureKey(creature),creature.species);assert.equal(catalog.items[0].power,50);assert.equal(catalog.vehicles[0].stepMs,90);assert.equal(world.content.item(catalog.items[0].id)!.name,'Misty Tonic');
    const duplicate=world.content.region({...region,id:'4,0',gx:4,hash:'different-block'});assert.equal(duplicate.creatures[0].id,profile.id);
    const alias=world.content.region({...region,id:'5,0',hash:'authored-alias',creatures:[{...blueprint,art:{...blueprint.art,primary:blueprint.art.primary.toUpperCase()}}]});assert.equal(alias.creatures[0].id,id);
    assert.equal(creatureBlueprintSchema.safeParse({...novel,art:{...novel.art,primary:'url(https://invalid)'}}).success,false);assert.equal(itemBlueprintSchema.safeParse({...region.shopGoods![0],price:0}).success,false);assert.equal(vehicleBlueprintSchema.safeParse({...region.vehicles![0],speedTier:99}).success,false);
    const saved=new Store(store.root);try{assert.equal(saved.definition<{name:string}>('creature',profile.id)!.name,'Mist Sprite');}finally{saved.close();}
  }finally{store.close();}
});

test('adding shelter services safely relocates an existing trainer whose tile gains a service NPC',()=>{
  const {store,world,pid}=fixture();try{
    const region=store.region('0,0')!;for(const scene of region.scenes??[])scene.objects=scene.objects.filter(object=>!['room-shop','room-nursery'].includes(object.id));store.saveRegion(region);
    const p=store.player(pid)!;p.sceneId='sanctuary';p.x=20;p.y=16;store.savePlayer(p);const upgraded=new World(store),current=store.player(pid)!;assert.ok(current.x!==20||current.y!==16);assert.equal(current.party.length,1);assert.equal(current.coins,3000);assert.ok(upgraded.content.view(current));
  }finally{store.close();}
});
test('leaderboards count successful captures and unique identities, distinct trainers, maps, and recorded tiles',()=>{
  const {store,world,pid}=fixture();try{
    let p=store.player(pid)!;p.tutorial=2;p.lessonRegion=p.regionId;store.savePlayer(p);
    for(let i=0;i<2;i++){p=store.player(pid)!;world.startBattle(p,'training');p.battle!.enemy.hp=1;p.tutorial=2;p.lessonRegion=p.regionId;store.savePlayer(p);const id=randomUUID();world.apply(pid,id,{kind:'battle',action:'capture'});world.apply(pid,id,{kind:'battle',action:'capture'});}
    p=store.player(pid)!;assert.equal(p.stats!.captures,2);assert.equal(p.stats!.caughtSpecies.length,1);p.battle=null;world.startBattle(p,'trainer');p.battle!.trainerId='0,0:trainer';world.reward(p,p.battle!);world.reward(p,p.battle!);assert.equal(p.stats!.defeatedTrainers.length,1);world.content.step(p);world.content.step(p);assert.equal(p.stats!.tiles,1);store.savePlayer(p);
    const entry=world.content.view(p).leaderboard.find(e=>e.id===pid)!;assert.equal(entry.captures,2);assert.equal(entry.species,1);assert.equal(entry.maps,1);assert.equal(entry.trainers,1);assert.equal(entry.tiles,1);
  }finally{store.close();}
});
test('owned vehicles accelerate authoritative and predicted movement without bypassing collision or indoor rules',()=>{
  const {store,world,pid}=fixture();try{
    service(world,pid,'room-shop');command(world,pid,{kind:'buyVehicle',vehicleId:'bicycle'});assert.throws(()=>command(world,pid,{kind:'ride',vehicleId:'bicycle'}),/outdoors/);
    const p=store.player(pid)!;delete p.sceneId;p.x=16;p.y=14;store.savePlayer(p);command(world,pid,{kind:'ride',vehicleId:'bicycle'});const result=command(world,pid,{kind:'move',direction:'east'});assert.equal(result.movement!.duration,110);assert.equal(world.stepDuration(store.player(pid)!),110);
    const motion=new TileMotion({x:0,y:0});motion.begin({x:1,y:0},0,true,110);assert.equal(motion.position(55).x,.5);
    const faced=standFacing(world,pid,'guide'),blocked=command(world,pid,{kind:'move',direction:faced.facing});assert.equal(blocked.code,'MOVE_BLOCKED');assert.equal(store.player(pid)!.x,faced.x);assert.equal(store.player(pid)!.y,faced.y);
    const inside=store.player(pid)!;inside.sceneId='sanctuary';assert.equal(world.stepDuration(inside),160);assert.equal(ITEMS.length,8);
  }finally{store.close();}
});

test('storage swaps preserve ownership and identity, and legacy capture/trainer events initialize records honestly',()=>{
  const {store,world,pid}=fixture();try{
    const p=store.player(pid)!,original=p.party[0],stored=world.makeCreature('squirtle',6);p.storage.push(stored);delete p.stats;store.savePlayer(p);store.event(pid,'0,0','capture','Trainer caught Pidgey.');store.event(pid,'1,0','battle','Trainer won a trainer battle.');store.event(pid,'1,0','battle','Trainer won a trainer battle.');
    const id=randomUUID();world.apply(pid,id,{kind:'swapStorage',storageId:stored.id,partyIndex:0});world.apply(pid,id,{kind:'swapStorage',storageId:stored.id,partyIndex:0});const changed=store.player(pid)!;assert.equal(changed.party[0].id,stored.id);assert.equal(changed.storage[0].id,original.id);assert.equal(changed.stats!.captures,1);assert.deepEqual(changed.stats!.caughtSpecies,['pidgey']);assert.equal(changed.stats!.defeatedTrainers.length,1);assert.equal(changed.stats!.tiles,0);
    assert.throws(()=>command(world,pid,{kind:'swapStorage',storageId:'someone-else',partyIndex:0}),/stored companions/);
  }finally{store.close();}
});
