// Maintainer-only asset build. Preview gameplay reads the committed JSON pack directly.
import { mkdirSync,writeFileSync } from 'node:fs';
import { compileRegion,validateRegion,LAYOUT_VERSION } from '../game/engine/maps.js';
const seed='willow-preview-v1';
const regions=[[0,0],[0,-1],[0,1],[-1,0],[1,0]].map(([gx,gy])=>{const region=compileRegion(gx,gy,seed);region.source='authored';region.published=true;region.createdAt=0;validateRegion(region);return region;});
mkdirSync('game/content',{recursive:true});writeFileSync('game/content/tutorial-world.json',JSON.stringify({version:LAYOUT_VERSION,seed,name:'Willow Valley',regions},null,2)+'\n');
