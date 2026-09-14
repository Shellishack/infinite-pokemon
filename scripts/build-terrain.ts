import {readIndexedPng} from './indexed-png.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

// Decode the original indexed tiles and 16-bit GBA metatile entries. Run offline
// after fetching the attributed source files; no ROM or credentials are needed.
const root = path.resolve('game/assets/classic');
const source = path.join(root, 'source-terrain');
const sets = ['general', 'pallet_town'];
const primaryTiles = 640, primaryMetatiles = 640, columns = 32;
const images = sets.map(name => readIndexedPng(fs.readFileSync(path.join(source, name, 'tiles.png'))));
const indices = images.map(image => {
  const colors = new Map(image.palette.map((p, i) => [p.slice(0, 3).join(','), i]));
  return Uint8Array.from({ length: image.width * image.height }, (_, i) => {
    const index = colors.get(Array.from(image.data.subarray(i * 4, i * 4 + 3)).join(','));
    if (index === undefined) throw new Error('Source palette index could not be recovered');
    return index;
  });
});
const palettes = Array.from({ length: 13 }, (_, i) => {
  const text = fs.readFileSync(path.join(source, i < 7 ? 'general' : 'pallet_town', 'palettes', `${String(i).padStart(2, '0')}.pal`), 'utf8');
  const lines = text.trim().split(/\r?\n/);
  if (lines[0] !== 'JASC-PAL' || Number(lines[2]) !== 16) throw new Error('Unexpected palette format');
  return lines.slice(3, 19).map(line => line.trim().split(/\s+/).map(Number));
});
const binaries = sets.map(name => fs.readFileSync(path.join(source, name, 'metatiles.bin')));
for (const data of binaries) if (data.length % 16) throw new Error('Metatile binary is not a multiple of 16 bytes');
if (binaries[0].length / 16 !== primaryMetatiles) throw new Error('Unexpected primary metatile count');
const count = primaryMetatiles + binaries[1].length / 16;
const atlas = new PNG({ width: columns * 16, height: Math.ceil(count / columns) * 16 });
const warnings = new Set();
for (let id = 0; id < count; id++) {
  const which = id < primaryMetatiles ? 0 : 1;
  const start = (which ? id - primaryMetatiles : id) * 16;
  const ax = id % columns * 16, ay = Math.floor(id / columns) * 16;
  for (let sub = 0; sub < 8; sub++) {
    const entry = binaries[which].readUInt16LE(start + sub * 2);
    const tile = entry & 0x3ff, flipX = !!(entry & 0x400), flipY = !!(entry & 0x800), palette = entry >>> 12;
    const imageIndex = tile < primaryTiles ? 0 : 1;
    const localTile = imageIndex ? tile - primaryTiles : tile;
    const image = images[imageIndex], ix = localTile % (image.width / 8) * 8, iy = Math.floor(localTile / (image.width / 8)) * 8;
    if (iy >= image.height || !palettes[palette]) { warnings.add(`tile=${tile},palette=${palette}`); continue; }
    const dx = sub % 2 * 8, dy = Math.floor(sub % 4 / 2) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const value = indices[imageIndex][(iy + (flipY ? 7 - y : y)) * image.width + ix + (flipX ? 7 - x : x)];
      if (value === 0) continue; // GBA background color zero is transparent.
      const rgb = palettes[palette][value], p = ((ay + dy + y) * atlas.width + ax + dx + x) * 4;
      atlas.data.set([...rgb, 255], p);
    }
  }
}
fs.writeFileSync(path.join(root, 'terrain.png'), PNG.sync.write(atlas));

// Small labels keep the visual source-ID lookup independent of system fonts.
const digits:Record<string,string[]> = {
  '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'],'3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'],'5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'],'7':['111','001','010','010','010'],
  '8':['111','101','111','101','111'],'9':['111','101','111','001','111'],
};
const pixel = (png:PNG, x:number, y:number, rgb:number[]) => png.data.set([...rgb, 255], (y * png.width + x) * 4);
for (let page = 0; page < count; page += 256) {
  const pageCount = Math.min(256, count - page), cell = 56, sheet = new PNG({ width: 16 * cell, height: Math.ceil(pageCount / 16) * cell });
  for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([34, 44, 50, 255], i);
  for (let n = 0; n < pageCount; n++) {
    const id = page + n, ox = n % 16 * cell + 4, oy = Math.floor(n / 16) * cell + 2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const src = ((Math.floor(id / columns) * 16 + y) * atlas.width + id % columns * 16 + x) * 4;
      const rgb = atlas.data[src + 3] ? Array.from(atlas.data.subarray(src, src + 3)) : [72, 67, 79];
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) pixel(sheet, ox + x * 3 + sx, oy + y * 3 + sy, rgb);
    }
    for (const [j, digit] of [...String(id)].entries()) for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (digits[digit][y][x] === '1') pixel(sheet, ox + j * 4 + x, oy + 49 + y, [245, 245, 235]);
  }
  fs.writeFileSync(path.join(root, page ? `terrain-contact-${page}.png` : 'terrain-contact.png'), PNG.sync.write(sheet));
}
const sourceFiles: {path:string;sha256:string}[] = [];
function walk(dir:string) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else sourceFiles.push({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }); } }
walk(source);
const metadata = {
  image: '/classic/terrain.png', tileWidth: 16, tileHeight: 16, columns, count,
  primaryTileCount: primaryTiles, primaryMetatileCount: primaryMetatiles,
  named: { grass: 17, grassAlt: 8, path: 662, sandyPath: 188, tallGrass: 10, flower: 4, bush: 5, water: 299, sign: 2, woodenSign: 3, fence: 644, mailbox: 685, pondTopLeft: 416, pondTop: 417, pondTopRight: 418, pondLeft: 424, pondCenter: 425, pondRight: 426, pondBottomLeft: 432, pondBottom: 433, pondBottomRight: 434 },
  blocks: {
    tree: [[14,15],[28,29],[36,37]],
    house: [[641,642,642,642,643],[649,650,650,650,651],[657,659,658,658,660],[664,665,666,667,668],[672,675,674,673,676]],
    lab: [[680,681,681,681,681,701,693],[688,689,689,689,689,691,692],[696,697,697,697,697,699,700],[704,705,720,706,707,708,709],[712,713,728,684,715,716,717]],
    mailbox: [[677],[685]],
    fence: [[644,644,644,644]],
    pond: [[416,417,418],[424,425,426],[432,433,434]],
  },
  source: { repository: 'https://github.com/pret/pokefirered', branch: 'master', recordedRevision: 'c75f352304d529f6ba92d4f74b9cf8b5c3810788', paths: ['data/tilesets/primary/general', 'data/tilesets/secondary/pallet_town'], formatDefinition: 'include/fieldmap.h', rights: 'Original Pokemon FireRed game artwork; no permissive artwork license is asserted. Copyright remains with its respective owners.' },
  decode: { entriesPerMetatile: 8, tileIndexBits: '0-9', horizontalFlipBit: 10, verticalFlipBit: 11, paletteBits: '12-15', compositing: 'Four lower 8x8 quadrants followed by four upper quadrants; palette index 0 transparent.', unusedReferenceWarnings: [...warnings] },
  files: sourceFiles,
};
fs.writeFileSync(path.join(root, 'terrain.json'), JSON.stringify(metadata, null, 2) + '\n');
const specimens = new PNG({ width: 768, height: 192 });
for (let i=0;i<specimens.data.length;i+=4) specimens.data.set([115,197,164,255],i);
let offset=8;
for (const block of [metadata.blocks.tree, metadata.blocks.house, metadata.blocks.lab, metadata.blocks.mailbox, metadata.blocks.pond]) {
  for (let by=0;by<block.length;by++) for(let bx=0;bx<block[by].length;bx++) {
    const id=block[by][bx];
    for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
      const index=((Math.floor(id/columns)*16+y)*atlas.width+id%columns*16+x)*4;
      if(!atlas.data[index+3])continue;
      for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++)specimens.data.set(atlas.data.subarray(index,index+4),(((by*16+y)*2+sy+8)*specimens.width+offset+bx*32+x*2+sx)*4);
    }
  }
  offset+=block[0].length*32+16;
}
fs.writeFileSync(path.join(root,'terrain-blocks.png'),PNG.sync.write(specimens));
const referenceMapPath=path.join(source,'pallet_town','map.bin');
if(fs.existsSync(referenceMapPath)) {
  const map=fs.readFileSync(referenceMapPath), reference=new PNG({width:768,height:640});
  for(let my=0;my<20;my++)for(let mx=0;mx<24;mx++) {
    const id=map.readUInt16LE((my*24+mx)*2)&1023;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
      const index=((Math.floor(id/columns)*16+y)*atlas.width+id%columns*16+x)*4;
      for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++)reference.data.set(atlas.data.subarray(index,index+4),(((my*16+y)*2+sy)*reference.width+(mx*16+x)*2+sx)*4);
    }
  }
  fs.writeFileSync(path.join(root,'terrain-reference-pallet-town.png'),PNG.sync.write(reference));
}
console.log(JSON.stringify({ output: 'game/assets/classic/terrain.png', size: [atlas.width, atlas.height], count, warnings: warnings.size }, null, 2));
