import {npcBehaviorBindingSchema,interiorDesignSchema,type NpcBehavior,type NpcBehaviorBinding,type InteriorDesign} from './world-design.js';
import { z } from 'zod';
import {creatureBlueprintSchema,itemBlueprintSchema,vehicleBlueprintSchema,npcTraitsSchema,type CreatureProfile,type Trait,type CreatureBlueprint,type ItemBlueprint,type VehicleBlueprint,type NpcTraits,type Egg,type PlayerStats,type VarietyState,type CreatureElement} from './content.js';

export const WIDTH = 32, HEIGHT = 24, TILE = 16;
export const WALK_MS = 160;
export const ATTACK_PP = 35;
export const DIRECTIONS = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] } as const;
export type Direction = keyof typeof DIRECTIONS;
export type Element = CreatureElement;
export const SPECIES = {
  bulbasaur: { name: 'Bulbasaur', type: 'grass', move: 'Vine whip', specialPp:25, color: '#73bf8d' },
  charmander: { name: 'Charmander', type: 'fire', move: 'Ember', specialPp:25, color: '#ed9360' },
  squirtle: { name: 'Squirtle', type: 'water', move: 'Water gun', specialPp:25, color: '#72bac9' },
  pikachu: { name: 'Pikachu', type: 'electric', move: 'Thunder shock', specialPp:30, color: '#f3d363' },
  oddish: { name: 'Oddish', type: 'grass', move: 'Absorb', specialPp:25, color: '#70ac83' },
  pidgey: { name: 'Pidgey', type: 'normal', move: 'Gust', specialPp:35, color: '#ba9872' },
} as const;
export type Species = keyof typeof SPECIES;
export const STARTERS: Species[] = ['bulbasaur', 'charmander', 'squirtle'];
export interface Creature { id: string; species: Species; level: number; hp: number; maxHp: number; xp: number;pp?:{attack:number;special:number};profile?:CreatureProfile;traits?:Trait[];parents?:string[];breedAfterStep?:number }
export function creatureInfo(creature:Creature){const base=SPECIES[creature.species],profile=creature.profile;return {...base,name:profile?.name??base.name,type:(profile?.types[0]??base.type) as Element,types:profile?.types??[base.type],move:profile?.move??base.move,specialPp:profile?20:base.specialPp,color:profile?.art.primary??base.color};}
export function creatureKey(creature:Creature){return creature.profile?.id??creature.species;}
export interface MapFeature { kind:'trees'|'pond'|'flowers'|'tallGrass'|'stones'; x:number;y:number;width:number;height:number }
export interface RegionStory { npcBehaviors?:NpcBehaviorBinding[];interiors?:InteriorDesign[];name: string; description: string; biome: 'meadow' | 'forest' | 'coast' | 'ruins'; npcName: string; greeting: string; hook: string; features?:MapFeature[];creatures?:CreatureBlueprint[];shopGoods?:ItemBlueprint[];vehicles?:VehicleBlueprint[];npcTraits?:NpcTraits|null }
export const storySchema = z.object({
  npcBehaviors:z.array(npcBehaviorBindingSchema).max(12).default([]),interiors:z.array(interiorDesignSchema).max(2).default([]),
  name: z.string().min(3).max(42), description: z.string().min(10).max(400),
  biome: z.enum(['meadow', 'forest', 'coast', 'ruins']), npcName: z.string().min(2).max(28),
  greeting: z.string().min(5).max(400), hook: z.string().min(5).max(240),
  creatures:z.array(creatureBlueprintSchema).max(3).default([]),shopGoods:z.array(itemBlueprintSchema).max(3).default([]),vehicles:z.array(vehicleBlueprintSchema).max(1).default([]),npcTraits:npcTraitsSchema.nullable().default(null),
  features:z.array(z.object({kind:z.enum(['trees','pond','flowers','tallGrass','stones']),x:z.number().int().min(3).max(27),y:z.number().int().min(3).max(20),width:z.number().int().min(2).max(6),height:z.number().int().min(2).max(4)}).strict()).max(8).default([]),
}).strict();
export interface Point { x:number; y:number }
export interface SceneObject {
  id:string; kind:'npc'|'building'|'door'|'sign'|'item'|'waystone'|'fence'|'furniture';
  x:number;y:number;width?:number;height?:number;solid:boolean;
  role?:'guide'|'trainer'|'healer'|'merchant'|'breeder';name?:string;text?:string;sprite?:string;
  behavior?:NpcBehavior;motion?:MovementState;reservedFrom?:Point;
  targetScene?:string;arrival?:Point;facing?:Direction;item?:'potion'|'ball';
}
export interface RegionScene { id:string;name:string;tiles:number[];objects:SceneObject[];spawn:Point;theme:'interior' }
export interface Region extends RegionStory { staticHash?:string;id: string; gx: number; gy: number; tiles: number[]; seed: number; source: 'authored' | 'codex' | 'fallback'; published: boolean; prepared?:boolean; hash: string; createdAt: number;layoutVersion?:number;objects?:SceneObject[];scenes?:RegionScene[];spawn?:Point;sceneId?:string;theme?:'interior' }
export interface MovementState { seq:number;fromX:number;fromY:number;toX:number;toY:number;startedAt:number;duration:number;accepted:boolean;regionId?:string;sceneId?:string }
export interface Battle { id: string; kind: 'wild' | 'trainer' | 'training' | 'coop'; enemy: Creature; round: number; log: string[]; won: boolean; finished: boolean; rewardGiven: boolean; participants?: string[]; actions?: Record<string, 'attack' | 'special'>; roundStartedAt?: number;trainerId?:string }
export interface Player {
  id: string; name: string; color: number; regionId: string; x: number; y: number; facing: Direction;
  party: Creature[]; storage: Creature[]; active: number; balls: number; potions: number; coins: number;
  tutorial: number; tutorialFlags: string[]; lessonRegion: string | null; introDone: boolean;
  visited: string[]; journal: string[]; battle: Battle | null; choice: string | null; steps: number;
  sceneId?:string;returnPosition?:Point;movement?:MovementState;collectedItems?:string[];
  items?:Record<string,number>;ownedVehicles?:string[];vehicleId?:string;repelSteps?:number;egg?:Egg;stats?:PlayerStats;
}
export interface PublicPlayer { id: string; name: string; x: number; y: number; facing: Direction; color: number; busy: boolean;movement?:MovementState;sceneId?:string;ride?:{id?:string;form:VehicleBlueprint["form"];color:string} }
export interface WorldEvent { seq: number; at: number; playerId: string | null; regionId: string; kind: string; text: string }
export interface NpcMemory { behavior?:NpcBehavior;visits: Record<string, number>; memories: string[]; mood: string; intention: string; revision: number; dialogue?: string;traits?:NpcTraits }
export interface GenerationStatus { state: 'disconnected' | 'connecting' | 'authenticated' | 'verifying' | 'ready' | 'working' | 'error'; message: string; queued: number; completed: number; failed: number; limit: number; used: number; mode: 'codex' | 'test' | 'preview'; }
export interface GameState {
  variety?:VarietyState;stepMs?:number;
  streaming?:import('./streaming.js').StreamingState;
  preview?: boolean;
  serverTime?: number;
  type: 'state'; me: Player; region: Region; players: PublicPlayer[]; events: WorldEvent[];
  regions: { id: string; name: string; gx: number; gy: number; source: string }[];
  generation: Pick<GenerationStatus, 'state' | 'queued' | 'completed' | 'mode'>;
  worldName: string; worldChoice: string | null; npc: NpcMemory; seq: number;
}
export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move'), direction: z.enum(['north','south','west','east']),seq:z.number().int().nonnegative().optional() }),
  z.object({ kind: z.literal('starter'), species: z.enum(['bulbasaur','charmander','squirtle']) }),
  z.object({ kind: z.literal('intro') }), z.object({ kind: z.literal('talk') }), z.object({kind:z.literal('interact')}),
  z.object({ kind: z.literal('battle'), action: z.enum(['attack','special','capture','run','close']),ball:z.string().max(80).optional() }),
  z.object({ kind: z.literal('heal') }), z.object({ kind: z.literal('potion') }),
  z.object({ kind: z.literal('switch'), index: z.number().int().min(0).max(5) }),
  z.object({ kind: z.literal('encounter') }), z.object({ kind: z.literal('trainer') }),
  z.object({ kind: z.literal('coop') }), z.object({ kind: z.literal('save') }),
  z.object({kind:z.literal('cancelTravel')}),z.object({kind:z.literal('retryTravel')}),
  z.object({kind:z.literal('buyItem'),itemId:z.string().max(80),quantity:z.number().int().min(1).max(20)}),
  z.object({kind:z.literal('useItem'),itemId:z.string().max(80),index:z.number().int().min(0).max(5).optional()}),
  z.object({kind:z.literal('buyVehicle'),vehicleId:z.string().max(80)}),z.object({kind:z.literal('ride'),vehicleId:z.string().max(80).nullable()}),
  z.object({kind:z.literal('breed'),parentA:z.string().max(100),parentB:z.string().max(100)}),
  z.object({kind:z.literal('swapStorage'),partyIndex:z.number().int().min(0).max(5),storageId:z.string().max(100)}),
  z.object({ kind: z.literal('choice'), choice: z.enum(['protect','explore']) }),
]);
export type Action = z.infer<typeof actionSchema>;
export const commandSchema = z.object({ type: z.literal('command'), id: z.string().uuid(), action: actionSchema }).strict();
export const TUTORIALS = [
  { title: 'A first companion', description: 'Choose your partner, walk a few steps, then stand beside your guide in the town square and face them to talk.', short: 'Choose a starter & meet your guide' },
  { title: 'Into the tall grass', description: 'Your next guide will help you battle. Win a wild encounter with an attack.', short: 'Win your first wild battle' },
  { title: 'A new friend', description: 'Weaken a wild Pokémon, then throw a Poké Ball. Your guide has practice supplies.', short: 'Catch a wild Pokémon' },
  { title: 'Care for your team', description: 'Heal your companions and switch the leader of your party.', short: 'Heal & switch your lead Pokémon' },
  { title: 'Ready for the journey', description: 'Defeat the route trainer, then help the guide decide how to care for the valley.', short: 'Defeat a trainer & choose your path' },
  { title: 'The horizon is yours', description: 'Explore new routes, catch Pokémon, meet travelers, and take on the guardian with a friend.', short: 'Explore the ever-growing valley' },
] as const;
export function regionId(x: number, y: number) { return `${x},${y}`; }
export function hashSeed(value: string) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function random(seed: number) { let s = seed >>> 0; return () => { s += 0x6d2b79f5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function walkable(tile: number) { return ![2,4,6,8,10,12,13].includes(tile); }
export function damage(attacker: Creature, target: Creature, special: boolean, roll: number) {
  const a = creatureInfo(attacker).type, b = creatureInfo(target).type;
  const strong = (a === 'fire' && b === 'grass') || (a === 'grass' && b === 'water') || (a === 'water' && b === 'fire') || (a === 'electric' && b === 'water');
  const weak = (b === 'fire' && a === 'grass') || (b === 'grass' && a === 'water') || (b === 'water' && a === 'fire');
  const affinities:Partial<Record<Element,Element[]>>={rock:['flying','fire','ice'],ground:['electric','steel'],ice:['dragon','grass'],flying:['bug','grass'],bug:['psychic','dark'],poison:['grass','fairy'],psychic:['fighting','poison'],ghost:['psychic'],dark:['ghost'],steel:['rock','fairy'],fairy:['dragon'],dragon:['dragon'],fighting:['normal','rock']};
  return Math.max(2, Math.floor((5 + attacker.level * .8 + roll * 3 + (attacker.traits?.includes('bold')?1:0)) * (special ? strong||affinities[a]?.includes(b) ? 1.6 : weak ? .7 : 1.1 : 1)));
}
