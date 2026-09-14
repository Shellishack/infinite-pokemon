import tutorialPack from '../content/tutorial-world.json';
import { SPECIES, WIDTH, HEIGHT, TILE, type Species, type Region } from '../shared/model';
import { classicImage, terrainManifest } from './classic-assets';
type Ctx = CanvasRenderingContext2D;
const rect=(c:Ctx,color:string,x:number,y:number,w:number,h:number)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};

export function drawTile(c:Ctx,t:number,x:number,y:number,seed=0,biome='meadow'){
  rect(c,biome==='forest'?'#71ad70':biome==='coast'?'#a1c785':biome==='ruins'?'#94b19b':'#8dc475',x,y,16,16);
  const noise=(x*7+y*13+seed)%11;
  if(t===0||t===5){rect(c,'#9bce7e',x+((noise+2)%12),y+4,2,1);rect(c,'#77b66b',x+8,y+11,2,1);if(t===5){rect(c,'#5c995a',x+7,y+7,2,5);rect(c,'#f5e3a0',x+5,y+5,6,3);rect(c,'#f4b674',x+7,y+6,2,2);}}
  if(t===1||t===7){rect(c,'#e4ca90',x,y,16,16);rect(c,'#edd69f',x,y,16,2);rect(c,'#d8bc83',x+noise%10+2,y+6,2,1);rect(c,'#cdb47b',x+11,y+12,2,1);}
  if(t===2){rect(c,'#53895b',x+3,y+12,10,3);rect(c,'#88694b',x+6,y+9,4,6);rect(c,'#35694f',x+3,y+3,10,9);rect(c,'#35694f',x+1,y+6,14,5);rect(c,'#4b9360',x+3,y+1,10,8);rect(c,'#4b9360',x+1,y+4,14,5);rect(c,'#6eae6b',x+5,y+2,5,3);rect(c,'#79b675',x+3,y+5,3,2);rect(c,'#367953',x+8,y+8,6,3);}
  if(t===3){rect(c,'#73af64',x,y,16,16);for(let i=0;i<4;i++){const a=x+i*4;rect(c,'#417b51',a,y+5,1,6);rect(c,'#53975a',a+1,y+3,1,6);rect(c,'#bddb85',a+2,y+2,1,3);rect(c,'#5c9e5e',a+1,y+12,1,4);rect(c,'#39754d',a+3,y+10,1,5);}}
  if(t===4){rect(c,'#569aa8',x,y,16,16);rect(c,'#77b7bd',x+3,y+4,7,1);rect(c,'#91c8c7',x+5,y+5,3,1);rect(c,'#3c869a',x+10,y+12,5,1);}
  if(t===6)rect(c,'#c5ba85',x,y,16,16);
  if(t===8){rect(c,'#657f78',x+2,y+5,12,9);rect(c,'#a7b8a5',x+3,y+3,10,9);rect(c,'#c6ceae',x+4,y+4,7,2);rect(c,'#839b86',x+6,y+8,2,4);rect(c,'#759678',x+1,y+12,5,3);}
}
export function drawHouse(c:Ctx,x:number,y:number){
  rect(c,'#668761',x+2,y+47,96,6);rect(c,'#725c4d',x+7,y+17,82,34);rect(c,'#f0e5bb',x+9,y+23,78,26);
  rect(c,'#377b91',x+1,y+12,94,16);rect(c,'#29647e',x+5,y+8,86,7);rect(c,'#579bb0',x+10,y+5,76,7);
  for(let i=0;i<6;i++)rect(c,'#6eacbb',x+12+i*12,y+9,8,2);
  rect(c,'#b5dce0',x+18,y+31,15,12);rect(c,'#b5dce0',x+64,y+31,15,12);
  rect(c,'#5c8190',x+24,y+31,2,12);rect(c,'#5c8190',x+70,y+31,2,12);rect(c,'#5c8190',x+18,y+36,15,2);rect(c,'#5c8190',x+64,y+36,15,2);
  rect(c,'#785c4d',x+42,y+30,14,21);rect(c,'#a1825e',x+44,y+32,10,18);rect(c,'#f2cf76',x+51,y+39,2,2);
  rect(c,'#f4ecce',x+41,y+8,17,12);rect(c,'#dd7163',x+47,y+10,5,8);rect(c,'#dd7163',x+44,y+13,11,3);
}
export function drawAvatar(c:Ctx,x:number,y:number,color=0,frame=0){
  const sheet=classicImage(`people/${color%2?'green_normal':'red_normal'}`);
  if(sheet){c.drawImage(sheet,(frame%9)*16,0,16,32,x,y-11,16,32);return;}
  const coats=['#d86559','#5b8fc7','#d3a858','#9979ba','#5da899','#d887a7'];
  rect(c,'#557a56',x+3,y+18,11,3);rect(c,'#263f46',x+4,y+14,4,6);rect(c,'#263f46',x+10,y+14,3,6);
  rect(c,'#32494e',x+3+(frame%2),y+19,5,2);rect(c,'#32494e',x+10-(frame%2),y+19,5,2);
  rect(c,coats[color%6],x+3,y+10,11,7);rect(c,'#f0d09f',x+1,y+11,3,5);rect(c,'#f0d09f',x+14,y+11,2,5);
  rect(c,'#33494a',x+4,y+3,10,8);rect(c,'#f1cba0',x+4,y+5,10,6);rect(c,'#343e43',x+6,y+7,1,2);rect(c,'#343e43',x+11,y+7,1,2);
  rect(c,'#263f46',x+3,y+2,12,4);rect(c,coats[color%6],x+4,y,10,4);rect(c,'#f4eac2',x+7,y+1,4,2);rect(c,'#f0e3b8',x+2,y+4,14,2);
  rect(c,'#f1d377',x+7,y+11,3,5);
}
export function drawCreature(c:Ctx,species:Species,x:number,y:number,size=64,back=false){
  const sprite=classicImage(`pokemon/${species}${back?'-back':''}`);if(sprite){c.imageSmoothingEnabled=false;c.drawImage(sprite,x,y,size,size);return;}
  c.save();c.translate(x,y);c.scale(size/32,size/32);
  const r=(color:string,a:number,b:number,w:number,h:number)=>rect(c,color,a,b,w,h);
  const eye=(a:number,b:number)=>{if(!back){r('#fcf5db',a,b,3,4);r('#263d42',a+1,b+1,2,3);r('#fff9e2',a+1,b+1,1,1);}};
  r('#00000018',7,28,20,2);
  if(species==='bulbasaur'){
    r('#356a56',5,15,21,10);r('#75b68a',4,14,22,10);r('#47826a',5,24,5,4);r('#47826a',20,24,5,4);r('#8bcca0',5,12,13,11);r('#53976f',5,8,4,7);r('#53976f',13,8,4,7);
    r('#315f4f',18,6,8,11);r('#4b9755',16,8,13,9);r('#84b965',18,5,8,8);r('#a6cd77',21,4,3,8);r('#33744f',24,10,3,6);eye(6,15);eye(13,15);r('#3b7b64',9,22,4,2);r('#417d65',21,19,3,2);
  }else if(species==='charmander'){
    r('#ae5f42',11,10,12,16);r('#e89758',10,9,12,16);r('#f2bf73',13,17,7,9);r('#f0a567',9,5,14,11);r('#d7804e',8,8,16,6);r('#f0a567',10,7,12,7);r('#cc7645',8,25,6,3);r('#cc7645',19,25,6,3);
    r('#cf7646',23,21,5,3);r('#e79956',26,15,3,7);r('#e16b46',27,10,4,7);r('#ffd66a',28,12,2,4);eye(11,9);eye(18,9);r('#b06443',14,14,4,1);r('#e99b62',6,17,5,4);
  }else if(species==='squirtle'){
    r('#775e43',14,13,13,13);r('#ba945b',16,14,10,11);r('#e3ce85',17,15,2,9);r('#e3ce85',16,19,10,2);r('#6babb9',7,15,13,10);r('#ecd59b',10,18,8,8);r('#80c4ca',6,5,16,13);r('#65a6b7',6,10,17,7);
    r('#7fc3ca',8,7,12,8);r('#528a9e',7,25,6,3);r('#528a9e',20,24,6,4);r('#72b6c1',25,22,5,3);eye(8,9);eye(16,9);r('#679fae',4,18,5,4);
  }else if(species==='pikachu'){
    r('#dba947',9,13,15,14);r('#f1cc58',8,12,15,14);r('#f5d366',6,8,19,12);r('#f2ca51',6,2,4,10);r('#293e42',6,1,4,3);r('#f2ca51',21,1,4,11);r('#293e42',21,0,4,3);
    r('#e9b647',7,26,6,3);r('#e9b647',19,26,6,3);r('#dd6350',7,15,4,3);r('#dd6350',20,15,4,3);r('#f2cc55',25,19,5,4);r('#f2cc55',27,13,4,7);r('#f2cc55',24,10,7,4);eye(10,11);eye(17,11);r('#866647',14,18,3,1);
  }else if(species==='oddish'){
    r('#405778',7,14,18,13);r('#5d7597',8,13,16,12);r('#84a1ad',10,15,3,3);r('#415d79',6,26,7,3);r('#415d79',20,26,7,3);
    r('#326c4f',14,5,5,11);r('#64a562',7,4,8,5);r('#64a562',18,3,8,6);r('#8abb6f',13,1,6,9);r('#3e8354',4,8,11,4);r('#3e8354',19,8,10,4);eye(10,17);eye(19,17);
  }else{
    r('#826648',8,13,17,13);r('#c5a274',9,10,16,15);r('#e6ca91',12,14,11,12);r('#967344',6,7,15,11);r('#dfbb83',7,5,12,11);r('#604c3e',14,2,7,5);r('#d6b072',21,18,7,7);r('#b07d4f',9,26,5,3);r('#b07d4f',18,26,5,3);r('#d99c55',3,12,5,3);eye(9,9);
  }
  c.restore();
}
export interface DrawOptions {includeNpcs?:boolean;collectedItems?:string[];dynamicObjects?:boolean}
type DrawRegion=Pick<Region,'tiles'|'seed'|'biome'>&Partial<Pick<Region,'id'|'objects'|'theme'|'sceneId'|'npcName'|'description'|'hook'>>;
export function drawMap(c:Ctx,region:DrawRegion,options:DrawOptions={}){
  c.imageSmoothingEnabled=false;
  if(region.theme==='interior'){drawInterior(c,region,options);return;}
  const atlas=classicImage('terrain'),meta=terrainManifest(),columns=meta?.columns??32;
  const tile=(id:number,x:number,y:number)=>{if(atlas)c.drawImage(atlas,(id%columns)*16,Math.floor(id/columns)*16,16,16,x*16,y*16,16,16);};
  const at=(x:number,y:number)=>x<0||x>=WIDTH||y<0||y>=HEIGHT?-1:region.tiles[y*WIDTH+x];
  const block=(rows:number[][],x:number,y:number)=>rows.forEach((row,dy)=>row.forEach((id,dx)=>tile(id,x+dx,y+dy)));
  const path=(x:number,y:number)=>[1,7,-1].includes(at(x,y));
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const t=at(x,y);
    if(!atlas){drawTile(c,t,x*16,y*16,region.seed,region.biome);continue;}
    tile((x*13+y*7+region.seed)%9===0?1:17,x,y);
    if(t===1){const n=path(x,y-1),s=path(x,y+1),w=path(x-1,y),e=path(x+1,y);tile(!n&&!w?211:!n&&!e?213:!s&&!w?227:!s&&!e?229:!n?212:!s?228:!w?219:!e?221:188,x,y);}
    if(t===7){tile(425,x,y);tile(355,x,y);}
    if(t===3)tile(10,x,y);
    if(t===4){const water=(xx:number,yy:number)=>[4,7].includes(at(xx,yy));const n=water(x,y-1),s=water(x,y+1),w=water(x-1,y),e=water(x+1,y);tile(!n&&!w?416:!n&&!e?418:!s&&!w?432:!s&&!e?434:!n?417:!s?433:!w?424:!e?426:425,x,y);}
    if(t===5)tile(4,x,y);
    if(t===8)drawBoulder(c,x*16,y*16);
    if(t===2)tile(5,x,y);
  }
  if(atlas){
    const tree=meta?.blocks?.tree??[[14,15],[28,29],[36,37]],used=new Set<string>();
    for(let y=0;y<HEIGHT-2;y++)for(let x=0;x<WIDTH-1;x++)if(tree.every((row,dy)=>row.every((_,dx)=>at(x+dx,y+dy)===2&&!used.has(`${x+dx},${y+dy}`)))){
      block(tree,x,y);tree.forEach((row,dy)=>row.forEach((_,dx)=>used.add(`${x+dx},${y+dy}`)));
    }
  }
  drawObjects(c,region,options);
}
function drawBoulder(c:Ctx,x:number,y:number){
  rect(c,'#506858',x+2,y+11,12,4);rect(c,'#789078',x+2,y+5,12,8);rect(c,'#a0b098',x+4,y+2,8,10);rect(c,'#c8d0b0',x+5,y+3,5,3);rect(c,'#688068',x+10,y+8,3,4);rect(c,'#a0b890',x+1,y+13,5,2);
}
function drawObjects(c:Ctx,region:DrawRegion,options:DrawOptions){
  const atlas=classicImage('terrain'),interior=classicImage('interior'),meta=terrainManifest();
  const tile=(id:number,x:number,y:number,inside=false)=>{const image=inside?interior:atlas;if(image)c.drawImage(image,id%32*16,Math.floor(id/32)*16,16,16,x*16,y*16,16,16);};
  for(const object of region.objects??[]){
    const x=object.x*16,y=object.y*16,w=object.width??1,h=object.height??1;
    if(object.kind==='npc'){
      if(options.includeNpcs===false)continue;
      const image=classicImage(`people/${object.sprite??(object.role==='trainer'?'youngster':'prof_oak')}`);if(image){const dir=object.facing==='north'?1:object.facing==='west'||object.facing==='east'?2:0;c.save();if(object.facing==='east'){c.translate(x+16,y);c.scale(-1,1);c.drawImage(image,dir*16,0,16,32,0,-16,16,32);}else c.drawImage(image,dir*16,0,16,32,x,y-16,16,32);c.restore();}continue;
    }
    if(object.kind==='building'){
      const rows=meta?.blocks?.[object.sprite??'house'];if(rows)rows.forEach((row,dy)=>row.forEach((id,dx)=>tile(id,object.x+dx,object.y+dy)));else drawHouse(c,x,y);continue;
    }
    if(object.kind==='fence'){for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)tile(644,object.x+dx,object.y+dy);continue;}
    if(object.kind==='sign'){
      if(options.dynamicObjects&&object.sprite==='pc')continue;
      if(object.sprite==='pc'&&interior){tile(35,object.x,object.y,true);tile(98,object.x,object.y-1,true);}else tile(3,object.x,object.y);continue;
    }
    if(object.kind==='waystone'){drawBoulder(c,x,y);rect(c,'#f8e870',x+7,y+4,2,5);continue;}
    if(object.kind==='item'){
      const key=`${region.id}:${region.sceneId??'outdoor'}:${object.id}`;if(options.collectedItems?.includes(key))continue;
      rect(c,'#486050',x+4,y+12,9,3);rect(c,'#404850',x+4,y+4,8,9);rect(c,'#e86848',x+5,y+3,6,5);rect(c,'#f8f8e0',x+5,y+9,6,4);rect(c,'#303840',x+4,y+7,8,2);rect(c,'#f8f8e0',x+7,y+7,2,2);continue;
    }
    if(object.kind==='door'){
      if(region.theme==='interior'){rect(c,'#f0c080',x+1,y,14,3);rect(c,'#785840',x+1,y+3,14,3);rect(c,'#302830',x+1,y+6,14,10);}
      continue;
    }
    if(object.kind==='furniture'){
      if(object.sprite==='bookcase'&&interior){for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)tile(dy%2?115+dx%2:51+dx%2,object.x+dx,object.y+dy,true);}
      else if((object.sprite==='table'||object.sprite==='counter')&&interior){for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++){const edge=dx===0?0:dx===w-1?2:1;if(h===1){const top=104+edge,bottom=112+edge;c.drawImage(interior,top%32*16,Math.floor(top/32)*16,16,8,x+dx*16,y,16,8);c.drawImage(interior,bottom%32*16,Math.floor(bottom/32)*16+8,16,8,x+dx*16,y+8,16,8);}else tile((dy===h-1?112:104)+edge,object.x+dx,object.y+dy,true);}}
      else if(object.sprite==='bed'){
        rect(c,'#586070',x,y,w*16,h*16);rect(c,'#f8e8b8',x+2,y+2,w*16-4,h*16-5);rect(c,'#e8f0e8',x+4,y+4,w*16-8,9);rect(c,'#78a8d0',x+3,y+14,w*16-6,h*16-18);rect(c,'#486888',x+3,y+h*16-5,w*16-6,3);
      }else{rect(c,'#685840',x,y,w*16,h*16);rect(c,'#d8c088',x+1,y+1,w*16-2,h*16-3);}
    }
  }
}
function drawInterior(c:Ctx,region:DrawRegion,options:DrawOptions){
  const atlas=classicImage('interior');const tile=(id:number,x:number,y:number)=>{if(atlas)c.drawImage(atlas,id%32*16,Math.floor(id/32)*16,16,16,x*16,y*16,16,16);};
  const inside=(x:number,y:number)=>x>=0&&x<WIDTH&&y>=0&&y<HEIGHT&&[9,11,12,13].includes(region.tiles[y*WIDTH+x]);
  rect(c,'#101820',0,0,WIDTH*16,HEIGHT*16);
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const t=region.tiles[y*WIDTH+x];
    if([9,11,12,13].includes(t)){if(atlas)tile(region.sceneId==='home'?1:641,x,y);else drawTile(c,1,x*16,y*16);}
    if(t===10&&inside(x,y+1)){if(atlas)tile(region.sceneId==='home'?32:644,x,y);else rect(c,'#c8c0a0',x*16,y*16,16,16);}
    else if(t===10&&(inside(x-1,y)||inside(x+1,y))){rect(c,'#586070',x*16,y*16,16,16);rect(c,'#a8b0a0',x*16+(inside(x-1,y)?0:12),y*16,4,16);}
    if(t===11){rect(c,'#b85050',x*16,y*16,16,16);rect(c,'#d87868',x*16+1,y*16+1,14,14);}
  }
  drawObjects(c,region,options);
}
export function previewRegion():DrawRegion{
  return tutorialPack.regions[0] as DrawRegion;
}
