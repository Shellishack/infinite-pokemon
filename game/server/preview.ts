import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYOUT_VERSION, upgradeLegacyLayouts, validateRegion } from '../engine/maps.js';
import type { Region } from '../shared/model.js';
import type { Store } from './store.js';

export const PREVIEW_REGION_IDS=new Set(['0,0','0,-1','0,1','-1,0','1,0']);
export function loadPreviewPack(store:Store){
  const priorVersion=store.meta('previewPackVersion');
  if(priorVersion===String(LAYOUT_VERSION))return;
  if(priorVersion==='1'){
    if([...PREVIEW_REGION_IDS].some(id=>!store.region(id)))throw new Error('The existing tutorial save is missing a prepared map.');
    upgradeLegacyLayouts(store,[...PREVIEW_REGION_IDS]);
    store.setMeta('previewPackVersion',String(LAYOUT_VERSION));return;
  }
  if(priorVersion)throw new Error('This tutorial save uses an unsupported pack version.');
  if(store.regions().length||store.players().length)throw new Error('A tutorial preview cannot replace an existing full world.');
  const pack=JSON.parse(readFileSync(resolve('game/content/tutorial-world.json'),'utf8')) as {version:number;seed:string;name:string;regions:Region[]};
  if(pack.version!==LAYOUT_VERSION||pack.regions.length!==5||new Set(pack.regions.map(r=>r.id)).size!==5||pack.regions.some(r=>!PREVIEW_REGION_IDS.has(r.id)||r.source!=='authored'||r.layoutVersion!==LAYOUT_VERSION||!r.published))throw new Error('The prepared tutorial pack is invalid.');
  for(const region of pack.regions)validateRegion(region);
  store.transaction(()=>{store.setMeta('seed',pack.seed);store.setMeta('name',pack.name);store.setMeta('previewPackVersion',String(pack.version));store.setMeta('layoutVersion',String(LAYOUT_VERSION));store.setMeta('previewPromoted','false');store.setMeta('sessionMode','singleplayer');for(const region of pack.regions)store.saveRegion(region);});
}
