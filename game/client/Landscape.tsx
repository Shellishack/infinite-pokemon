import { useEffect,useRef } from 'react';
import { WIDTH,HEIGHT,TILE } from '../shared/model';
import { drawMap,drawAvatar,previewRegion } from './pixels';
import { loadClassicAssets } from './classic-assets';
export function Landscape(){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{let active=true;const render=()=>{if(!active||!ref.current)return;const c=ref.current.getContext('2d')!;drawMap(c,previewRegion());drawAvatar(c,16*TILE,14*TILE-9,0);};render();void loadClassicAssets().then(render);return()=>{active=false;};},[]);return <canvas className="landscape" ref={ref} width={WIDTH*TILE} height={HEIGHT*TILE} aria-label="Pixel art of Willowbrook, with a healing house, forest, pond, and winding paths"/>;}
