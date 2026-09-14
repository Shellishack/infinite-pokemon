import {type Region} from '../shared/model.js';
import {sceneObjects} from '../shared/scene.js';
export function designContext(region:Region){
  return {
    npcActors:[{id:'outdoor',objects:sceneObjects(region)},...(region.scenes??[])].flatMap(scene=>scene.objects.filter(object=>object.kind==='npc').map(object=>({sceneId:scene.id,npcId:object.id,role:object.role,home:{x:object.x,y:object.y},behavior:object.behavior??null,stationaryRequired:['healer','merchant','breeder'].includes(object.role??'')}))),
    interiorSpaces:(region.scenes??[]).map(scene=>({sceneId:scene.id,name:scene.name,floorBounds:{x:9,y:5,width:14,height:14},spawn:scene.spawn,protectedObjects:scene.objects.filter(object=>object.kind!=='furniture'),currentFurniture:scene.objects.filter(object=>object.kind==='furniture')})),
  };
}
