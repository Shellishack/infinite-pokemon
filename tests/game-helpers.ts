import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WIDTH,HEIGHT,WALK_MS,DIRECTIONS,type Action,type Direction,type Point,type SceneObject } from '../game/shared/model.js';
import { getScene,sceneObjects,solidAt } from '../game/shared/scene.js';
import type { World } from '../game/engine/world.js';

export function command(world:World,pid:string,action:Action){
  const p=world.store.player(pid)!,time=Math.max(world.now(),p.movement?.startedAt??0,(p.movement?.startedAt??0)+(p.movement?.duration??0))+WALK_MS;
  world.now=()=>time;return world.apply(pid,randomUUID(),action);
}
export function scene(world:World,pid:string){const p=world.store.player(pid)!,region=getScene(world.store.region(p.regionId)!,p.sceneId);return {...region,objects:sceneObjects(region).filter(o=>o.kind!=='item'||!p.collectedItems?.includes(`${p.regionId}:${p.sceneId??'outdoor'}:${o.id}`))};}
export function object(world:World,pid:string,idOrRole:string){const target=sceneObjects(scene(world,pid)).find(o=>o.id===idOrRole||o.role===idOrRole||o.kind===idOrRole);assert.ok(target,`Missing object ${idOrRole}`);return target;}
export function adjacent(world:World,pid:string,target:SceneObject){const region=scene(world,pid);for(const [facing,[dx,dy]] of Object.entries(DIRECTIONS) as [Direction,readonly[number,number]][]){const point={x:target.x-dx,y:target.y-dy};if(!solidAt(region,point.x,point.y)&&region.tiles[point.y*WIDTH+point.x]!==3)return {...point,facing};}throw new Error(`No clear interaction cell for ${target.id}`);}
export function standFacing(world:World,pid:string,idOrRole:string){const p=world.store.player(pid)!,target=object(world,pid,idOrRole);Object.assign(p,adjacent(world,pid,target));p.movement=undefined;world.lastMove.delete(pid);world.store.savePlayer(p);return p;}
export function pathTo(world:World,pid:string,goal:Point){
  const p=world.store.player(pid)!,region=scene(world,pid),queue:[Point,Direction[]][]=[[{x:p.x,y:p.y},[]]],seen=new Set<string>();
  for(let i=0;i<queue.length;i++){const [point,path]=queue[i],key=`${point.x},${point.y}`;if(seen.has(key))continue;seen.add(key);if(point.x===goal.x&&point.y===goal.y)return path;
    for(const [direction,[dx,dy]] of Object.entries(DIRECTIONS) as [Direction,readonly[number,number]][]){const next={x:point.x+dx,y:point.y+dy};if(!solidAt(region,next.x,next.y)&&region.tiles[next.y*WIDTH+next.x]!==3&&!sceneObjects(region).some(o=>o.kind==='door'&&o.x===next.x&&o.y===next.y))queue.push([next,[...path,direction]]);}
  }throw new Error(`No clear path to ${goal.x},${goal.y} in ${region.name}`);
}
export function walkTo(world:World,pid:string,goal:Point){for(const direction of pathTo(world,pid,goal)){const result=command(world,pid,{kind:'move',direction});assert.equal(result.movement?.accepted,true,result.text??result.code);}}
export function visit(world:World,pid:string,idOrRole='guide'){
  const target=object(world,pid,idOrRole),point=adjacent(world,pid,target);walkTo(world,pid,point);
  const p=world.store.player(pid)!;p.facing=point.facing;world.store.savePlayer(p);
}
export function travel(world:World,pid:string,direction:Direction){
  const edge=direction==='north'?{x:16,y:0}:direction==='south'?{x:16,y:HEIGHT-1}:direction==='west'?{x:0,y:12}:{x:WIDTH-1,y:12};
  walkTo(world,pid,edge);const result=command(world,pid,{kind:'move',direction});assert.equal(result.movement?.accepted,true,result.text??result.code);visit(world,pid);
}
