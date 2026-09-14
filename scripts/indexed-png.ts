import {PNG} from 'pngjs';
// pngjs exposes decoded palette entries at runtime; its published types use a boolean.
export function readIndexedPng(buffer:Buffer) {
 const image=PNG.sync.read(buffer);
 const palette:unknown=image.palette;
 if(Number(image.colorType)!==3||!Array.isArray(palette)||!palette.every(color=>Array.isArray(color)&&color.length>=3&&color.every(value=>typeof value==='number')))throw new Error('Expected indexed PNG source');
 return {width:image.width,height:image.height,data:image.data,palette:palette as number[][]};
}
