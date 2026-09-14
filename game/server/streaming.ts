import {randomUUID} from 'node:crypto';
import type {World} from '../engine/world.js';
import type {Generator} from './harness.js';
import type {Player,Region,Direction} from '../shared/model.js';
import {mapPrepared,type StreamingState} from '../shared/streaming.js';

interface PendingTravel {targetId:string;originId:string;sceneId?:string;x:number;y:number;direction:Direction}
export class MapStreaming {
  pending=new Map<string,PendingTravel>();
  constructor(public world:World,public generator:Generator,private preview:()=>boolean){
    world.canEnter=(player,target,direction)=>{
      if(this.preview()||mapPrepared(target))return true;
      this.pending.set(player.id,{targetId:target.id,originId:player.regionId,sceneId:player.sceneId,x:player.x,y:player.y,direction});this.refresh();return false;
    };
  }
  origins():Region[]{
    const players=this.world.store.players(),online=players.filter(player=>this.world.online.has(player.id));
    const selected=online.length?online:players.filter(player=>player.id===this.world.store.meta('hostPlayerId')).slice(0,1);
    const ids=[...new Set((selected.length?selected:players.slice(0,1)).map(player=>player.regionId))];
    if(!ids.length)ids.push('0,0');return ids.map(id=>this.world.store.region(id)).filter((region):region is Region=>!!region);
  }
  plan():Region[]{
    const origins=this.origins(),regions=new Map<string,Region>();
    for(const origin of origins)for(const region of this.world.neighbors(origin))regions.set(region.id,region);
    for(const travel of this.pending.values()){const region=this.world.store.region(travel.targetId);if(region)regions.set(region.id,region);}
    const distance=(region:Region)=>Math.min(...origins.map(origin=>Math.abs(origin.gx-region.gx)+Math.abs(origin.gy-region.gy)));
    const demanded=new Set([...this.pending.values()].map(travel=>travel.targetId));
    return [...regions.values()].sort((a,b)=>distance(a)-distance(b)||Number(demanded.has(b.id))-Number(demanded.has(a.id))||a.id.localeCompare(b.id));
  }
  refresh(){if(this.preview())return;this.generator.setMapQueue(this.plan());void this.generator.pump();}
  cancel(pid:string){this.pending.delete(pid);this.refresh();}
  retry(pid:string){const travel=this.pending.get(pid);if(travel){this.generator.retryMap(travel.targetId);this.refresh();}}
  tick(){
    for(const [pid,travel] of this.pending){
      const player=this.world.store.player(pid);
      if(!player||!this.world.online.has(pid)||player.regionId!==travel.originId||player.sceneId!==travel.sceneId||player.x!==travel.x||player.y!==travel.y){this.pending.delete(pid);continue;}
      if(!mapPrepared(this.world.store.region(travel.targetId)))continue;
      this.pending.delete(pid);
      const result=this.world.apply(pid,randomUUID(),{kind:'move',direction:travel.direction});
      if(result.code==='MOVE_TOO_FAST')this.pending.set(pid,travel);
    }
  }
  view(pid:string):StreamingState {
    const player=this.world.store.player(pid),origin=player&&this.world.store.region(player.regionId),depth=this.world.renderDepth();
    const nearby=origin?this.world.store.regions().filter(region=>{const distance=Math.abs(region.gx-origin.gx)+Math.abs(region.gy-origin.gy);return distance>0&&distance<=depth;}):[];
    const travel=this.pending.get(pid);
    const active=[...this.generator.mapJobs].filter(([,job])=>job.phase==='generating').map(([id])=>id);
    const queued=this.generator.queue.length,target=active[0]??this.generator.queue[0];
    const background=!this.preview()&&target?{active:active.length,queued,phase:this.generator.mapProgress(target).phase}:undefined;
    return {depth,nearbyReady:nearby.filter(mapPrepared).length,nearbyTotal:nearby.length,queued,background,travel:travel?this.generator.mapProgress(travel.targetId):undefined};
  }
}
