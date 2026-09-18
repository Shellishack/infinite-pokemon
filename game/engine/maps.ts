import {applyInteriorDesigns,applyNpcBehaviors} from './interiors.js';
import { sha256Hex } from '../shared/sha256.js';
import { WIDTH, HEIGHT, hashSeed, random, regionId, walkable, storySchema, type Region, type RegionStory, type SceneObject, type RegionScene, type Point } from '../shared/model.js';
import { getScene, sceneObjects, solidAt } from '../shared/scene.js';
import type { WorldStore } from './store.js';
import {installServices} from './services.js';

export const LAYOUT_VERSION = 2;
type Layout = 'town' | 'forest' | 'river' | 'coast' | 'ruins';
const names = ['Fernway','Willow','Sunpetal','Mossbank','Clover','Starfall','Silverleaf','Juniper'];
const opening: Record<string,RegionStory> = {
  '0,0': {name:'Willowbrook',description:'A little town gathered around Professor Fern’s laboratory. Garden paths connect the houses, practice meadow, and old Waystone.',biome:'meadow',npcName:'Professor Fern',greeting:'Welcome to Willowbrook! Choose a companion, then meet me beside the town square. The laboratory is open if your team needs care.',hook:'The laboratory’s old map has begun to show trails beyond the valley.'},
  '0,-1': {name:'Whisperwood Trail',description:'A winding woodland trail curls between dense trees, fern clearings, and a ranger cabin. Follow the bends to find the forest’s hidden glade.',biome:'forest',npcName:'Ranger Hazel',greeting:'Welcome to Whisperwood. Stay curious at the bends! My cabin is a good place to rest before another woodland encounter.',hook:'Tiny footprints lead from the ranger cabin into a clearing where the trees seem to listen.'},
  '0,1': {name:'Cloverbank River',description:'Flower meadows slope toward a winding river. A timber bridge links the western rest house with the broad eastern riverbank.',biome:'meadow',npcName:'Riverkeeper Tansy',greeting:'The bridge is safe, and our rest house has room for your companions. Take a moment to hear the water before you set out.',hook:'Someone has tied a ribbon to the bridge; a matching ribbon drifts past every morning.'},
  '1,0': {name:'Sunbreak Coast',description:'The forest gives way to open water. Long wooden boardwalks connect the shore station, sea lookout, and the routes beyond the bay.',biome:'coast',npcName:'Coastal Scout Mira',greeting:'Welcome to the coast! Our station is just inland. The boardwalk lets us watch the sea without disturbing the Pokémon below.',hook:'At low tide, a distant bell answers footsteps on the boardwalk.'},
  '-1,0': {name:'Waystone Terraces',description:'Broken stone terraces rise through moss and wild grass. Zigzag paths lead between an archive shelter, fallen pillars, and a weathered shrine.',biome:'ruins',npcName:'Keeper Moss',greeting:'These terraces have welcomed travelers for generations. The archive shelter offers care, and the stones have more stories than I can count.',hook:'A missing inscription has appeared on the Waystone, but nobody remembers carving it.'},
};
export function fallbackStory(gx:number,gy:number,worldSeed:string):RegionStory {
  const fixed=opening[regionId(gx,gy)];if(fixed)return {...fixed,features:[]};
  const seed=hashSeed(worldSeed+':'+gx+','+gy),biomes=['meadow','forest','coast','ruins'] as const,biome=biomes[seed%4];
  return {name:names[(seed>>>4)%names.length]+' '+(biome==='coast'?'Shore':biome==='ruins'?'Terraces':'Trail'),biome,
    description:'A new route follows the shape of the land. A local guide, a trainer, and a small shelter welcome passing companions.',
    npcName:['Ranger Rowan','Traveler Mira','Scout Hazel','Keeper Moss'][seed%4],greeting:'You made it! Rest your companions, explore the landmarks, and follow whichever path calls to you.',
    hook:'Travelers say the valley remembers every act of kindness. Look for the local Waystone.',features:[]};
}
function layoutFor(gx:number,gy:number,story:RegionStory):Layout {
  const id=regionId(gx,gy);if(id==='0,0')return 'town';if(id==='0,-1')return 'forest';if(id==='0,1')return 'river';if(id==='1,0')return 'coast';if(id==='-1,0')return 'ruins';
  return story.biome==='meadow'?'river':story.biome;
}
class Builder {
  tiles:number[];objects:SceneObject[]=[];protected=new Set<number>();spawn:Point={x:16,y:14};
  constructor(fill=0){this.tiles=Array(WIDTH*HEIGHT).fill(fill);}
  put(x:number,y:number,tile:number,reserve=false){if(x<0||y<0||x>=WIDTH||y>=HEIGHT)return;const i=y*WIDTH+x;this.tiles[i]=tile;if(reserve)this.protected.add(i);}
  rect(x:number,y:number,w:number,h:number,tile:number,reserve=false){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)this.put(xx,yy,tile,reserve);}
  path(points:number[][],tile=1,width=3){const r=Math.floor(width/2);for(let n=1;n<points.length;n++){let[x,y]=points[n-1];const[tx,ty]=points[n];if(x!==tx&&y!==ty)throw new Error('Layout paths must be orthogonal');while(true){this.rect(x-r,y-r,width,width,tile,true);if(x===tx&&y===ty)break;x+=Math.sign(tx-x);y+=Math.sign(ty-y);}}}
  object(object:SceneObject){
    if(object.kind!=='building'&&object.kind!=='door')for(let y=object.y-1;y<=object.y+(object.height??1);y++)for(let x=object.x-1;x<=object.x+(object.width??1);x++)if(x>=0&&y>=0&&x<WIDTH&&y<HEIGHT&&!walkable(this.tiles[y*WIDTH+x]))this.put(x,y,0,true);
    this.objects.push(object);
    for(let y=object.y-1;y<=object.y+(object.height??1);y++)for(let x=object.x-1;x<=object.x+(object.width??1);x++)if(x>=0&&y>=0&&x<WIDTH&&y<HEIGHT)this.protected.add(y*WIDTH+x);
  }
  building(x:number,y:number,sprite:'house'|'lab',name:string){
    const width=sprite==='lab'?7:5,door={x:x+(sprite==='lab'?3:1),y:y+4};
    this.rect(x,y,width,5,6,true);this.rect(door.x,door.y,1,3,1,true);
    this.objects.push({id:'healing-building',kind:'building',name,x,y,width,height:5,solid:false,sprite});
    this.objects.push({id:'healing-door',kind:'door',name:'Enter '+name,x:door.x,y:door.y,solid:false,targetScene:'sanctuary',arrival:{x:16,y:17},facing:'north'});
    return {x:door.x,y:door.y+1};
  }
  finish(){
    for(let x=0;x<WIDTH;x++)for(const y of[0,HEIGHT-1])if(walkable(this.tiles[y*WIDTH+x]))this.put(x,y,2);
    for(let y=0;y<HEIGHT;y++)for(const x of[0,WIDTH-1])if(walkable(this.tiles[y*WIDTH+x]))this.put(x,y,2);
    this.rect(15,0,3,1,1,true);this.rect(15,HEIGHT-1,3,1,1,true);this.rect(0,11,1,3,1,true);this.rect(WIDTH-1,11,1,3,1,true);
    this.put(this.spawn.x,this.spawn.y,1,true);
  }
}
function interior(layout:Layout,arrival:Point):RegionScene {
  const tiles=Array(WIDTH*HEIGHT).fill(10),objects:SceneObject[]=[];
  const rect=(x:number,y:number,w:number,h:number,tile:number)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)tiles[yy*WIDTH+xx]=tile;};
  rect(9,5,14,14,9);rect(15,13,2,6,11);rect(16,19,1,1,11);
  const labels={town:'Professor Fern’s Laboratory',forest:'Whisperwood Ranger Cabin',river:'Cloverbank Rest House',coast:'Sunbreak Shore Station',ruins:'The Terrace Archive'};
  const furniture=(id:string,name:string,x:number,y:number,width:number,height:number,sprite:string,text:string,tile=12)=>{rect(x,y,width,height,tile);objects.push({id,kind:'furniture',name,x,y,width,height,solid:true,sprite,text});};
  if(layout==='town'){
    furniture('research-bench','Research bench',13,7,7,1,'counter','Professor Fern studies how companions grow through friendship.');
    furniture('specimen-cabinet','Specimen cabinet',20,12,2,3,'bookcase','Notes describe the familiar species found around the valley.',13);
    furniture('rest-bed','Resting bed',10,13,2,2,'bed','A soft bed for tired companions.');
  }else if(layout==='forest'){
    furniture('cabin-table','Ranger table',13,7,3,2,'table','A hand-drawn trail map marks the forest’s winding clearings.');
    furniture('rest-bed','Ranger bunk',10,13,2,3,'bed','A warm blanket and the smell of pine.');
    furniture('wood-cabinet','Supply cabinet',20,6,2,2,'bookcase','Boots, blankets, and field guides are neatly stacked.',13);
  }else if(layout==='river'){
    furniture('rest-bed','Companion cot',10,12,2,3,'bed','The sound of the river makes this a restful corner.');
    furniture('second-bed','Companion cot',20,12,2,3,'bed','Clean bedding waits for the next traveler.');
    furniture('river-counter','Care supplies',13,7,7,1,'counter','Fresh water and bandages are ready for any visitor.');
  }else if(layout==='coast'){
    furniture('navigation-table','Navigation table',12,7,4,2,'table','A tide chart shows when the boardwalk lies closest to the waves.');
    furniture('signal-cabinet','Signal equipment',20,6,2,3,'bookcase','Flags and a brass telescope help the scouts watch the bay.',13);
    furniture('rest-bed','Shore cot',10,13,2,2,'bed','A sheltered place to rest after sea air and sunshine.');
  }else{
    furniture('archive-west','Stone records',10,9,2,3,'bookcase','Carefully copied inscriptions tell of travelers from long ago.',13);
    furniture('archive-east','Stone records',20,12,2,4,'bookcase','The oldest entries mention a glowing Waystone.',13);
    furniture('archive-desk','Keeper’s desk',14,7,5,1,'counter','An unfinished translation waits beside a well-used notebook.');
  }
  objects.push({id:'healer',kind:'npc',role:'healer',name:layout==='town'?'Professor’s assistant':'Shelter caretaker',x:18,y:10,solid:true,sprite:layout==='town'?'scientist':'nurse',text:'Welcome. Let me help your companions feel their best.'});
  objects.push({id:'room-pc',kind:'sign',name:'Field terminal',x:10,y:6,solid:true,sprite:'pc',text:'Your companions and discoveries are saved in this world. Use the Pokémon menu to change your party leader.'});
  objects.push({id:'room-exit',kind:'door',name:'Return outside',x:16,y:19,solid:false,targetScene:'outdoor',arrival,facing:'south'});
  return {id:'sanctuary',name:labels[layout],tiles,objects,spawn:{x:16,y:17},theme:'interior'};
}
function makeLayout(layout:Layout,story:RegionStory,seed:number){
  const b=new Builder(layout==='forest'?2:layout==='coast'?4:0);let arrival:Point;
  let guide:Point,trainer:Point,stone:Point,sign:Point,item:Point;
  if(layout==='town'){
    b.rect(12,8,10,11,1,true);b.path([[16,0],[16,23]]);b.path([[0,12],[31,12]]);b.path([[5,18],[27,18],[27,10]]);
    b.rect(3,16,7,5,3,true);b.rect(4,10,5,2,5);b.rect(23,18,6,3,5);
    arrival=b.building(4,3,'lab','Professor Fern’s laboratory');b.path([[7,9],[7,12]]);
    b.rect(23,4,5,5,6,true);b.objects.push({id:'town-house',kind:'building',name:'Willowbrook home',x:23,y:4,width:5,height:5,solid:false,sprite:'house'});
    b.put(24,8,1,true);b.objects.push({id:'home-door',kind:'door',name:'Enter Willowbrook home',x:24,y:8,solid:false,targetScene:'home',arrival:{x:16,y:17},facing:'north'});
    b.objects.push({id:'home-sign',kind:'sign',name:'A quiet home',x:29,y:8,solid:true,text:'A family of travelers lives here. Come inside to rest your companions.'});b.path([[24,10],[24,12]]);
    guide={x:14,y:10};trainer={x:23,y:15};stone={x:18,y:15};sign={x:12,y:7};item={x:28,y:20};b.spawn={x:16,y:14};
    b.objects.push({id:'garden-fence',kind:'fence',x:3,y:15,width:6,height:1,solid:true,sprite:'fence',text:'The practice meadow is just south of this fence.'});
  }else if(layout==='forest'){
    b.rect(3,10,7,6,0);b.rect(10,13,9,7,0);b.rect(19,2,9,8,0);b.rect(23,16,6,6,0);
    b.path([[16,0],[16,4],[10,4],[10,8],[6,8],[6,12],[0,12]]);
    b.path([[6,12],[6,17],[14,17],[14,21],[16,21],[16,23]]);
    b.path([[31,12],[25,12],[25,8],[18,8],[18,11],[12,11],[12,17]]);
    b.path([[17,17],[22,17],[22,19],[25,19]],1,1);
    b.rect(3,13,4,3,3,true);b.rect(13,18,4,2,5);b.rect(24,17,3,2,5);
    arrival=b.building(20,3,'house','Ranger cabin');b.path([[21,8],[25,8]],1,1);
    guide={x:12,y:14};trainer={x:7,y:12};stone={x:17,y:17};sign={x:9,y:4};item={x:26,y:19};b.spawn={x:14,y:16};
  }else if(layout==='river'){
    for(let y=0;y<HEIGHT;y++){const x=y<6?21:y<13?19:17;b.rect(x,y,4,1,4);}
    b.path([[16,0],[16,5],[11,5],[11,12],[0,12]]);b.path([[11,12],[11,19],[16,19],[16,23]]);b.path([[11,12],[31,12]]);
    b.rect(18,11,7,3,7,true);b.rect(4,15,7,6,3,true);b.rect(3,2,6,7,5);b.rect(25,17,4,4,5);
    arrival=b.building(3,3,'house','Riverside rest house');b.path([[4,8],[4,12]],1,1);
    guide={x:11,y:9};trainer={x:26,y:14};stone={x:8,y:18};sign={x:17,y:10};item={x:27,y:20};b.spawn={x:14,y:12};
    b.objects.push({id:'bridge-north-rail',kind:'fence',x:19,y:10,width:5,height:1,solid:true,sprite:'fence',text:'The current runs swiftly below the bridge.'});
    b.objects.push({id:'bridge-south-rail',kind:'fence',x:19,y:14,width:5,height:1,solid:true,sprite:'fence'});
  }else if(layout==='coast'){
    b.rect(0,0,17,HEIGHT,0);b.rect(17,0,6,4,0);b.rect(12,0,6,HEIGHT,1,true);
    b.path([[16,0],[16,7],[13,7],[13,12],[0,12]]);b.path([[13,12],[31,12]],7);b.path([[16,12],[16,23]],7);
    b.rect(20,10,10,5,7,true);b.rect(3,15,7,5,3,true);b.rect(7,2,4,2,8);
    arrival=b.building(3,3,'house','Shore station');b.path([[4,8],[4,12]],1,1);
    guide={x:12,y:10};trainer={x:25,y:12};stone={x:16,y:17};sign={x:10,y:7};item={x:9,y:21};b.spawn={x:13,y:13};
    b.objects.push({id:'boardwalk-north-rail',kind:'fence',x:21,y:9,width:8,height:1,solid:true,sprite:'fence'});
    b.objects.push({id:'boardwalk-south-rail',kind:'fence',x:21,y:15,width:8,height:1,solid:true,sprite:'fence'});
  }else{
    b.rect(4,5,24,2,8);b.rect(4,11,24,2,8);b.rect(4,17,24,2,8);
    b.path([[16,0],[16,3],[8,3],[8,9],[20,9],[20,15],[10,15],[10,21],[16,21],[16,23]]);
    b.path([[0,12],[2,12],[2,9],[8,9]]);b.path([[31,12],[29,12],[29,15],[20,15]]);
    b.rect(3,19,5,3,3,true);b.rect(12,13,5,3,1,true);b.rect(24,19,4,3,5);
    arrival=b.building(22,2,'lab','Terrace archive');b.path([[25,7],[25,9],[20,9]],1,1);
    guide={x:18,y:14};trainer={x:8,y:9};stone={x:15,y:15};sign={x:17,y:3};item={x:26,y:20};b.spawn={x:20,y:14};
    for(const[x,y]of[[5,8],[14,8],[24,14],[6,15],[18,20]])b.rect(x,y,1,2,8);
  }
  const guideSprites={town:'prof_oak',forest:'hiker',river:'fisher',coast:'lass',ruins:'scientist'};
  const trainerNames={town:'Trainer Rowan',forest:'Scout Bram',river:'Trainer Lena',coast:'Fisher Finn',ruins:'Archivist Sol'};
  b.object({id:'guide',kind:'npc',role:'guide',name:story.npcName,...guide,solid:true,sprite:guideSprites[layout],facing:'south'});
  b.object({id:'trainer',kind:'npc',role:'trainer',name:trainerNames[layout],...trainer,solid:true,sprite:layout==='forest'?'hiker':layout==='coast'?'fisher':'youngster',facing:'south'});
  b.object({id:'waystone',kind:'waystone',name:'Waystone',...stone,solid:true,text:story.hook});
  b.object({id:'route-sign',kind:'sign',name:'Route guide',...sign,solid:true,text:story.name+'. '+story.description+' Visit the local shelter to heal your companions.'});
  b.object({id:'supply-item',kind:'item',name:'Travel supplies',...item,solid:true,item:'potion',text:'A carefully wrapped potion waits for a traveler who needs it.'});
  for(const o of b.objects)for(let y=o.y-1;y<=o.y+(o.height??1);y++)for(let x=o.x-1;x<=o.x+(o.width??1);x++)if(x>=0&&y>=0&&x<WIDTH&&y<HEIGHT)b.protected.add(y*WIDTH+x);
  const rng=random(seed);if(layout!=='forest')for(let i=0;i<WIDTH*HEIGHT;i++)if(b.tiles[i]===0&&!b.protected.has(i)&&rng()<.035)b.tiles[i]=5;
  for(const f of story.features??[])for(let y=f.y;y<f.y+f.height;y++)for(let x=f.x;x<f.x+f.width;x++){
    const i=y*WIDTH+x;if(x>1&&x<WIDTH-2&&y>1&&y<HEIGHT-2&&!b.protected.has(i)&&b.tiles[i]!==6)b.tiles[i]=({trees:2,pond:4,flowers:5,tallGrass:3,stones:8})[f.kind];
  }
  b.finish();const scenes=[interior(layout,arrival)];
  if(layout==='town'){const home=interior('forest',{x:24,y:9});home.id='home';home.name='Willowbrook Home';const resident=home.objects.find(o=>o.role==='healer')!;resident.name='Resident Lia';resident.sprite='lass';resident.text='Come in! Your companions can rest here before your next adventure.';scenes.push(home);}
  installServices(scenes);return {tiles:b.tiles,objects:b.objects,scenes,spawn:b.spawn};
}
export function compileRegion(gx:number,gy:number,worldSeed:string,story?:RegionStory):Region {
  const seed=hashSeed(worldSeed+':'+gx+','+gy),parsed=storySchema.parse(story??fallbackStory(gx,gy,worldSeed));
  const content={id:regionId(gx,gy),gx,gy,seed,...parsed,...makeLayout(layoutFor(gx,gy,parsed),parsed,seed),layoutVersion:LAYOUT_VERSION};
  applyInteriorDesigns(content.scenes,parsed.interiors);applyNpcBehaviors(content,parsed.npcBehaviors);
  const hash=sha256Hex(JSON.stringify(content));
  return {...content,hash,source:gx===0&&gy===0?'authored':story?'codex':'fallback',published:false,createdAt:Date.now()};
}
function reachable(region:Region,start:Point){
  const seen=new Set<number>(),queue=[start.y*WIDTH+start.x];
  for(let n=0;n<queue.length;n++){const i=queue[n],x=i%WIDTH,y=Math.floor(i/WIDTH);if(seen.has(i)||solidAt(region,x,y))continue;seen.add(i);
    if(x>0)queue.push(i-1);if(x<WIDTH-1)queue.push(i+1);if(y>0)queue.push(i-WIDTH);if(y<HEIGHT-1)queue.push(i+WIDTH);
  }return seen;
}
function canReachObject(seen:Set<number>,o:SceneObject){for(let y=o.y;y<o.y+(o.height??1);y++)for(let x=o.x;x<o.x+(o.width??1);x++)for(const[dx,dy]of[[0,1],[0,-1],[1,0],[-1,0]])if(x+dx>=0&&x+dx<WIDTH&&y+dy>=0&&y+dy<HEIGHT&&seen.has((y+dy)*WIDTH+x+dx))return true;return false;}
export function validateRegion(region:Region){
  const validateTiles=(r:Region)=>{if(r.tiles.length!==WIDTH*HEIGHT||r.tiles.some(t=>!Number.isInteger(t)||t<0||t>13))throw new Error('Invalid map dimensions or tile values');};
  const validateObjects=(objects:SceneObject[])=>{const ids=new Set<string>();for(const o of objects){if(ids.has(o.id))throw new Error('Duplicate scene object '+o.id);ids.add(o.id);if(![o.x,o.y,o.width??1,o.height??1].every(Number.isInteger)||o.x<0||o.y<0||(o.width??1)<1||(o.height??1)<1||o.x+(o.width??1)>WIDTH||o.y+(o.height??1)>HEIGHT)throw new Error('Invalid scene object bounds');if(o.kind==='npc'&&(!o.solid||(o.width??1)!==1||(o.height??1)!==1))throw new Error('NPCs must occupy one solid tile');}};
  validateObjects(sceneObjects(region));
  validateTiles(region);const seen=reachable(region,region.spawn??{x:16,y:14});if(!seen.size)throw new Error('Blocked spawn in '+region.id);
  for(const[x,y]of[[16,0],[16,HEIGHT-1],[0,12],[WIDTH-1,12]])if(!seen.has(y*WIDTH+x))throw new Error('Unreachable entrance '+x+','+y+' in '+region.id);
  for(const o of sceneObjects(region))if(['npc','door','sign','item','waystone'].includes(o.kind)&&!canReachObject(seen,o))throw new Error('Unreachable '+o.id+' in '+region.id);
  for(const role of['guide','trainer'])if(!sceneObjects(region).some(o=>o.role===role))throw new Error('Missing tutorial '+role);
  if(![...seen].some(i=>region.tiles[i]===3))throw new Error('Missing reachable practice grass');
  for(const scene of region.scenes??[]){const r=getScene(region,scene.id);validateTiles(r);validateObjects(scene.objects);const inside=reachable(r,scene.spawn);if(!inside.size)throw new Error('Blocked interior spawn '+scene.id);
    if(!scene.objects.some(o=>o.role==='healer')||!scene.objects.some(o=>o.kind==='door'&&o.targetScene==='outdoor'))throw new Error('Interior needs a healer and exit');
    for(const o of scene.objects)if(['npc','door','sign','item','furniture'].includes(o.kind)&&!canReachObject(inside,o))throw new Error('Unreachable interior '+o.id);
  }
  for(const view of[region,...(region.scenes??[]).map(s=>getScene(region,s.id))])for(const o of sceneObjects(view))if(o.kind==='door'){
    if(o.solid||!o.targetScene||!o.arrival)throw new Error('Door needs a walkable destination');
    if(o.targetScene!=='outdoor'&&!region.scenes?.some(s=>s.id===o.targetScene))throw new Error('Unknown door destination');
    const destination=o.targetScene==='outdoor'?region:getScene(region,o.targetScene);if(solidAt(destination,o.arrival.x,o.arrival.y))throw new Error('Blocked door arrival');
  }
  return {reachable:seen.size,exits:4};
}
export interface LayoutMigrationResult {upgraded:number;movedPlayers:number;backupPath?:string}
export function upgradeLegacyLayouts(store:WorldStore,ids?:readonly string[]):LayoutMigrationResult {
  const selected=store.regions().filter(r=>(r.layoutVersion??1)<LAYOUT_VERSION&&(!ids||ids.includes(r.id)));
  if(!selected.length)return {upgraded:0,movedPlayers:0};
  const replacements=new Map(selected.map(old=>{const{name,description,biome,npcName,greeting,hook,features}=old;
    const next=compileRegion(old.gx,old.gy,store.meta('seed')!,{name,description,biome,npcName,greeting,hook,features});
    next.source=old.source;next.published=old.published;next.createdAt=old.createdAt;validateRegion(next);return[old.id,next] as const;}));
  // Startup-only, outside a transaction: include current WAL content in the backup.
  const backupPath=store.backupDatabase?.('pre-layout-v2');let movedPlayers=0;
  store.transaction(()=>{
    for(const region of replacements.values())store.saveRegion(region);
    for(const p of store.players()){
      const outdoor=replacements.get(p.regionId);if(!outdoor)continue;
      if(p.sceneId&&!outdoor.scenes?.some(s=>s.id===p.sceneId)){delete p.sceneId;delete p.returnPosition;}
      const view=getScene(outdoor,p.sceneId),seen=reachable(view,view.spawn!);
      if(!seen.has(p.y*WIDTH+p.x)){
        const nearest=[...seen].sort((a,b)=>Math.abs(a%WIDTH-p.x)+Math.abs(Math.floor(a/WIDTH)-p.y)-Math.abs(b%WIDTH-p.x)-Math.abs(Math.floor(b/WIDTH)-p.y))[0];
        p.x=nearest%WIDTH;p.y=Math.floor(nearest/WIDTH);delete p.movement;movedPlayers++;
      }
      if(p.returnPosition&&solidAt(outdoor,p.returnPosition.x,p.returnPosition.y))p.returnPosition={...outdoor.spawn!};
      store.savePlayer(p);
    }
    store.setMeta('lastLayoutMigrationBackup',backupPath?'backups/'+backupPath.split(/[\\/]/).pop():'unavailable');store.setMeta('layoutVersion',String(LAYOUT_VERSION));
  });return {upgraded:replacements.size,movedPlayers,backupPath};
}
