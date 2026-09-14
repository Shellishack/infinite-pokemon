import {DIRECTIONS,WIDTH,HEIGHT,type Region,type Player,type SceneObject,type MovementState} from '../shared/model.js';
import {getScene,sceneObjects,solidAt,objectContains} from '../shared/scene.js';
import type {Store} from '../server/store.js';
import type {NpcBehavior} from '../shared/world-design.js';

interface Pose {x:number;y:number;facing:keyof typeof DIRECTIONS;step:number;nextAt:number;sourceHash:string;motion?:MovementState;waypoint:number}
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const protectedRole=(npc:SceneObject)=>['healer','merchant','breeder'].includes(npc.role??'');
export class NpcRuntime {
  constructor(private store:Store){}
  private key(region:Region,npc:SceneObject){return `${region.id}:${region.sceneId??'outdoor'}:${npc.id}`;}
  private pose(region:Region,npc:SceneObject):Pose|undefined{
    const row=this.store.db.prepare('SELECT data FROM npc_motion WHERE id=?').get(this.key(region,npc));
    const pose=row?JSON.parse(String(row.data)) as Pose:undefined;return pose?.sourceHash===(region.staticHash??region.hash)?pose:undefined;
  }
  scene(region:Region,sceneId?:string,now=Date.now()):Region{
    const scene=getScene(region,sceneId),staticHash=scene.staticHash??scene.hash;
    const objects=sceneObjects(scene).map(object=>{
      if(object.kind!=='npc'||protectedRole(object))return object;
      const pose=this.pose(scene,object);if(!pose)return object;
      const moving=pose.motion&&now<pose.motion.startedAt+pose.motion.duration;
      return {...object,x:pose.x,y:pose.y,facing:pose.facing,motion:pose.motion,reservedFrom:moving?{x:pose.motion!.fromX,y:pose.motion!.fromY}:undefined};
    });
    return {...scene,staticHash,objects,hash:staticHash+':actors:'+JSON.stringify(objects.filter(o=>o.kind==='npc').map(o=>[o.id,o.x,o.y,o.reservedFrom,o.motion?.seq]))};
  }
  tick(players:Player[],now:number){
    const locations=new Map<string,{region:Region;sceneId?:string;players:Player[]}>();
    for(const player of players){const region=this.store.region(player.regionId);if(!region)continue;const key=region.id+':'+(player.sceneId??'outdoor');const location=locations.get(key)??{region,sceneId:player.sceneId,players:[]};location.players.push(player);locations.set(key,location);}
    for(const {region,sceneId,players:nearby} of locations.values()){
      if(nearby.some(player=>player.battle&&!player.battle.finished))continue;
      const base=getScene(region,sceneId);
      for(const home of sceneObjects(base).filter(object=>object.kind==='npc'&&!protectedRole(object))){
        const behavior:NpcBehavior|undefined=home.id==='guide'&&!sceneId?this.store.npc(region.id).behavior??home.behavior:home.behavior;
        if(!behavior||behavior.movement==='stationary')continue;
        const pose=this.pose(base,home)??{x:home.x,y:home.y,facing:home.facing??'south',step:0,nextAt:0,sourceHash:base.hash,waypoint:0};
        if(now<pose.nextAt||nearby.some(player=>distance(player,pose)<=2))continue;
        const scene=this.scene(region,sceneId,now);
        const without={...scene,objects:sceneObjects(scene).filter(object=>object.id!==home.id)};
        const occupied=(x:number,y:number)=>nearby.some(player=>player.x===x&&player.y===y||!!player.movement?.accepted&&now<player.movement.startedAt+player.movement.duration&&player.movement.fromX===x&&player.movement.fromY===y);
        const legal=(x:number,y:number)=>!solidAt(without,x,y)&&!sceneObjects(without).some(object=>objectContains(object,x,y))&&!occupied(x,y)&&x>0&&y>0&&x<WIDTH-1&&y<HEIGHT-1&&distance({x,y},base.spawn??{x:16,y:14})>1&&!sceneObjects(scene).some(object=>object.kind==='door'&&distance({x,y},object)<=1);
        let choices=Object.entries(DIRECTIONS) as [keyof typeof DIRECTIONS,readonly[number,number]][];
        if(behavior.movement==='patrol'&&behavior.waypoints.length){
          let target=behavior.waypoints[pose.waypoint%behavior.waypoints.length];
          if(pose.x===home.x+target.x&&pose.y===home.y+target.y){pose.waypoint++;target=behavior.waypoints[pose.waypoint%behavior.waypoints.length];}
          const goal={x:home.x+target.x,y:home.y+target.y};
          const queue=[{x:pose.x,y:pose.y,first:undefined as keyof typeof DIRECTIONS|undefined}],seen=new Set<string>();let first:keyof typeof DIRECTIONS|undefined;
          for(let i=0;i<queue.length;i++){const point=queue[i],key=point.x+','+point.y;if(seen.has(key))continue;seen.add(key);if(distance(point,goal)===0){first=point.first;break;}for(const [direction,[dx,dy]] of choices){const x=point.x+dx,y=point.y+dy;if(legal(x,y)&&distance({x,y},home)<=behavior.radius)queue.push({x,y,first:point.first??direction});}}
          choices=first?choices.filter(([direction])=>direction===first):[];
        }else{const offset=(pose.step+home.id.split('').reduce((sum,c)=>sum+c.charCodeAt(0),0))%4;choices=[...choices.slice(offset),...choices.slice(0,offset)];}
        for(const [facing,[dx,dy]] of choices){
          const x=pose.x+dx,y=pose.y+dy;if(!legal(x,y)||distance({x,y},home)>behavior.radius)continue;
          const candidate={...scene,objects:sceneObjects(scene).map(object=>object.id===home.id?{...object,x,y,reservedFrom:{x:pose.x,y:pose.y}}:object)};
          if(!this.keepsAccess(candidate,nearby))continue;
          pose.motion={seq:pose.step+1,fromX:pose.x,fromY:pose.y,toX:x,toY:y,startedAt:now,duration:320,accepted:true};pose.x=x;pose.y=y;pose.facing=facing;break;
        }
        pose.step++;pose.nextAt=now+behavior.intervalSeconds*1000;
        this.store.db.prepare('INSERT INTO npc_motion VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(this.key(base,home),JSON.stringify(pose));
      }
    }
  }
  private keepsAccess(scene:Region,players:Player[]){
    const start=scene.spawn??{x:16,y:14},queue=[start],seen=new Set<number>();
    for(let i=0;i<queue.length;i++){const p=queue[i],key=p.y*WIDTH+p.x;if(seen.has(key)||solidAt(scene,p.x,p.y))continue;seen.add(key);for(const [dx,dy]of Object.values(DIRECTIONS)){const x=p.x+dx,y=p.y+dy;if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT)queue.push({x,y});}}
    if(players.some(player=>!seen.has(player.y*WIDTH+player.x)))return false;
    if(!scene.sceneId&&[[16,0],[16,HEIGHT-1],[0,12],[WIDTH-1,12]].some(([x,y])=>!seen.has(y*WIDTH+x)))return false;
    return sceneObjects(scene).filter(object=>['npc','door','sign','item','waystone'].includes(object.kind)).every(object=>{
      for(let y=object.y;y<object.y+(object.height??1);y++)for(let x=object.x;x<object.x+(object.width??1);x++)for(const[dx,dy]of Object.values(DIRECTIONS)){const px=x+dx,py=y+dy;if(px>=0&&px<WIDTH&&py>=0&&py<HEIGHT&&!objectContains(object,px,py)&&seen.has(py*WIDTH+px))return true;}return false;
    });
  }
}
