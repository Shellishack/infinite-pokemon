// Syncs game/assets into Next's public/ directory so the exported static site
// serves the same asset URLs the game client already uses (/branding/..., /classic/...,
// /audio/...). game/assets remains the source of truth (referenced by scripts, tests,
// and the Electron shell).
import {cpSync, rmSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

const src=resolve('game/assets');
const dest=resolve('public');
if(!existsSync(src)) throw new Error('game/assets not found');
rmSync(dest,{recursive:true,force:true});
cpSync(src,dest,{recursive:true});
console.log(`Synced ${src} -> ${dest}`);
