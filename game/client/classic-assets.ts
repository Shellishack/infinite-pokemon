const images=new Map<string,HTMLImageElement>();
let promise:Promise<void>|undefined;
export interface TerrainManifest { columns?:number; named?:Record<string,number>; blocks?:Record<string,number[][]>; [key:string]:unknown }
let terrain:TerrainManifest|null=null;
export function classicImage(name:string){return images.get(name);}
export function terrainManifest(){return terrain;}
export function loadClassicAssets(){
  if(promise)return promise;
  const people=['red_normal','green_normal','red_bike','green_bike','prof_oak','youngster','nurse','hiker','lass','fisher','scientist'];
  const species=['bulbasaur','charmander','squirtle','pikachu','oddish','pidgey'];
  const files=[...people.map(n=>[`people/${n}`,`/classic/people/${n}.png`]),...species.flatMap(n=>[[`pokemon/${n}`,`/classic/pokemon/${n}.png`],[`pokemon/${n}-back`,`/classic/pokemon/${n}-back.png`]])];
  const load=(name:string,url:string)=>new Promise<void>((resolve)=>{const image=new Image();image.onload=()=>{images.set(name,image);resolve();};image.onerror=()=>resolve();image.src=url;});
  promise=Promise.all([...files.map(([name,url])=>load(name,url)),load('interior','/classic/interior/tiles.png'),fetch('/classic/terrain.json').then(async r=>{if(r.ok){terrain=await r.json();await load('terrain','/classic/terrain.png');}}).catch(()=>{})]).then(()=>{});
  return promise;
}
