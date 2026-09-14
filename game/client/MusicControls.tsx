import {isSfxCue} from '../shared/sfx';
import {playSfx} from './sfx';
import {useEffect,useRef,useState} from 'react';
import type {GameState} from '../shared/model';
import {MusicPlayer,DEFAULT_MUSIC,MUSIC_KEY,readMusicSettings,validMusicSettings,type MusicStatus,type MusicTrack,type MusicSettings} from './music';
export function ambientMusicTheme(state:GameState|null,activity?:string|null):MusicTrack{
  if(!state||!state.me.introDone||!state.me.party.length)return 'title';
  if(activity==='shop')return 'shop';
  if(state.region.theme==='interior')return 'interior';
  if(state.region.id==='0,0')return 'town';
  if(['forest','coast','ruins'].includes(state.region.biome))return state.region.biome as MusicTrack;
  return 'exploration';
}
export function musicTheme(state:GameState|null,activity?:string|null):MusicTrack{
  if(!state||!state.me.introDone||!state.me.party.length)return 'title';
  if(state.me.battle&&!state.me.battle.finished)return state.me.battle.kind==='coop'?'guardian-battle':state.me.battle.kind==='trainer'?'trainer-battle':'battle';
  if(state.me.battle?.finished&&state.me.battle.won)return 'victory';
  return ambientMusicTheme(state,activity);
}
export function useGameMusic(state:GameState|null,activity?:string|null){
  const [settings,setSettings]=useState(readMusicSettings),[playback,setPlayback]=useState<{status:MusicStatus;track:MusicTrack}>({status:'ready',track:'title'});
  const theme=musicTheme(state,activity),ambient=ambientMusicTheme(state,activity);
  const engine=useRef<MusicPlayer|null>(null),latest=useRef({settings,theme,ambient});latest.current={settings,theme,ambient};
  useEffect(()=>{
    const player=new MusicPlayer((status,track)=>setPlayback({status,track}));engine.current=player;player.configure(latest.current.settings);player.setTheme(latest.current.theme,latest.current.ambient);
    const unlock=(event:Event)=>{if(event instanceof KeyboardEvent&&(event.repeat||event.ctrlKey||event.metaKey||event.altKey))return;void player.unlock();};
    const visibility=()=>void player.visibility();
    const receive=(event:MessageEvent)=>{if(event.source===window.parent&&event.data?.type==='ita-music-settings'&&validMusicSettings(event.data.settings))setSettings({...DEFAULT_MUSIC,...event.data.settings});};
    const effect=(event:Event)=>{const cue=(event as CustomEvent).detail;if(isSfxCue(cue))void player.playEffect(cue);};
    const select=(event:Event)=>{const target=event.target as HTMLElement;if(target.closest('button:not(:disabled)')&&!target.closest('.music-controls'))playSfx('select');};
    window.addEventListener('infinite-pokemon-sfx',effect);document.addEventListener('click',select);
    window.addEventListener('pointerdown',unlock,{capture:true});window.addEventListener('keydown',unlock,true);document.addEventListener('visibilitychange',visibility);window.addEventListener('message',receive);
    if(window.parent!==window)window.parent.postMessage({type:'ita-music-settings-get'},'*');
    return()=>{window.removeEventListener('infinite-pokemon-sfx',effect);document.removeEventListener('click',select);window.removeEventListener('pointerdown',unlock,true);window.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('message',receive);player.dispose();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.setTheme(theme,ambient);},[theme,ambient]);
  useEffect(()=>{engine.current?.configure(settings);},[settings]);
  function update(next:MusicSettings){setSettings(next);try{localStorage.setItem(MUSIC_KEY,JSON.stringify(next));document.cookie=`${MUSIC_KEY}=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=31536000; SameSite=Lax`;}catch{}if(window.parent!==window)window.parent.postMessage({type:'ita-music-settings-set',settings:next},'*');}
  return {settings,playback,toggle:()=>update({...settings,enabled:!settings.enabled}),volume:(volume:number)=>update({...settings,volume}),reset:()=>update({...DEFAULT_MUSIC}),toggleEffects:()=>update({...settings,sfxEnabled:settings.sfxEnabled===false}),effectsVolume:(sfxVolume:number)=>update({...settings,sfxVolume})};
}
export function MusicControls({music}:{music:ReturnType<typeof useGameMusic>}){
  return <div className="music-controls" role="group" aria-label="Music controls" data-music-status={music.playback.status} data-track={music.playback.track}>
    <button type="button" className="music-toggle" aria-label={music.settings.enabled?'Mute music':'Enable music'} aria-pressed={music.settings.enabled} onClick={music.toggle}>♪ Music {music.settings.enabled?'on':'off'}</button>
    <label>Volume <input type="range" aria-label="Music volume" min="0" max="100" step="1" value={Math.round(music.settings.volume*100)} onChange={event=>music.volume(Number(event.target.value)/100)}/></label>
    <button type="button" className="music-toggle" aria-label={music.settings.sfxEnabled===false?'Enable sound effects':'Mute sound effects'} aria-pressed={music.settings.sfxEnabled!==false} onClick={music.toggleEffects}>SFX {music.settings.sfxEnabled===false?'off':'on'}</button>
    <label>Effects <input type="range" aria-label="Sound effects volume" min="0" max="100" step="1" value={Math.round((music.settings.sfxVolume??.5)*100)} onChange={event=>music.effectsVolume(Number(event.target.value)/100)}/></label>
    {music.playback.status==='unavailable'?<span role="status">Music unavailable</span>:null}
  </div>;
}
