import type {SfxCue} from '../shared/sfx';
export type MusicTrack='title'|'exploration'|'interior'|'battle'|'victory'|'town'|'forest'|'coast'|'ruins'|'shop'|'trainer-battle'|'guardian-battle';
export type MusicStatus='ready'|'loading'|'playing'|'muted'|'paused'|'unavailable';
export interface MusicSettings {enabled:boolean;volume:number;sfxEnabled?:boolean;sfxVolume?:number}
export const DEFAULT_MUSIC:MusicSettings={enabled:true,volume:.35,sfxEnabled:true,sfxVolume:.5};
export const MUSIC_KEY='infinite-tamer-music-v1';
export function validMusicSettings(value:unknown):value is MusicSettings{const v=value as MusicSettings;return !!v&&typeof v.enabled==='boolean'&&typeof v.volume==='number'&&Number.isFinite(v.volume)&&v.volume>=0&&v.volume<=1&&(v.sfxEnabled===undefined||typeof v.sfxEnabled==='boolean')&&(v.sfxVolume===undefined||typeof v.sfxVolume==='number'&&Number.isFinite(v.sfxVolume)&&v.sfxVolume>=0&&v.sfxVolume<=1);}
export function readMusicSettings():MusicSettings{
  try{const cookie=document.cookie.split('; ').find(part=>part.startsWith(MUSIC_KEY+'='));const raw=cookie?decodeURIComponent(cookie.slice(MUSIC_KEY.length+1)):localStorage.getItem(MUSIC_KEY);const value=raw?JSON.parse(raw):null;if(validMusicSettings(value))return {...DEFAULT_MUSIC,...value};}catch{}
  return {...DEFAULT_MUSIC};
}
export class MusicPlayer {
  private effectsGain?:GainNode;private effectBuffers=new Map<SfxCue,Promise<AudioBuffer>>();private effects=new Set<AudioBufferSourceNode>();private lastEffect=new Map<SfxCue,number>();private effectsEpoch=0;
  private context?:AudioContext;private master?:GainNode;private current?:{source:AudioBufferSourceNode;gain:GainNode;track:MusicTrack};
  private buffers=new Map<MusicTrack,Promise<AudioBuffer>>();private abort=new AbortController();private epoch=0;private closed=false;private unlocked=false;private finishedVictory=false;
  private returnTrack:MusicTrack='exploration';private theme:MusicTrack='title';private settings:MusicSettings={...DEFAULT_MUSIC};
  constructor(private report:(status:MusicStatus,track:MusicTrack)=>void){}
  setTheme(theme:MusicTrack,returnTrack:MusicTrack='exploration'){this.returnTrack=returnTrack;if(theme===this.theme)return;this.theme=theme;this.finishedVictory=false;void this.sync();}
  configure(settings:MusicSettings){this.settings=settings;if(this.context&&this.effectsGain)this.effectsGain.gain.setTargetAtTime((settings.sfxVolume??.5)*.45,this.context.currentTime,.02);if(settings.sfxEnabled===false||settings.sfxVolume===0){this.effectsEpoch++;for(const source of this.effects)source.stop();this.effects.clear();}if(this.master&&this.context)this.master.gain.setTargetAtTime(settings.volume*.65,this.context.currentTime,.04);void this.sync();}
  async unlock(){
    if(this.closed)return;
    try{if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.settings.volume*.65;const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-6;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.15;limiter.connect(this.context.destination);this.master.connect(limiter);this.effectsGain=this.context.createGain();this.effectsGain.gain.value=(this.settings.sfxVolume??.5)*.45;this.effectsGain.connect(limiter);}await this.context.resume();if(this.closed)return;this.unlocked=this.context.state==='running';await this.sync();}catch{if(!this.closed)this.report('unavailable',this.theme);}
  }
  async visibility(){if(!this.context)return;if(document.hidden){this.effectsEpoch++;for(const source of this.effects)source.stop();this.effects.clear();await this.context.suspend();this.report('paused',this.theme);}else if(this.unlocked){try{await this.context.resume();await this.sync();}catch{this.report('ready',this.theme);}}}
  async playEffect(cue:SfxCue){
    if(this.closed||!this.context||!this.unlocked||document.hidden||this.settings.sfxEnabled===false||this.settings.sfxVolume===0)return;
    const requested=Date.now(),cooldown=cue==='bump'||cue==='error'?250:cue==='footstep'?110:70;
    if(requested-(this.lastEffect.get(cue)??0)<cooldown)return;this.lastEffect.set(cue,requested);
    const context=this.context,epoch=this.effectsEpoch;
    try{
      let pending=this.effectBuffers.get(cue);
      if(!pending){pending=fetch('/audio/sfx/'+cue+'.wav',{signal:this.abort.signal}).then(response=>{if(!response.ok)throw new Error('Effect unavailable');return response.arrayBuffer();}).then(data=>context.decodeAudioData(data));this.effectBuffers.set(cue,pending);void pending.catch(()=>this.effectBuffers.delete(cue));}
      const buffer=await pending;if(this.closed||epoch!==this.effectsEpoch||document.hidden||Date.now()-requested>600)return;
      if(this.effects.size>=4){const oldest=this.effects.values().next().value!;oldest.stop();this.effects.delete(oldest);}
      const source=context.createBufferSource();source.buffer=buffer;source.connect(this.effectsGain!);this.effects.add(source);source.onended=()=>{this.effects.delete(source);source.disconnect();};source.start();
    }catch{/* Missing effects never interrupt gameplay. */}
  }
  private stop(){const current=this.current;this.current=undefined;if(!current||!this.context)return;current.source.onended=()=>{current.source.disconnect();current.gain.disconnect();};const now=this.context.currentTime;current.gain.gain.cancelScheduledValues(now);current.gain.gain.setValueAtTime(current.gain.gain.value,now);current.gain.gain.linearRampToValueAtTime(0,now+.4);current.source.stop(now+.42);}
  private async sync(){
    if(this.closed)return;
    const track=this.theme==='victory'&&this.finishedVictory?this.returnTrack:this.theme;
    if(!this.settings.enabled||this.settings.volume===0){this.epoch++;this.stop();this.report('muted',track);return;}
    if(!this.context||!this.unlocked){this.report('ready',track);return;}
    if(document.hidden){this.report('paused',track);return;}
    if(this.current?.track===track){this.report('playing',track);return;}
    const epoch=++this.epoch,context=this.context;this.report('loading',track);
    try{
      let pending=this.buffers.get(track);
      if(!pending){pending=fetch(`/audio/${track}.wav`,{signal:this.abort.signal}).then(response=>{if(!response.ok)throw new Error('Music unavailable');return response.arrayBuffer();}).then(data=>context.decodeAudioData(data));this.buffers.set(track,pending);void pending.catch(()=>this.buffers.delete(track));}
      const buffer=await pending;if(this.closed||epoch!==this.epoch||document.hidden)return;
      this.stop();const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=track!=='victory';source.connect(gain);gain.connect(this.master!);gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(1,context.currentTime+.6);this.current={source,gain,track};
      if(track==='victory')source.onended=()=>{if(this.current?.source===source){source.disconnect();gain.disconnect();this.current=undefined;this.finishedVictory=true;void this.sync();}};
      source.start();this.report('playing',track);
    }catch{if(!this.closed&&epoch===this.epoch){this.stop();this.report('unavailable',track);}}
  }
  dispose(){this.closed=true;this.effectsEpoch++;for(const source of this.effects)source.stop();this.effects.clear();this.epoch++;this.abort.abort();this.stop();void this.context?.close();}
}
