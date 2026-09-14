import {z} from 'zod';

export const elementSchema=z.enum(['normal','grass','fire','water','electric','rock','ground','ice','flying','bug','poison','psychic','ghost','dark','steel','fairy','dragon','fighting']);
export type CreatureElement=z.infer<typeof elementSchema>;
export const traitSchema=z.enum(['hearty','bold','gentle','curious','swift','elusive','sturdy','radiant']);
export type Trait=z.infer<typeof traitSchema>;
export const TRAITS:Record<Trait,string>={hearty:'Extra maximum HP',bold:'A small attack bonus',gentle:'Takes slightly less damage',curious:'Flavor: investigates unfamiliar things',swift:'Flavor: quick and restless',elusive:'A little harder to catch',sturdy:'Extra maximum HP',radiant:'Flavor: a vivid, unusual pattern'};
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const creatureArtSchema=z.object({form:z.enum(['quadruped','bird','fish','serpent','golem','sprite']),primary:color,accent:color,pattern:z.enum(['plain','spots','stripes','crest']),horns:z.boolean(),wings:z.boolean()}).strict();
export type CreatureArtRecipe=z.infer<typeof creatureArtSchema>;
export const creatureBlueprintSchema=z.object({name:z.string().trim().min(3).max(24),description:z.string().min(8).max(180),base:z.enum(['bulbasaur','charmander','squirtle','pikachu','oddish','pidgey']),types:z.array(elementSchema).min(1).max(2),move:z.string().min(3).max(22),traits:z.array(traitSchema).min(1).max(2),art:creatureArtSchema}).strict();
export type CreatureBlueprint=z.infer<typeof creatureBlueprintSchema>;
export interface CreatureProfile extends CreatureBlueprint {id:string;source:'authored'|'harness'|'hybrid';parentSpecies?:string[];generation?:number}
export const npcTraitsSchema=z.object({temperament:z.enum(['warm','reserved','bold','patient','generous','meticulous']),interest:z.enum(['gardening','battling','folklore','travel','crafting','research']),quirk:z.string().min(4).max(100)}).strict();
export type NpcTraits=z.infer<typeof npcTraitsSchema>;
export const itemBlueprintSchema=z.object({name:z.string().trim().min(3).max(28),description:z.string().min(8).max(180),effect:z.enum(['heal','pp','repel','capture']),tier:z.number().int().min(1).max(3),icon:z.enum(['bottle','herb','orb','charm']),color}).strict();
export type ItemBlueprint=z.infer<typeof itemBlueprintSchema>;
export interface ItemProfile extends Omit<ItemBlueprint,'effect'> {id:string;effect:ItemBlueprint['effect']|'revive';price:number;power:number;source:'authored'|'harness'}
export const vehicleBlueprintSchema=z.object({name:z.string().trim().min(3).max(28),description:z.string().min(8).max(160),form:z.enum(['bicycle','scooter','cart','mount']),color,speedTier:z.number().int().min(1).max(2)}).strict();
export type VehicleBlueprint=z.infer<typeof vehicleBlueprintSchema>;
export interface VehicleProfile extends VehicleBlueprint {id:string;price:number;stepMs:number;source:'authored'|'harness'}
export const ITEMS:ItemProfile[]=[
  {id:'poke-ball',name:'Poké Ball',description:'Catch a wild companion.',effect:'capture',tier:1,icon:'orb',color:'#e06058',price:40,power:0,source:'authored'},
  {id:'great-ball',name:'Great Ball',description:'A better chance of catching wild companions.',effect:'capture',tier:2,icon:'orb',color:'#5890d8',price:100,power:.16,source:'authored'},
  {id:'potion',name:'Potion',description:'Restore 24 HP to one companion.',effect:'heal',tier:1,icon:'bottle',color:'#af80cb',price:60,power:24,source:'authored'},
  {id:'super-potion',name:'Super Potion',description:'Restore 50 HP to one companion.',effect:'heal',tier:2,icon:'bottle',color:'#e89060',price:150,power:50,source:'authored'},
  {id:'hyper-potion',name:'Hyper Potion',description:'Restore 120 HP to one companion.',effect:'heal',tier:3,icon:'bottle',color:'#d960aa',price:300,power:120,source:'authored'},
  {id:'revive',name:'Revive',description:'Wake a fainted companion with half its HP.',effect:'revive',tier:2,icon:'charm',color:'#ecd078',price:180,power:.5,source:'authored'},
  {id:'ether',name:'Ether',description:'Restore 10 PP to both moves.',effect:'pp',tier:1,icon:'bottle',color:'#70bbb8',price:120,power:10,source:'authored'},
  {id:'repel',name:'Repel',description:'Avoid random wild encounters for 100 steps.',effect:'repel',tier:1,icon:'herb',color:'#76a85e',price:90,power:100,source:'authored'},
];
export const BICYCLE:VehicleProfile={id:'bicycle',name:'Bicycle',description:'Ride faster outdoors. Collisions and doors still apply.',form:'bicycle',color:'#e06058',speedTier:1,stepMs:110,price:400,source:'authored'};

const authored=(id:string,name:string,base:CreatureBlueprint['base'],types:CreatureElement[],form:CreatureArtRecipe['form'],primary:string,accent:string,traits:Trait[],move:string,description:string,wings=false):CreatureProfile=>({id,name,base,types,traits,move,description,source:'authored',art:{form,primary,accent,pattern:wings?'crest':'spots',horns:form==='golem',wings}});
export const EXTRA_CREATURES:CreatureProfile[]=[
  authored('mosskit','Mosskit','bulbasaur',['grass'],'quadruped','#78ad67','#e8cd85',['curious','gentle'],'Leaf dart','A small woodland companion that collects fallen leaves.'),
  authored('emberwing','Emberwing','charmander',['fire','flying'],'bird','#dc7853','#f1c970',['bold','swift'],'Ember gust','Warm feathers keep this little bird comfortable at dawn.',true),
  authored('brookfin','Brookfin','squirtle',['water'],'fish','#6bb7cd','#e6db95',['gentle','swift'],'Bubble burst','It makes rings of bubbles in quiet river pools.'),
  authored('voltling','Voltling','pikachu',['electric'],'sprite','#e8c951','#78a5bc',['curious','radiant'],'Spark arc','Static crackles softly between its bright ears.'),
  authored('pebblit','Pebblit','squirtle',['rock'],'golem','#a6967b','#c9cfab',['sturdy','gentle'],'Pebble toss','A patient little creature that resembles a pile of stones.'),
  authored('frostowl','Frostowl','pidgey',['ice','flying'],'bird','#abd7d9','#838fbf',['elusive','curious'],'Frost feather','Its pale wings blend into the morning mist.',true),
  authored('duskcoil','Duskcoil','oddish',['ghost'],'serpent','#9b82b9','#dfb887',['elusive','radiant'],'Dusk pulse','It curls around ancient stones when the light fades.'),
  authored('sunmoth','Sunmoth','pidgey',['bug','fire'],'sprite','#e6b168','#c87986',['radiant','gentle'],'Solar dust','Its patterned wings open toward the afternoon sun.',true),
  authored('reedram','Reedram','bulbasaur',['grass','water'],'quadruped','#77ac95','#d0c679',['hearty','bold'],'Reed rush','A sturdy grazer that shelters among riverside reeds.'),
  authored('glimmerfox','Glimmerfox','pikachu',['fairy'],'quadruped','#cf9caf','#a7cdbf',['elusive','curious'],'Glimmer ray','It follows distant lights and leaves tiny pawprints.'),
  authored('ironclod','Ironclod','squirtle',['steel','ground'],'golem','#8d9ba8','#b49c77',['sturdy','bold'],'Iron bump','Its heavy shell is polished smooth by years of wandering.'),
  authored('skydrake','Skydrake','charmander',['dragon','flying'],'serpent','#729ba7','#e0be80',['hearty','swift'],'Wind spiral','A young gliding creature that rides warm valley breezes.',true),
];
export interface Egg {id:string;parents:[string,string];parentNames:[string,string];profile:CreatureProfile;traits:Trait[];hatchAtStep:number}
export interface PlayerStats {captures:number;caughtSpecies:string[];defeatedTrainers:string[];tiles:number;trackingSince:number}
export interface LeaderboardEntry {id:string;name:string;captures:number;species:number;maps:number;tiles:number;trainers:number}
export interface VarietyState {shopItems:ItemProfile[];shopVehicles:VehicleProfile[];inventoryItems:ItemProfile[];ownedVehicles:VehicleProfile[];leaderboard:LeaderboardEntry[];shopOpen:boolean;nurseryOpen:boolean;npcTraits?:NpcTraits}
