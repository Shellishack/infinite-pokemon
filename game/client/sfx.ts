import type {SfxCue} from '../shared/sfx';
export function playSfx(cue:SfxCue){window.dispatchEvent(new CustomEvent('infinite-pokemon-sfx',{detail:cue}));}
