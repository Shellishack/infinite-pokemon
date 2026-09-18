import type {WorldStore} from './store.js';
import {sha256Hex} from '../shared/sha256.js';
import {SPECIES,ATTACK_PP,hashSeed,creatureInfo,creatureKey,type Creature,type Player,type Region,type Species} from '../shared/model.js';
import {ITEMS,BICYCLE,EXTRA_CREATURES,TRAITS,type Trait,type CreatureProfile,type ItemProfile,type VehicleProfile,type NpcTraits,type VarietyState} from '../shared/content.js';
import {getScene,objectInFront} from '../shared/scene.js';

const randomUUID=()=>crypto.randomUUID();
const idFor=(prefix:string,value:unknown)=>prefix+'-'+sha256Hex(JSON.stringify(value)).slice(0,24);
export class ContentSystem {
  private cache=new Map<string,{hash:string;creatures:CreatureProfile[];items:ItemProfile[];vehicles:VehicleProfile[]}>();
  constructor(public store:WorldStore){for(const profile of EXTRA_CREATURES)store.define('creature',profile.id,profile);}
  region(region:Region){
    const cached=this.cache.get(region.id);if(cached?.hash===region.hash)return cached;
    const signature=(blueprint:CreatureProfile|NonNullable<Region['creatures']>[number])=>idFor('species',{name:blueprint.name.trim().toLowerCase(),base:blueprint.base,types:[...new Set(blueprint.types)],art:{...blueprint.art,primary:blueprint.art.primary.toLowerCase(),accent:blueprint.art.accent.toLowerCase()}});
    const creatures=(region.creatures??[]).map(input=>{const blueprint={...input,name:input.name.trim(),types:[...new Set(input.types)],traits:[...new Set(input.traits)],art:{...input.art,primary:input.art.primary.toLowerCase(),accent:input.art.accent.toLowerCase()}};const id=signature(blueprint),known=EXTRA_CREATURES.find(profile=>signature(profile)===id);return known?this.store.define('creature',known.id,known):this.store.define<CreatureProfile>('creature',id,{...blueprint,id,source:'harness'});});
    const items=(region.shopGoods??[]).map(blueprint=>{const id=idFor('item',blueprint),power=({heal:[24,50,120],pp:[5,10,20],repel:[50,100,200],capture:[.08,.16,.24]})[blueprint.effect][blueprint.tier-1];return this.store.define<ItemProfile>('item',id,{...blueprint,id,power,price:({heal:60,pp:80,repel:60,capture:80})[blueprint.effect]*blueprint.tier,source:'harness'});});
    const vehicles=(region.vehicles??[]).map(blueprint=>{const id=idFor('vehicle',blueprint);return this.store.define<VehicleProfile>('vehicle',id,{...blueprint,id,price:blueprint.speedTier===1?450:800,stepMs:blueprint.speedTier===1?110:90,source:'harness'});});
    const result={hash:region.hash,creatures,items,vehicles};this.cache.set(region.id,result);return result;
  }
  npcTraits(region:Region,objectId='guide'):NpcTraits{
    if(objectId==='guide'&&region.npcTraits)return region.npcTraits;
    const seed=hashSeed(region.seed+':'+objectId);return {temperament:(['warm','reserved','bold','patient','generous','meticulous'] as const)[seed%6],interest:(['gardening','battling','folklore','travel','crafting','research'] as const)[(seed>>>4)%6],quirk:['Keeps a notebook full of tiny sketches.','Collects stories about unusual companions.','Always checks the weather before a journey.','Enjoys naming the plants along the trail.','Remembers the travelers who stop to say hello.','Carries a carefully folded map.'][(seed>>>8)%6]};
  }
  initialize(player:Player){
    player.items??={};player.ownedVehicles??=[];player.repelSteps??=0;
    if(!player.stats){const events=this.store.eventsFor(player.id);const captures=events.filter(event=>event.kind==='capture');const species=new Set<string>();for(const event of captures)for(const [id,definition] of Object.entries(SPECIES))if(String(event.text).endsWith(' caught '+definition.name+'.'))species.add(id);player.stats={captures:captures.length,caughtSpecies:[...species],defeatedTrainers:[...new Set(events.filter(event=>event.kind==='battle'&&event.text.endsWith(' won a trainer battle.')).map(event=>event.regionId+':outdoor:trainer'))],tiles:0,trackingSince:Date.now()};}
    for(const creature of [...player.party,...player.storage])creature.traits??=[(['curious','swift','radiant'] as Trait[])[hashSeed(creature.id)%3]];
  }
  make(species:Species,level=5,profile?:CreatureProfile,traits?:Trait[]):Creature {
    const id=randomUUID(),pool=profile?.traits??(['curious','swift','radiant'] as Trait[]),chosen=traits??[...new Set([pool[hashSeed(id)%pool.length],(['curious','swift','radiant'] as Trait[])[hashSeed(id+'nature')%3]])];
    const maxHp=24+level*4+(chosen.includes('hearty')?4:chosen.includes('sturdy')?2:0);return {id,species,level,hp:maxHp,maxHp,xp:0,profile,traits:chosen,pp:{attack:ATTACK_PP,special:profile?20:SPECIES[species].specialPp}};
  }
  wild(region:Region,seed:number){const authored=EXTRA_CREATURES.filter(profile=>region.biome==='forest'?profile.types.some(t=>['grass','bug','flying'].includes(t)):region.biome==='coast'?profile.types.some(t=>['water','ice','electric'].includes(t)):region.biome==='ruins'?profile.types.some(t=>['rock','ghost','steel','dragon'].includes(t)):true);const pool=[...this.region(region).creatures,...authored];return pool[seed%pool.length];}
  item(id:string){return ITEMS.find(item=>item.id===id)??this.store.definition<ItemProfile>('item',id);}
  vehicle(id:string){return id===BICYCLE.id?BICYCLE:this.store.definition<VehicleProfile>('vehicle',id);}
  quantity(p:Player,id:string){return id==='poke-ball'?p.balls:id==='potion'?p.potions:p.items?.[id]??0;}
  add(p:Player,id:string,n:number){if(id==='poke-ball')p.balls+=n;else if(id==='potion')p.potions+=n;else{p.items??={};p.items[id]=(p.items[id]??0)+n;}}
  service(p:Player,role:'merchant'|'breeder'){const r=this.store.region(p.regionId)!;return objectInFront(getScene(r,p.sceneId),p,p.facing)?.role===role;}
  shop(region:Region){const catalog=this.region(region),discount=this.npcTraits(region,'room-shop').temperament==='generous'?.9:1;return [...ITEMS,...catalog.items].map(item=>({...item,price:Math.max(1,Math.round(item.price*discount))}));}
  buy(p:Player,id:string,quantity:number){if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw new Error('Choose between 1 and 20 items.');if(!this.service(p,'merchant'))throw new Error('Stand beside the shopkeeper and face them.');const item=this.shop(this.store.region(p.regionId)!).find(item=>item.id===id);if(!item)throw new Error('This shop does not stock that item.');const total=item.price*quantity;if(p.coins<total)throw new Error('You do not have enough coins.');if(this.quantity(p,id)+quantity>999)throw new Error('Your bag cannot hold that many.');p.coins-=total;this.add(p,id,quantity);return item;}
  buyVehicle(p:Player,id:string){if(!this.service(p,'merchant'))throw new Error('Visit a shopkeeper to buy a ride.');const vehicles=[BICYCLE,...this.region(this.store.region(p.regionId)!).vehicles],vehicle=vehicles.find(v=>v.id===id);if(!vehicle)throw new Error('This vehicle is not sold here.');if(p.ownedVehicles!.includes(id))throw new Error('You already own this vehicle.');if(p.coins<vehicle.price)throw new Error('You do not have enough coins.');p.coins-=vehicle.price;p.ownedVehicles!.push(id);return vehicle;}
  use(p:Player,id:string,index:number){const item=this.item(id);if(!item||!this.quantity(p,id))throw new Error('That item is not in your bag.');const creature=p.party[index];if(!creature)throw new Error('Choose a companion.');
    if(item.effect==='capture')throw new Error('Use capture items from the battle bag.');
    if(item.effect==='repel'){if(p.battle&&!p.battle.finished)throw new Error('Use Repel before entering a battle.');p.repelSteps=Math.max(p.repelSteps??0,item.power);}
    if(item.effect==='heal'){if(creature.hp<=0||creature.hp>=creature.maxHp)throw new Error('Choose an injured, conscious companion.');creature.hp=Math.min(creature.maxHp,creature.hp+item.power);}
    if(item.effect==='revive'){if(creature.hp>0)throw new Error('Revive is for a fainted companion.');creature.hp=Math.max(1,Math.floor(creature.maxHp*item.power));}
    if(item.effect==='pp'){const max=creatureInfo(creature).specialPp;creature.pp??={attack:ATTACK_PP,special:max};if(creature.pp.attack===ATTACK_PP&&creature.pp.special===max)throw new Error('This companion already has full PP.');creature.pp.attack=Math.min(ATTACK_PP,creature.pp.attack+item.power);creature.pp.special=Math.min(max,creature.pp.special+item.power);}
    this.add(p,id,-1);return item;
  }
  breed(p:Player,aId:string,bId:string){
    if(!this.service(p,'breeder'))throw new Error('Visit the nursery keeper to pair companions.');if(p.egg)throw new Error('Hatch your current egg first.');if(aId===bId)throw new Error('Choose two different companions.');
    const owned=[...p.party,...p.storage],a=owned.find(c=>c.id===aId),b=owned.find(c=>c.id===bId);if(!a||!b)throw new Error('Both parents must belong to your team or storage.');if([a,b].some(c=>c.level<5||c.hp<=0||(c.breedAfterStep??0)>p.steps))throw new Error('Parents need level 5, health, and time to rest between eggs.');if(p.coins<120)throw new Error('Nursery care costs 120 coins.');
    const pair=[a,b].sort((x,y)=>creatureKey(x).localeCompare(creatureKey(y))),keys=pair.map(creatureKey),id=idFor('hybrid',keys),aa=creatureInfo(pair[0]),bb=creatureInfo(pair[1]);
    const artOf=(c:Creature)=>c.profile?.art??{form:'quadruped' as const,primary:creatureInfo(c).color,accent:'#ead9a0',pattern:'spots' as const,horns:false,wings:c.species==='pidgey'};
    const artA=artOf(pair[0]),artB=artOf(pair[1]);const inherited=[...new Set([...(a.traits??[]),...(b.traits??[])])];const traits:Trait[]=[inherited[hashSeed(a.id+b.id)%inherited.length]??'curious',(['hearty','bold','gentle','elusive'] as Trait[])[hashSeed(b.id+a.id)%4]];
    const profile=this.store.define<CreatureProfile>('creature',id,{id,name:aa.name.slice(0,6)+bb.name.slice(-5),description:`A hybrid of ${aa.name} and ${bb.name}, with inherited features and its own nature.`,base:pair[0].species,types:[...new Set([aa.type,bb.type])],move:'Hybrid pulse',traits:[...new Set(traits)],art:{...artA,accent:artB.primary,wings:artA.wings||artB.wings,horns:artA.horns||artB.horns,pattern:'stripes'},source:'hybrid',parentSpecies:keys,generation:1+Math.max(a.profile?.generation??0,b.profile?.generation??0)});
    p.coins-=120;a.breedAfterStep=p.steps+64;b.breedAfterStep=p.steps+64;p.egg={id:randomUUID(),parents:[a.id,b.id],parentNames:[creatureInfo(a).name,creatureInfo(b).name],profile,traits:[...new Set(traits)],hatchAtStep:p.steps+32};return profile;
  }
  step(p:Player){this.initialize(p);p.stats!.tiles+=this.store.explore(p.id,`${p.regionId}:${p.sceneId??'outdoor'}:${p.x},${p.y}`);if((p.repelSteps??0)>0)p.repelSteps!--;
    if(p.egg&&p.steps>=p.egg.hatchAtStep){const egg=p.egg,baby=this.make(egg.profile.base,1,egg.profile,egg.traits);baby.parents=[...egg.parents];if(p.party.length<6)p.party.push(baby);else p.storage.push(baby);delete p.egg;this.store.event(p.id,p.regionId,'hatch',`${p.name}'s egg hatched into ${creatureInfo(baby).name}.`);p.journal.unshift(`Hatched ${creatureInfo(baby).name} from ${egg.parentNames.join(' and ')}.`);return baby;}
  }
  view(p:Player):VarietyState {const region=this.store.region(p.regionId)!,target=objectInFront(getScene(region,p.sceneId),p,p.facing),catalog=this.region(region);return {shopItems:this.shop(region),shopVehicles:[BICYCLE,...catalog.vehicles],inventoryItems:[...new Set(['poke-ball','potion',...Object.keys(p.items??{})])].map(id=>this.item(id)).filter((item):item is ItemProfile=>!!item),ownedVehicles:(p.ownedVehicles??[]).map(id=>this.vehicle(id)).filter((vehicle):vehicle is VehicleProfile=>!!vehicle),shopOpen:target?.role==='merchant',nurseryOpen:target?.role==='breeder',npcTraits:target?.kind==='npc'?this.npcTraits(region,target.id):undefined,leaderboard:this.store.players().map(player=>({id:player.id,name:player.name,captures:player.stats?.captures??0,species:new Set(player.stats?.caughtSpecies??[]).size,maps:new Set(player.visited).size,tiles:player.stats?.tiles??0,trainers:new Set(player.stats?.defeatedTrainers??[]).size}))};}
}
