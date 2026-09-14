import {WIDTH,type Region,type RegionScene} from '../shared/model.js';
import {interiorDesignSchema,npcBehaviorBindingSchema,type InteriorDesign,type NpcBehaviorBinding} from '../shared/world-design.js';
import {objectContains,solidAt} from '../shared/scene.js';

export function applyInteriorDesigns(scenes:RegionScene[],designs:InteriorDesign[]){
  const seen=new Set<string>();
  for(const proposal of designs){
    const design=interiorDesignSchema.parse(proposal),scene=scenes.find(scene=>scene.id===design.sceneId);
    if(!scene||seen.has(scene.id))throw new Error('Unknown or duplicate interior design');seen.add(scene.id);
    // Only furniture and floor coverings can be redesigned. Services and doors stay.
    for(const object of scene.objects.filter(object=>object.kind==='furniture'))for(let y=object.y;y<object.y+(object.height??1);y++)for(let x=object.x;x<object.x+(object.width??1);x++)scene.tiles[y*WIDTH+x]=9;
    scene.objects=scene.objects.filter(object=>object.kind!=='furniture');scene.name=design.name;
    const valid=(x:number,y:number)=>x>=9&&x<=22&&y>=5&&y<=18&&scene.tiles[y*WIDTH+x]!==10;
    for(const rug of design.rugs)for(let y=rug.y;y<rug.y+rug.height;y++)for(let x=rug.x;x<rug.x+rug.width;x++){
      if(!valid(x,y))throw new Error('Rug exceeds room bounds');scene.tiles[y*WIDTH+x]=11;
    }
    for(const [index,furniture] of design.furniture.entries()){
      for(let y=furniture.y;y<furniture.y+furniture.height;y++)for(let x=furniture.x;x<furniture.x+furniture.width;x++){
        if(!valid(x,y)||x===scene.spawn.x&&y===scene.spawn.y||scene.objects.some(object=>objectContains(object,x,y)))throw new Error('Furniture overlaps a protected object or room boundary');
      }
      scene.objects.push({...furniture,id:'generated-furniture-'+index,kind:'furniture',solid:true,sprite:furniture.kind});
      for(let y=furniture.y;y<furniture.y+furniture.height;y++)for(let x=furniture.x;x<furniture.x+furniture.width;x++)scene.tiles[y*WIDTH+x]=furniture.kind==='bookcase'?13:12;
    }
  }
}
export function applyNpcBehaviors(region:Pick<Region,'objects'|'scenes'|'tiles'>,bindings:NpcBehaviorBinding[]){
  const seen=new Set<string>();
  for(const proposal of bindings){
    const binding=npcBehaviorBindingSchema.parse(proposal),key=binding.sceneId+':'+binding.npcId;
    const objects=binding.sceneId==='outdoor'?region.objects:region.scenes?.find(scene=>scene.id===binding.sceneId)?.objects;
    const npc=objects?.find(object=>object.kind==='npc'&&object.id===binding.npcId);
    if(!npc||seen.has(key))throw new Error('Unknown or duplicate NPC behavior target');seen.add(key);
    if(['healer','merchant','breeder'].includes(npc.role??'')&&binding.behavior.movement!=='stationary')throw new Error('Service NPCs must stay at their service station');
    if(binding.behavior.movement==='patrol'&&!binding.behavior.waypoints.length)throw new Error('A patrol needs waypoints');
    if(binding.behavior.waypoints.some(point=>Math.abs(point.x)+Math.abs(point.y)>binding.behavior.radius))throw new Error('Patrol exceeds home radius');
    const tiles=binding.sceneId==='outdoor'?region.tiles:region.scenes!.find(scene=>scene.id===binding.sceneId)!.tiles;
    const space={tiles,objects} as Region;
    if(binding.behavior.waypoints.some(point=>(point.x!==0||point.y!==0)&&solidAt(space,npc.x+point.x,npc.y+point.y)))throw new Error('Patrol waypoint is blocked');
    npc.behavior=binding.behavior;
  }
}
