import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve('game/assets/branding'),svg=readFileSync(resolve(root,'app-icon.svg'),'utf8'),sizes=[16,24,32,48,64,128,256,512];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const images=await page.evaluate(async({svg,sizes})=>{const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();return sizes.map(size=>{const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;canvas.getContext('2d')!.drawImage(image,0,0,size,size);return canvas.toDataURL('image/png').split(',')[1];});},{svg,sizes});
 writeFileSync(resolve(root,'app-icon.png'),Buffer.from(images.at(-1)!,'base64'));
 const frames=images.slice(0,-1).map(data=>Buffer.from(data,'base64')),header=Buffer.alloc(6+frames.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);let offset=header.length;
 frames.forEach((frame,index)=>{const p=6+index*16;header[p]=sizes[index]===256?0:sizes[index];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(frame.length,p+8);header.writeUInt32LE(offset,p+12);offset+=frame.length;});
 writeFileSync(resolve(root,'app-icon.ico'),Buffer.concat([header,...frames]));console.log('Generated app-icon.png and ICO sizes 16–256.');
}finally{await browser.close();}
