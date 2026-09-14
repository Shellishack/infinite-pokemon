import { DIRECTIONS,WIDTH,HEIGHT,walkable,type Region,type SceneObject,type Direction,type Point } from './model.js';

export function sceneObjects(region:Region):SceneObject[]{
  return region.objects??[
    {id:'guide',kind:'npc',role:'guide',name:region.npcName,x:16,y:10,solid:true,sprite:'prof_oak'},
    {id:'trainer',kind:'npc',role:'trainer',name:'Trainer Rowan',x:20,y:12,solid:true,sprite:'youngster'},
    {id:'waystone',kind:'waystone',x:18,y:15,solid:true,text:region.hook},
    {id:'sign',kind:'sign',x:19,y:9,solid:true,text:region.description},
  ];
}
export function objectContains(object:SceneObject,x:number,y:number){return x>=object.x&&x<object.x+(object.width??1)&&y>=object.y&&y<object.y+(object.height??1);}
export function solidAt(region:Region,x:number,y:number){
  if(x<0||y<0||x>=WIDTH||y>=HEIGHT)return true;
  return !walkable(region.tiles[y*WIDTH+x])||sceneObjects(region).some(o=>o.solid&&(objectContains(o,x,y)||o.reservedFrom?.x===x&&o.reservedFrom?.y===y));
}
export function objectInFront(region:Region,position:Point,facing:Direction){
  const [dx,dy]=DIRECTIONS[facing];
  const x=position.x+dx,y=position.y+dy;
  const object=sceneObjects(region).find(o=>o.kind!=='building'&&objectContains(o,x,y));
  if(object)return object;
  if(x<0||y<0||x>=WIDTH||y>=HEIGHT)return undefined;
  const scenery:Record<number,[string,string]>={2:['Trees','Dense trees block the way. Follow a clearing to continue.'],4:['Water','The water is too deep to cross here. Look for a bridge or a path along the bank.'],6:['Wall','A solid wall. The entrance is on the front of the building.'],8:['Weathered rocks','These old rocks have been shaped by wind and rain. You will need to go around them.']};
  const description=scenery[region.tiles[y*WIDTH+x]];
  return description?{id:`terrain:${x},${y}`,kind:'furniture' as const,x,y,solid:true,name:description[0],text:description[1],sprite:'terrain'}:undefined;
}
export function getScene(region:Region,sceneId?:string):Region{
  if(!sceneId)return region;
  const scene=region.scenes?.find(s=>s.id===sceneId);
  if(!scene)return region;
  return {...region,sceneId:scene.id,name:scene.name,tiles:scene.tiles,objects:scene.objects,spawn:scene.spawn,theme:scene.theme,hash:`${region.hash}:${scene.id}`};
}
export function roleObject(region:Region,role:'guide'|'trainer'|'healer'){return sceneObjects(region).find(o=>o.role===role);}
export function nearestFree(region:Region,origin:Point):Point{
  const queue=[origin],seen=new Set<string>();
  for(let i=0;i<queue.length;i++){
    const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||p.x<0||p.y<0||p.x>=WIDTH||p.y>=HEIGHT)continue;seen.add(key);
    if(!solidAt(region,p.x,p.y))return p;
    for(const [dx,dy] of Object.values(DIRECTIONS))queue.push({x:p.x+dx,y:p.y+dy});
  }
  throw new Error('No walkable position in scene.');
}
