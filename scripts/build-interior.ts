import {readIndexedPng} from './indexed-png.js';
import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
const root=path.resolve('game/assets/classic/interior'),sets=['building','pokemon_center'];
const images=sets.map(name=>readIndexedPng(fs.readFileSync(path.join(root,'source',name,'tiles.png'))));
const indices=images.map(image=>{const colors=new Map(image.palette!.map((c,i)=>[c.slice(0,3).join(','),i]));return Uint8Array.from({length:image.width*image.height},(_,i)=>colors.get(Array.from(image.data.subarray(i*4,i*4+3)).join(','))!);});
const palettes=Array.from({length:13},(_,i)=>fs.readFileSync(path.join(root,'source',i<7?'building':'pokemon_center','palettes',`${String(i).padStart(2,'0')}.pal`),'utf8').trim().split(/\r?\n/).slice(3,19).map(line=>line.split(/\s+/).map(Number)));
const bins=sets.map(name=>fs.readFileSync(path.join(root,'source',name,'metatiles.bin'))),primaryCount=bins[0].length/16,columns=32,count=primaryCount+bins[1].length/16;
const atlas=new PNG({width:columns*16,height:Math.ceil(count/columns)*16});
for(let id=0;id<count;id++){
  const which=id<primaryCount?0:1,start=(which?id-primaryCount:id)*16;
  for(let sub=0;sub<8;sub++){
    const value=bins[which].readUInt16LE(start+sub*2),tile=value&1023,bank=tile<640?0:1,index=bank?tile-640:tile,pal=value>>>12;
    const image=images[bank],tx=index%(image.width/8)*8,ty=Math.floor(index/(image.width/8))*8;
    if(!palettes[pal]||ty>=image.height)throw new Error(`Missing tile ${tile}/palette ${pal}`);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const color=indices[bank][(ty+(value&2048?7-y:y))*image.width+tx+(value&1024?7-x:x)];if(!color)continue;
      const dx=id%columns*16+(sub%2)*8+x,dy=Math.floor(id/columns)*16+Math.floor(sub%4/2)*8+y;
      atlas.data.set([...palettes[pal][color],255],(dy*atlas.width+dx)*4);
    }
  }
}
fs.writeFileSync(path.join(root,'tiles.png'),PNG.sync.write(atlas));
const digits:Record<string,string[]>={0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['111','001','111','100','111'],3:['111','001','111','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],6:['111','100','111','101','111'],7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','111']};
for(let first=0;first<count;first+=256){const n=Math.min(256,count-first),sheet=new PNG({width:896,height:Math.ceil(n/16)*56});sheet.data.fill(36);for(let i=3;i<sheet.data.length;i+=4)sheet.data[i]=255;
  for(let k=0;k<n;k++){const id=first+k,ox=k%16*56+4,oy=Math.floor(k/16)*56+2;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=((Math.floor(id/columns)*16+y)*atlas.width+id%columns*16+x)*4;for(let sy=0;sy<3;sy++)for(let sx=0;sx<3;sx++)sheet.data.set(atlas.data.subarray(p,p+4),((oy+y*3+sy)*sheet.width+ox+x*3+sx)*4);}
    [...String(id)].forEach((digit,j)=>digits[digit].forEach((line,y)=>[...line].forEach((on,x)=>{if(on==='1')sheet.data.set([255,255,255,255],((oy+49+y)*sheet.width+ox+j*4+x)*4);})));
  }fs.writeFileSync(path.join(root,`contact-${first}.png`),PNG.sync.write(sheet));
}
fs.writeFileSync(path.join(root,'sources.json'),JSON.stringify({source:'https://github.com/pret/pokefirered',sets,columns,count,format:'Original indexed PNG/palette/16-bit metatile assembly',rights:'Original Pokémon artwork belongs to its respective owners.'},null,2));
console.log({count,columns});
