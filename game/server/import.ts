// Host-only import of a versioned portable save exported from the browser demo.
// Validates the file thoroughly, then applies progress to a brand-new isolated
// preview run (trusted maps recreated from the bundled pack). Existing runs are
// never touched; corrupt or unsupported files are rejected before anything is
// created except a disposable directory.

import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {SPECIES,WIDTH,HEIGHT,type Player,type Creature,type Species} from '../shared/model.js';
import {TRAITS,type Trait} from '../shared/content.js';
import {getScene,solidAt} from '../shared/scene.js';
import {LAYOUT_VERSION} from '../engine/maps.js';
import type {Store} from './store.js';

export const PREVIEW_IDS=['0,0','0,-1','0,1','-1,0','1,0'] as const;
const MAX_SAVE_BYTES=2*1024*1024;
const speciesEnum=z.enum(Object.keys(SPECIES) as [Species,...Species[]]);
const traitEnum=z.enum(Object.keys(TRAITS) as [Trait,...Trait[]]);

const creatureSchema=z.object({
  id:z.string().min(1).max(64),species:speciesEnum,
  level:z.number().int().min(1).max(100),hp:z.number().int().min(0),maxHp:z.number().int().min(1).max(999),
  xp:z.number().min(0),traits:z.array(traitEnum).max(6).optional(),
  profile:z.any().optional(),pp:z.object({attack:z.number().int().min(0),special:z.number().int().min(0)}).optional(),
  breedAfterStep:z.number().optional(),
}).refine(creature=>creature.hp<=creature.maxHp,'HP exceeds maximum.');

const portableSaveSchema=z.object({
  format:z.literal('infinite-pokemon-save'),
  formatVersion:z.literal(1),
  demoPackVersion:z.number().int(),
  exportedAt:z.string().max(40),
  world:z.object({name:z.string().max(60),seed:z.string().max(80)}),
  trainer:z.object({
    name:z.string().trim().min(2).max(18).regex(/^[\p{L}\p{N} _-]+$/u,'Trainer name contains unsupported characters.'),
    coins:z.number().int().min(0).max(99999),steps:z.number().int().min(0).max(10_000_000),
    visited:z.array(z.string()).max(64),journal:z.array(z.string().max(400)).max(200),
    stats:z.any().optional(),vehicles:z.array(z.string()).max(16).optional(),
  }),
  party:z.array(creatureSchema).max(6),
  storage:z.array(creatureSchema).max(500),
  inventory:z.object({balls:z.number().int().min(0).max(999),potions:z.number().int().min(0).max(999),items:z.record(z.string(),z.number().int().min(0).max(999))}),
  egg:z.any().nullable(),
  tutorial:z.object({step:z.number().int().min(0).max(5),flags:z.array(z.string()).max(32),introDone:z.boolean()}),
  position:z.object({regionId:z.string(),sceneId:z.string().optional(),x:z.number().int(),y:z.number().int(),facing:z.enum(['north','south','east','west'])}),
  worldChanges:z.array(z.object({id:z.string(),hash:z.string()})),
  continuity:z.array(z.object({kind:z.string().max(40),text:z.string().max(500),regionId:z.string().max(64)})).max(500),
});

export type PortableSave=z.infer<typeof portableSaveSchema>;

export function parsePortableSave(text:string):PortableSave{
  if(text.length>MAX_SAVE_BYTES)throw new Error('That save file is too large.');
  let json:unknown;
  try{json=JSON.parse(text);}catch{throw new Error('That file is not valid JSON.');}
  const save=portableSaveSchema.safeParse(json);
  if(!save.success)throw new Error('That save file is malformed: '+save.error.issues[0].message);
  if(save.data.demoPackVersion!==LAYOUT_VERSION)throw new Error(`That save uses demo pack v${save.data.demoPackVersion}, but this game bundles v${LAYOUT_VERSION}. Update the game and try again.`);
  const changes=new Set(save.data.worldChanges.map(change=>change.id));
  for(const id of PREVIEW_IDS)if(!changes.has(id))throw new Error('That save is missing a prepared map reference.');
  return save.data;
}

/** Applies validated progress into a freshly-created preview store. Returns the new player and token. */
export function applyPortableSave(store:Store,save:PortableSave):{player:Player;token:string}{
  // Recreated trusted maps come from the bundled pack; ignore exported map bodies.
  // Gameplay bounds: position must be on a prepared map, inside the grid, walkable.
  if(!PREVIEW_IDS.includes(save.position.regionId as typeof PREVIEW_IDS[number]))throw new Error('That save points outside the prepared maps.');
  const region=store.region(save.position.regionId);
  if(!region)throw new Error('A prepared map is missing in this installation.');
  const scene=getScene(region,save.position.sceneId);
  const x=save.position.x,y=save.position.y;
  if(x<0||y<0||x>=WIDTH||y>=HEIGHT||solidAt(scene,x,y))throw new Error('That save has an invalid player position.');
  if(save.position.sceneId&&!region.scenes?.some(s=>s.id===save.position.sceneId))throw new Error('That save references an unknown interior.');

  const id=randomUUID(),token=randomUUID()+randomUUID();
  const clone=(creature:Creature):Creature=>({...structuredClone(creature),id:randomUUID()});  const player:Player={
    id,name:save.trainer.name,color:Math.abs([...id].reduce((sum,c)=>sum+c.charCodeAt(0),0))%6,
    regionId:save.position.regionId,sceneId:save.position.sceneId,x,y,facing:save.position.facing,
    party:save.party.map(clone),storage:save.storage.map(clone),active:0,
    balls:save.inventory.balls,potions:save.inventory.potions,items:{...save.inventory.items},
    coins:save.trainer.coins,tutorial:save.tutorial.step,tutorialFlags:[...save.tutorial.flags],
    lessonRegion:null,introDone:save.tutorial.introDone,visited:[...new Set(save.trainer.visited)].slice(0,64),
    journal:[...save.trainer.journal],battle:null,choice:null,steps:save.trainer.steps,
    collectedItems:[],ownedVehicles:[...(save.trainer.vehicles??[])],repelSteps:0,
    egg:save.egg?structuredClone(save.egg):undefined,stats:save.trainer.stats?structuredClone(save.trainer.stats):undefined,
    movement:undefined,
  };
  store.transaction(()=>{
    store.addPlayer(player,token);
    store.setMeta('hostPlayerId',player.id);
    store.setMeta('sessionMode','singleplayer');
    for(const event of save.continuity)store.event(player.id,event.regionId,event.kind,event.text);
    store.event(player.id,player.regionId,'arrival',`${player.name} continued their journey from the browser demo.`);
  });
  return {player,token};
}
