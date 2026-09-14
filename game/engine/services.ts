import type {Region,RegionScene} from '../shared/model.js';
import {solidAt} from '../shared/scene.js';

export function installServices(scenes:RegionScene[]){
  let changed=false;
  for(const scene of scenes){
    for(const service of [{id:'room-shop',role:'merchant' as const,name:'Travel merchant',sprite:'fisher',candidates:[[20,16],[19,16],[21,17]]},{id:'room-nursery',role:'breeder' as const,name:'Nursery keeper',sprite:'lass',candidates:[[12,16],[13,16],[12,17]]}]){
      if(scene.objects.some(object=>object.id===service.id))continue;
      const point=service.candidates.find(([x,y])=>!solidAt({tiles:scene.tiles,objects:scene.objects} as Region,x,y));if(!point)continue;
      scene.objects.push({id:service.id,kind:'npc',role:service.role,name:service.name,sprite:service.sprite,x:point[0],y:point[1],facing:'south',solid:true,text:service.role==='merchant'?'Welcome! Browse supplies and rides for your journey.':'Choose two grown companions and we will care for their egg.'});changed=true;
    }
  }
  return changed;
}
