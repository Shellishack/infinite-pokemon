import {WIDTH,HEIGHT,type Region,type Player,type Direction} from '../shared/model.js';
import {solidAt} from '../shared/scene.js';

const surfaces=['lawn','path','trees','tallGrass','water','flowers','building','bridge','stones','floor','wall','carpet','furniture','bookcase'];
type EdgeSpan={from:number;to:number;surface:string;passable:boolean};
function edge(region:Region,direction:Direction){
  const spans:EdgeSpan[]=[],length=direction==='north'||direction==='south'?WIDTH:HEIGHT;
  for(let i=0;i<length;i++){
    const x=direction==='west'?0:direction==='east'?WIDTH-1:i,y=direction==='north'?0:direction==='south'?HEIGHT-1:i;
    const surface=surfaces[region.tiles[y*WIDTH+x]]??'unknown',passable=!solidAt(region,x,y),last=spans.at(-1);
    if(last&&last.surface===surface&&last.passable===passable)last.to=i;
    else spans.push({from:i,to:i,surface,passable});
  }
  return spans;
}
export function terrainContext(target:Region,nearby:Region[],players:Player[]){
  const adjacent=nearby.filter(region=>Math.abs(region.gx-target.gx)+Math.abs(region.gy-target.gy)===1);
  const opening:Record<string,string>={'0,0':'town','0,-1':'forest','0,1':'river','1,0':'coast','-1,0':'ruins'};
  return {
    blockSize:{width:WIDTH,height:HEIGHT},fixedOpeningLayout:opening[target.id]??null,
    approachBlockIds:adjacent.filter(region=>region.published&&players.some(player=>player.regionId===region.id)).map(region=>region.id),
    neighborEdges:adjacent.map(region=>{
      const sideOfTarget:Direction=region.gx<target.gx?'west':region.gx>target.gx?'east':region.gy<target.gy?'north':'south';
      const opposite:Record<Direction,Direction>={west:'east',east:'west',north:'south',south:'north'};
      const mix:Record<string,number>={};for(const tile of region.tiles){const surface=surfaces[tile]??'unknown';mix[surface]=(mix[surface]??0)+1;}
      return {blockId:region.id,status:region.published?'observed':'planned',hash:region.hash,biome:region.biome,sideOfTarget,edgeFacingTarget:opposite[sideOfTarget],edge:edge(region,opposite[sideOfTarget]),surfaceMix:mix};
    }),
  };
}

export const generationCapabilities={schema:'region-story-v3',npcMovement:true,generativeInteriors:true,geometry:'protected-templates',biomes:['meadow','forest','coast','ruins'],features:['trees','pond','flowers','tallGrass','stones'],creatureProfiles:true,creatureTraits:true,hybridBreeding:true,shopGoods:true,vehicles:true,pixelArtRecipes:true,customBuildingPlacement:false,worldRegionRegistry:false,dojoMasters:false,trading:false,imageGeneration:false,assetImport:false} as const;
