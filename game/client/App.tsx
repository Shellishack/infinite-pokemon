import {playSfx} from './sfx';
import {isSfxCue} from '../shared/sfx';
import {MusicControls,useGameMusic} from './MusicControls';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { SPECIES, STARTERS, TUTORIALS, type Species, type Creature, type GameState, type Action, type GenerationStatus, type MovementState, type Direction, type SceneObject } from '../shared/model';
import { objectInFront, sceneObjects } from '../shared/scene';
import { Landscape } from './Landscape';
import { commandId } from './identity';
import { type BattleNotice } from './BattleScene';
import EncounterBattle from './EncounterBattle';
import ObjectivePanel from './ObjectivePanel';
import SaveBrowser from './SaveBrowser';
import {surroundingMapCount,DEFAULT_GENERATION_BATCH_SIZE,MAX_GENERATION_BATCH_SIZE} from '../shared/streaming';
import {GenerationIndicator} from './GenerationIndicator';
import AgentPanel from './AgentPanel';
import VarietyPanels,{type VarietyTab} from './VarietyPanels';
import {creatureImage} from './content-art';
import {creatureInfo} from '../shared/model';
const GameCanvas=lazy(()=>import('./GameCanvas'));

type SessionMode = 'singleplayer' | 'multiplayer';
interface Host { hostToken:string;status:GenerationStatus;ready:boolean;starting:boolean;sessionMode:SessionMode;name:string;addresses:string[];gamePort:number;preview?:boolean;parentUrl?:string;renderDepth?:number;generationBatchSize?:number;rememberedConnection?:boolean;harnessExecutable?:string }
interface Info { name:string;ready:boolean;online:number;capacity:number;hostAvailable:boolean;sessionMode:SessionMode;generation:{state:string;mode:string};gamePort:number;preview?:boolean }
interface Dialog {title:string;text:string;connectRequired?:boolean;interaction?:SceneObject}
// Stable save association for browsers created before the branding change.
const sessionKey='infinite-pokemon-session-v1';
async function request(path:string,data?:unknown,hostToken?:string){const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(hostToken?{'x-host-token':hostToken}:{})},body:data===undefined?undefined:JSON.stringify(data)});const json=await r.json().catch(()=>({error:'The server could not complete that request.'}));if(!r.ok)throw Object.assign(new Error(json.error??'The server could not complete that request.'),{status:r.status,code:json.code});return json;}

function CreatureArt({species,creature,size=128,back=false}:{species?:Species;creature?:Creature;size?:number;back?:boolean}){const target=creature??{species:species??'bulbasaur'};return <img src={creatureImage(target,back)} width={size} height={size} style={{width:size,height:size}} className="creature-art" alt={creature?creatureInfo(creature).name:SPECIES[target.species].name}/>;}
function Ball({small=false}:{small?:boolean}){return <span className={`pokeball ${small?'small':''}`} aria-hidden="true"><i/></span>;}
function Health({creature}:{creature:Creature}){const pct=creature.hp/creature.maxHp*100;return <div className="health"><span>HP</span><div><i style={{width:`${pct}%`,background:pct<25?'#df7666':pct<50?'#e4be5e':'#76b98c'}}/></div><small>{creature.hp}/{creature.maxHp}</small></div>;}
function Modal({title,children,onClose,dialogue=false}:{title:string;children:React.ReactNode;onClose?:()=>void;dialogue?:boolean}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const prev=document.activeElement as HTMLElement;ref.current?.focus();return()=>prev?.focus();},[]);
  return <div className="modal-scrim"><div className="modal pixel-window" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onKeyDown={e=>{
    if(e.key==='Escape'&&onClose){e.preventDefault();e.stopPropagation();if(!e.repeat)onClose();return;}
    if(dialogue&&onClose&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&['e','E',' ','Enter'].includes(e.key)){
      const target=e.target as HTMLElement;
      if(!target.closest('input,textarea,select,[contenteditable=true]')&&(!target.closest('button,a')||e.key.toLowerCase()==='e')){
        e.preventDefault();e.stopPropagation();if(!e.repeat)onClose();return;
      }
    }
    if(e.key==='Tab'){
      const items=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a,select,summary');
      if(items?.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    }
  }}><div className="modal-title"><h2>{title}</h2>{onClose?<button className="close-button" aria-label="Close" onClick={onClose}>×</button>:null}</div>{children}</div></div>;
}

export default function App(){
  const [info,setInfo]=useState<Info|null>(null),[host,setHost]=useState<Host|null>(null),[mode,setMode]=useState<'welcome'|'multiplayer'|'host'|'join'>(()=>new URLSearchParams(location.search).has('join')?'join':'welcome');
  const [token,setToken]=useState<string|null>(null),[state,setState]=useState<GameState|null>(null),[connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[dialog,setDialog]=useState<Dialog|null>(null),[tab,setTab]=useState<'journal'|'party'|'map'|'bag'|'trainer'|VarietyTab|null>(null),[menuOpen,setMenuOpen]=useState(false);
  const music=useGameMusic(state,tab);
  const menuSound=useRef(false);
  useEffect(()=>{const open=menuOpen||!!tab;if(open!==menuSound.current){playSfx(open?'menu-open':'menu-close');menuSound.current=open;}},[menuOpen,tab]);
  const [homeSettings,setHomeSettings]=useState(()=>new URLSearchParams(location.search).has('settings')),[confirmReset,setConfirmReset]=useState(false),[resetText,setResetText]=useState('');
  const [switchHarness,setSwitchHarness]=useState(false),[harnessPath,setHarnessPath]=useState('');
  const [connectionError,setConnectionError]=useState<string|null>(null);
  const [agentOpen,setAgentOpen]=useState(false);
  const openAgent=()=>{setMenuOpen(false);setAgentOpen(true);};
  const [hostOpen,setHostOpen]=useState(false),[name,setName]=useState(()=>new URLSearchParams(location.search).get('nickname')??''),[address,setAddress]=useState(''),[authUrl,setAuthUrl]=useState(''),[intro,setIntro]=useState(0);
  const [localMode,setLocalMode]=useState<SessionMode>('singleplayer'),[autoEnter,setAutoEnter]=useState(false),[autoGuest,setAutoGuest]=useState(()=>new URLSearchParams(location.search).has('join'));
  const [autoPlay,setAutoPlay]=useState(()=>new URLSearchParams(location.search).has('preview')||new URLSearchParams(location.search).has('play')),[promotingPreview,setPromotingPreview]=useState(false);
  const [movementFeedback,setMovementFeedback]=useState<MovementState>(),[moveRequest,setMoveRequest]=useState<{direction:Direction;id:string}>(),[interactRequest,setInteractRequest]=useState<{id:string}>();
  const [heldDirection,setHeldDirection]=useState<Direction>();
  const [battleNotices,setBattleNotices]=useState<BattleNotice[]>([]),[battleErrorVersion,setBattleErrorVersion]=useState(0);
  const [connectionEpoch,setConnectionEpoch]=useState(0);
  const [encounterId,setEncounterId]=useState<string>();
  const [savesOpen,setSavesOpen]=useState(false);
  const [mapWaiting,setMapWaiting]=useState(false);
  const socket=useRef<WebSocket|null>(null),localLaunch=useRef(false),stateRef=useRef(state),commands=useRef(new Map<string,{action:Action;battleId?:string}>());stateRef.current=state;
  const isPreview=!!(state as (GameState&{preview?:boolean})|null)?.preview;
  useEffect(()=>{let active=true;async function refresh(){try{const i=await request('/api/info');if(!active)return;setInfo(i);if(i.hostAvailable){const h=await request('/api/bootstrap');if(active)setHost(h);}}catch(e){if(active)setError((e as Error).message);}}void refresh();const timer=setInterval(refresh,2000);return()=>{active=false;clearInterval(timer);};},[]);
  useEffect(()=>{
    if(!token)return;let stopped=false,retry:ReturnType<typeof setTimeout>;let attempts=0;
    function connect(){if(stopped)return;const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/play`);socket.current=ws;let firstState=true;
      ws.onopen=()=>{ws.send(JSON.stringify({type:'auth',token}));};
      ws.onmessage=e=>{const data=JSON.parse(e.data);if(data.type==='state'){attempts=0;setMapWaiting(!!data.streaming?.travel);setConnected(true);if(firstState){firstState=false;setEncounterId(undefined);setConnectionEpoch(value=>value+1);setMovementFeedback(undefined);setMoveRequest(undefined);setInteractRequest(undefined);}else{const previous=stateRef.current?.me;if(data.me.battle?.id!==previous?.battle?.id){setEncounterId(data.me.battle?.id);if(data.me.battle&&!data.me.battle.finished)playSfx('encounter');}if(previous?.sceneId!==data.me.sceneId)playSfx('door');else if(previous?.regionId!==data.me.regionId)playSfx('travel');}setState(prev=>({...data,region:data.region??prev?.region}));}
        if(data.type==='result'){
          const issued=commands.current.get(data.id);commands.current.delete(data.id);if(issued&&Array.isArray(data.sounds))for(const cue of data.sounds)if(isSfxCue(cue))playSfx(cue);
          if(data.movement)setMovementFeedback(data.movement);
          if(data.service){setDialog(null);setMenuOpen(false);setTab(data.service);}
          else if(data.code==='MAP_LOADING')setMapWaiting(true);
          else if(data.code==='PREVIEW_BOUNDARY')setDialog({title:'The edge of the preview',text:data.text,connectRequired:true});
          else if(data.text){if(issued?.battleId)setBattleNotices(previous=>[...previous.slice(-20),{id:data.id,battleId:issued.battleId!,text:data.text}]);else setDialog({title:data.title??(data.lessonComplete?'A milestone on your journey':'Your adventure'),text:data.text,interaction:data.interaction});}
        }
        if(data.type==='error'&&data.code==='MAP_LOADING'){setMapWaiting(true);return;}if(data.type==='error'){playSfx('error');setBattleErrorVersion(value=>value+1);if(data.code==='PREVIEW_BOUNDARY')setDialog({title:'The edge of the preview',text:data.message,connectRequired:true});else setError(data.message);}
      };
      ws.onclose=event=>{setConnected(false);if(stopped)return;
        if((event.code===1000&&event.reason==='The host closed the multiplayer session. Your progress is saved.')||([1000,1008].includes(event.code)&&event.reason==='Session opened elsewhere')){
          stopped=true;setToken(null);setState(null);setMode('welcome');setMenuOpen(false);setTab(null);setDialog(null);setHostOpen(false);setError(event.reason==='Session opened elsewhere'?'This save is open in another window. Your progress is saved.':event.reason);return;
        }
        retry=setTimeout(connect,Math.min(1000*2**attempts++,10_000));
      };
    }
    connect();return()=>{stopped=true;clearTimeout(retry);socket.current?.close();socket.current=null;};
  },[token]);
  useEffect(()=>{if(!error)return;const t=setTimeout(()=>setError(''),6500);return()=>clearTimeout(t);},[error]);
  const act=useCallback((action:Action)=>{if(socket.current?.readyState===WebSocket.OPEN){const id=commandId();commands.current.set(id,{action,battleId:['battle','potion','useItem','switch'].includes(action.kind)?stateRef.current?.me.battle?.id:undefined});if(commands.current.size>200)commands.current.delete(commands.current.keys().next().value!);socket.current.send(JSON.stringify({type:'command',id,action}));}},[]);
  const run=async(label:string,fn:()=>Promise<void>)=>{if(busy)return;setBusy(label);setError('');setConnectionError(null);try{await fn();}catch(e){if(/Codex|connection|Opening your save/.test(label))setConnectionError((e as Error).message);else setError((e as Error).message);}finally{setBusy('');}};
  const hostAction=(action:string,data:unknown={})=>request('/api/host/'+action,data,host?.hostToken);
  const beginLocal=(sessionMode:SessionMode)=>{
    if(!info?.hostAvailable){setError('Single player and hosting run on your computer. Open the desktop game or your local server console.');return;}
    setLocalMode(sessionMode);setPromotingPreview(sessionMode==='multiplayer');setMode('host');setError('');setConnectionError(null);
    if(sessionMode==='singleplayer'&&!host?.parentUrl&&new URLSearchParams(location.search).get('world')!=='main'){
      void run('Opening your save',async()=>{const current=await request('/api/bootstrap') as Host;setHost(current);const resume=await request('/api/host/resume',{},current.hostToken);if(resume.url&&new URL(resume.url).origin!==location.origin){const target=new URL(resume.url);target.searchParams.set('play','1');location.assign(target.href);}else setAutoEnter(true);});
    }else setAutoEnter(true);
  };
  const remember=(value:string)=>{localStorage.setItem(sessionKey,value);setToken(value);setMode('welcome');setHostOpen(false);const url=new URL(location.href);url.searchParams.delete('play');url.searchParams.delete('preview');history.replaceState(null,'',url.pathname+url.search+url.hash);};
  const connectPreview=()=>{setDialog(null);setLocalMode('singleplayer');setPromotingPreview(true);setAutoEnter(true);setHostOpen(true);};
  const playPreview=()=>run('Opening tutorial preview',async()=>{setAutoEnter(false);const result=await hostAction('preview');const url=new URL(result.previewUrl);url.searchParams.set('preview','1');location.assign(url.href);});
  const join=()=>run('Joining the session',async()=>{
    let target:URL;
    try{target=address.trim()?new URL(address.includes('://')?address:'http://'+address):new URL(location.origin);if(address.trim()&&!address.includes('://')&&!target.port)target.port=String(info?.gamePort??8787);}
    catch{throw new Error('Enter a server IP address or an http:// or https:// URL.');}
    if(!['http:','https:'].includes(target.protocol))throw new Error('Use an http:// or https:// server address.');
    if(!address.trim()&&info?.hostAvailable)target.port=String(info.gamePort);
    if(target.origin!==location.origin){
      target.pathname='/';target.search='';target.searchParams.set('join','1');
      if(name.trim())target.searchParams.set('nickname',name.trim());
      location.assign(target.href);return;
    }
    if(info?.hostAvailable)throw new Error('Join using the public session address shown by your host.');
    const saved=localStorage.getItem(sessionKey);
    let result;
    if(saved){try{result=await request('/api/join',{token:saved});}catch(e){const failure=e as {status?:number;code?:string};if(failure.status===401&&failure.code==='INVALID_SESSION')localStorage.removeItem(sessionKey);else throw e;}}
    result??=await request('/api/join',{name:name.trim()||'Trainer'});
    remember(result.token);
    history.replaceState(null,'',location.pathname+location.hash);
  });
  useEffect(()=>{
    if(!autoGuest||!info?.ready||info.hostAvailable||info.sessionMode!=='multiplayer')return;
    setAutoGuest(false);void join();
  },[autoGuest,info?.ready,info?.hostAvailable,info?.sessionMode]);
  useEffect(()=>{if(autoPlay&&host){setAutoPlay(false);setLocalMode('singleplayer');setPromotingPreview(false);setAutoEnter(true);setMode('host');}},[autoPlay,host]);
  useEffect(()=>{
    const freePreview=host?.preview&&localMode==='singleplayer'&&!promotingPreview;
    if(!autoEnter||!host||(host.starting&&!host.ready)||(!freePreview&&!['ready','working'].includes(host.status.state))||localLaunch.current)return;
    localLaunch.current=true;
    const selected=localMode,credentials=host.hostToken;
    setBusy(host.ready?'Entering your adventure':'Preparing your starting area');
    void(async()=>{
      try{
        let current=host;
        if(!current.ready||(current.preview&&['ready','working'].includes(current.status.state))){
          await request('/api/host/start',{sessionMode:selected},credentials);
          current=await request('/api/bootstrap') as Host;setHost(current);
          if(!current.ready)return;
        }else if(current.sessionMode!==selected){
          await request('/api/host/session',{sessionMode:selected},credentials);
          current=await request('/api/bootstrap') as Host;setHost(current);
        }
        const result=await request('/api/join',{name:name.trim()||'Trainer'},credentials);
        setAutoEnter(false);remember(result.token);
      }catch(e){setConnectionError((e as Error).message);setAutoEnter(false);}
      finally{localLaunch.current=false;setBusy('');}
    })();
  },[autoEnter,host?.ready,host?.starting,host?.status.state,host?.sessionMode,host?.preview,localMode,promotingPreview]);
  const leave=()=>{setToken(null);setState(null);setConnected(false);setMode('welcome');setHostOpen(false);setMenuOpen(false);setTab(null);setAutoEnter(false);setAutoGuest(false);};
  const blocked=agentOpen||mapWaiting||!!state?.streaming?.travel||!!dialog||!!state?.me.battle||!!hostOpen||savesOpen||menuOpen||!!tab||!connected||!state?.me.introDone||!state?.me.party.length;
  useEffect(()=>{if(blocked)setHeldDirection(undefined);},[blocked]);
  useEffect(()=>{
    const listener=(e:KeyboardEvent)=>{
      if(e.key!=='Escape'||e.repeat||e.defaultPrevented||e.ctrlKey||e.altKey||e.metaKey)return;
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
      if(!connected||!state?.me.introDone||!state.me.party.length||state.me.battle||dialog||hostOpen||agentOpen||savesOpen||mapWaiting||connectionError)return;
      e.preventDefault();if(tab){setTab(null);return;}setMenuOpen(open=>!open);
    };
    window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);
  },[connected,state?.me.introDone,state?.me.party.length,state?.me.battle,dialog,hostOpen,agentOpen,savesOpen,mapWaiting,connectionError,tab]);
  const harnessReady=host&&['ready','working'].includes(host.status.state);
  useEffect(()=>{if(mode==='host'&&harnessReady&&!busy&&!connectionError&&!token&&!autoEnter&&!localLaunch.current)setAutoEnter(true);},[mode,harnessReady,busy,connectionError,token,autoEnter]);
  const shareAddresses=[...new Set(host?.addresses??[])];
  const shareAddress=shareAddresses[0]||('http://'+location.hostname+':'+(host?.gamePort??info?.gamePort??8787));
  const checkedConnection=useRef(false);
  useEffect(()=>{
    if(connectionError||homeSettings||checkedConnection.current||!host?.rememberedConnection||host.preview||harnessReady||busy)return;
    checkedConnection.current=true;
    void run('Checking your Codex connection',async()=>{await hostAction('session-check');setHost(await request('/api/bootstrap'));});
  },[connectionError,homeSettings,host?.rememberedConnection,host?.hostToken,host?.preview,harnessReady,busy]);
  const openHomeSettings=()=>{
    if(host?.parentUrl){const target=new URL(host.parentUrl);target.searchParams.set('settings','1');location.assign(target.href);return;}
    setHomeSettings(true);setConfirmReset(false);setResetText('');
  };
  const resetEntireGame=()=>run('Resetting game',async()=>{
    const result=await hostAction('reset-game',{confirmation:resetText});
    localStorage.removeItem(sessionKey);music.reset();
    for(const key of Object.keys(sessionStorage))if(key.startsWith('infinite-pokemon-hidden-objective:'))sessionStorage.removeItem(key);
    setToken(null);setState(null);setAutoEnter(false);setAutoGuest(false);setAutoPlay(false);setPromotingPreview(false);setName('');setAuthUrl('');checkedConnection.current=false;
    setHost(await request('/api/bootstrap'));setInfo(await request('/api/info'));setHomeSettings(false);setConfirmReset(false);setResetText('');
    history.replaceState(null,'',location.pathname+'?world=main');
    setDialog({title:'Game reset',text:result.warning??'All game progress and settings have been cleared. Your next adventure starts fresh.'});
  });
  const connectAndPlay=()=>run('Connecting to Codex',async()=>{
    checkedConnection.current=true;
    setAutoEnter(false);
    const result=await hostAction('connect');
    setHost(await request('/api/bootstrap'));
    if(!result.authenticated){const login=await hostAction('login');setAuthUrl(login.authUrl??'');return;}
    setAuthUrl('');setBusy('Checking Codex');
    await hostAction('verify',{consent:true});
    if(isPreview)setPromotingPreview(true);
    setHost(await request('/api/bootstrap'));if(!state||isPreview)setAutoEnter(true);else setHostOpen(false);
  });
  const disconnectHarness=()=>run('Disconnecting harness',async()=>{
    checkedConnection.current=true;setAutoEnter(false);setAuthUrl('');await hostAction('disconnect');setHost(await request('/api/bootstrap'));setSwitchHarness(false);
  });
  const applyHarnessSwitch=(account=false)=>run('Switching harness',async()=>{
    checkedConnection.current=true;setAutoEnter(false);setAuthUrl('');
    const result=await hostAction(account?'switch-account':'switch-connection',account?{}:{executable:harnessPath});
    setHost(await request('/api/bootstrap'));setSwitchHarness(false);
    if(account){setAuthUrl(result.authUrl??'');return;}
    if(!result.authenticated){const login=await hostAction('login');setAuthUrl(login.authUrl??'');return;}
    await hostAction('verify',{consent:true});setHost(await request('/api/bootstrap'));if(isPreview){setPromotingPreview(true);setAutoEnter(true);}
  });
  const optionalSettings=<details className="server-details optional-game-settings"><summary>Optional settings</summary>
    <section className="render-settings" aria-label="Map loading settings"><label className="field">Generation batch size<select aria-label="Generation batch size" value={host?.generationBatchSize??DEFAULT_GENERATION_BATCH_SIZE} disabled={!!busy} onChange={event=>{const batchSize=Number(event.target.value);void run('Updating generation batch size',async()=>{await hostAction('generation-batch',{batchSize});setHost(await request('/api/bootstrap'));});}}>{Array.from({length:MAX_GENERATION_BATCH_SIZE},(_,i)=>i+1).map(size=><option key={size} value={size}>{size===1?'1 — One at a time':`${size} — Up to ${size} blocks at once`}</option>)}</select></label><p className="small-copy">Default: 3. Lowering this setting lets active jobs finish.</p><label className="field">Map generation depth<select aria-label="Map generation depth" value={host?.renderDepth??1} disabled={!!busy} onChange={event=>{const depth=Number(event.target.value);void run('Updating map depth',async()=>{await hostAction('render-depth',{depth});setHost(await request('/api/bootstrap'));});}}>{[0,1,2,3].map(depth=><option key={depth} value={depth}>{depth===0?'0 — Generate on arrival':`${depth} — ${surroundingMapCount(depth)} surrounding maps`}</option>)}</select></label><p className="small-copy">Default: 1. Cached maps are reused. Larger depths may use more tokens.</p><p className="small-copy">{host?.preview?'Preview uses its five prepared areas; no maps are generated.':(host?.renderDepth??1)===0?'No maps are generated ahead of you. Entering a new map may require waiting.':'Maps are queued nearest to players first. The host controls this setting for the run.'}</p>{state?.streaming?<p className="small-copy">Nearby maps ready: {state.streaming.nearbyReady}/{state.streaming.nearbyTotal} · Queued: {state.streaming.queued}</p>:null}</section>
    <label className="field">Trainer nickname (optional)<input value={name} onChange={e=>setName(e.target.value)} maxLength={18} placeholder="Trainer" autoComplete="off"/></label>
    <button className="button saves-entry" onClick={()=>setSavesOpen(true)}>Saves &amp; runs</button>
    {host?.parentUrl?<button className="button original-world" onClick={()=>location.assign(host.parentUrl!)}>Return to original world</button>:null}
  </details>;
  const hostControls=<>
    {state?<section className="harness-settings" aria-label="AI harness settings"><h3>AI harness</h3><p>{harnessReady?'Connected to local Codex':'AI harness disconnected'}</p><p className="small-copy">Disconnecting stops generation and automatic reconnection. Completed maps remain playable; your Codex CLI stays signed in.</p><div className="button-row"><button className="button" disabled={!!busy} onClick={()=>{setHarnessPath(host?.harnessExecutable??'');setSwitchHarness(value=>!value);}}>Switch harness</button><button className="button" disabled={!!busy||host?.status.state==='disconnected'} onClick={()=>void disconnectHarness()}>Disconnect harness</button></div>
      {switchHarness?<div className="harness-switch"><p>Choose another Codex account or local CLI connection.</p><button className="button" disabled={!!busy} onClick={()=>void applyHarnessSwitch(true)}>Switch Codex account</button><label className="field">Codex CLI path (optional)<input value={harnessPath} onChange={event=>setHarnessPath(event.target.value)} placeholder="Leave empty for default Codex" disabled={!!busy}/></label><p className="small-copy">Use an absolute path to Codex or codex.js. Currently supports Codex-compatible local connections. Switching and verifying can use your Codex allowance.</p><div className="button-row"><button className="button primary" disabled={!!busy} onClick={()=>void applyHarnessSwitch()}>Switch and connect</button><button className="button" disabled={!!busy} onClick={()=>setSwitchHarness(false)}>Cancel</button></div></div>:null}
    </section>:null}
    {!harnessReady?<>
      <section className="connect-launch" aria-label="Connect and play" hidden={switchHarness&&!!state}>
        <p className="connect-intro">{localMode==='multiplayer'?'Connect your local Codex to host an adventure. Friends can join without it.':'Connect your local Codex and let the adventure grow.'}</p>
        <button className="button primary connect-codex-button" aria-label="Connect to Codex" disabled={!!busy||host?.status.state==='verifying'} onClick={()=>void connectAndPlay()}>{busy?busy:'Connect to Codex'}<span className="connect-start-hint">{busy?'Please wait…':'Start your adventure'}</span></button>
        <p className="connect-consent">By connecting, you allow verification and background generation to use your Codex allowance and send gameplay context to your provider. Usage charges may apply.</p>
        {authUrl?<div className="sign-in"><a href={authUrl} target="_blank" rel="noreferrer">Sign in to Codex</a><button className="button" disabled={!!busy} onClick={()=>void connectAndPlay()}>I’ve signed in — continue</button></div>:null}
        {host?.status.mode==='test'?<p className="small-copy">Deterministic test harness · no model calls</p>:null}
        {!state&&!host?.preview&&!host?.parentUrl&&localMode==='singleplayer'?<div className="preview-option"><button className="button preview-launch-button" disabled={!!busy} onClick={()=>void playPreview()}>Play tutorial preview</button><p className="small-copy muted">Five prepared areas. No Codex or tokens needed.</p></div>:null}
      </section>
    </>:<>
      {host?.sessionMode==='multiplayer'&&host.ready?<div className="session-address"><p>Friends on your network can join using:</p><label className="field">Session address<input value={shareAddress} readOnly/></label><button className="button" onClick={()=>void navigator.clipboard?.writeText(shareAddress)}>Copy session address</button>{shareAddresses.length>1?<details className="server-details"><summary>Other network addresses</summary><ul className="session-address-list">{shareAddresses.slice(1).map(url=><li key={url}><code>{url}</code><button className="button" onClick={()=>void navigator.clipboard?.writeText(url)} aria-label={'Copy '+url}>Copy</button></li>)}</ul></details>:null}<p className="small-copy muted">Use your public proxy URL when playing over the internet.</p></div>:null}
      {state?<><p>{host?.sessionMode==='multiplayer'?'Multiplayer is open.':'Your world is in single player mode.'}</p><button className="button" disabled={!!busy} onClick={()=>void run('Updating session',async()=>{await hostAction('session',{sessionMode:host?.sessionMode==='multiplayer'?'singleplayer':'multiplayer'});setHost(await request('/api/bootstrap'));})}>{host?.sessionMode==='multiplayer'?'Return to single player':'Enable multiplayer'}</button><button className="button" onClick={()=>void run('Saving backup',async()=>{const r=await hostAction('backup');setDialog({title:'World backup',text:r.message});})}>Back up world</button></>:null}

    </>}
    {busy||host?.starting||autoEnter&&harnessReady?<p className="progress-message" role="status"><span className="loading-dot"/>{busy||(host?.starting?'Imagining nearby stories':'Entering your adventure')}…</p>:null}
    {optionalSettings}
  </>;

  const target=state?objectInFront({...state.region,objects:sceneObjects(state.region).filter(object=>object.kind!=='item'||!state.me.collectedItems?.includes(state.me.regionId+':'+(state.me.sceneId??'outdoor')+':'+object.id))},state.me,state.me.facing):undefined;
  const interactLabel=target?.kind==='door'?(target.targetScene==='outdoor'?'Exit building':'Enter building'):target?.role?'Talk to '+(target.name??'traveler'):target?.kind==='item'?'Pick up item':target?.kind==='sign'?'Read sign':target?'Inspect '+(target.name??target.kind):'Face something beside you';
  const errorToast=error?<div className="toast" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>:null;
  const savesDialog=savesOpen&&host?<Modal title="Saves & runs" onClose={()=>setSavesOpen(false)}><SaveBrowser hostToken={host.hostToken} onClose={()=>setSavesOpen(false)}/></Modal>:null;
  const dialogue=dialog?<Modal title={dialog.title} dialogue onClose={()=>setDialog(null)}><p className="dialogue-text">{dialog.text}</p>{dialog.interaction?.kind==="npc"&&state?.variety?.npcTraits?<p className="npc-traits">{state.variety.npcTraits.temperament} · {state.variety.npcTraits.interest}</p>:null}{dialog.connectRequired?<button className="button primary" onClick={connectPreview}>Connect to Codex</button>:null}{state?.me.tutorial===4&&state.me.tutorialFlags.includes('trainerWon')&&target?.role==='guide'?<div className="button-row"><button className="button" onClick={()=>{setDialog(null);act({kind:'choice',choice:'protect'});}}>Protect the Waystone</button><button className="button" onClick={()=>{setDialog(null);act({kind:'choice',choice:'explore'});}}>Explore beyond it</button></div>:null}{dialog.interaction?.role==='guide'&&state&&[1,2].includes(state.me.tutorial)&&state.me.lessonRegion===state.me.regionId&&!state.me.battle?<button className="button" onClick={()=>{setDialog(null);act({kind:'encounter'});}}>{state.me.tutorial===1?'Practice battle':'Practice catching'}</button>:null}<button className="button primary dialogue-next" onClick={()=>setDialog(null)}>Continue <span className="dialogue-key-hint">E / Space</span><span aria-hidden="true">▼</span></button></Modal>:null;

  const connectionErrorDialog=connectionError?<Modal title="Connection problem" onClose={()=>{setConnectionError(null);setMode('welcome');setAutoEnter(false);}}><p>{connectionError}</p><div className="button-row"><button className="button primary" disabled={!!busy} onClick={()=>{setConnectionError(null);if(harnessReady){setMode('host');setAutoEnter(true);}else void connectAndPlay();}}>Try again</button><button className="button" onClick={()=>{setConnectionError(null);setMode('welcome');setAutoEnter(false);}}>Back</button></div></Modal>:null;
  if(!state)return <div className="console-shell">
    <main className="title-screen">
      <div className="title-landscape"><Landscape/></div>
      <div className="title-shade"/>
      {mode==='host'?<section className="connection-page" aria-label="Connect to Codex">
        {!harnessReady&&!host?.rememberedConnection&&!busy?hostControls:<p className="connection-progress" role="status">{connectionError?'Connection needs attention.':busy||'Entering your adventure…'}</p>}
        <button className="button quiet" disabled={!!busy||!!token} onClick={()=>{setMode('welcome');setAutoEnter(false);}}>Back to title</button>
      </section>:<>      <div className="title-heading"><h1 className="title-wordmark"><img className="brand-logo" src="/branding/infinite-pokemon-logo.svg" alt="Infinite Pokémon" width="800" height="260" fetchPriority="high"/></h1></div>
      <div className="title-companions">{STARTERS.map(s=><CreatureArt key={s} species={s} size={128}/>)}</div>
      <nav className="title-menu pixel-window" aria-label="Title menu">
        <button disabled={!info} onClick={()=>beginLocal('singleplayer')}><span>Single player</span></button>
        <button onClick={()=>setMode('multiplayer')}><span>Multiplayer</span></button>
      </nav>
      <div className="title-footer">Your adventure, alone or together.</div>
      {host?<button className="home-settings-button" onClick={openHomeSettings} aria-label="Home settings">Settings</button>:null}
      <span className="title-version">FAN GAME · v0.1</span></>}
    </main>
    <MusicControls music={music}/>
    {homeSettings?<Modal title={confirmReset?'Reset entire game?':'Home settings'} onClose={()=>{if(!busy){setHomeSettings(false);setConfirmReset(false);setResetText('');}}}>
      <section className="full-reset-settings">
        <h3>Full game reset</h3>
        <p>Erase every run, save checkpoint, generated map and story, trainer, companion, item, and game setting on this host. Connected guests will be disconnected.</p>
        <p className="small-copy">This is separate from save management and cannot be undone. The game forgets its Codex approval; your Codex CLI stays signed in.</p>
        {confirmReset?<><label className="field">Type RESET to confirm<input aria-label="Type RESET to confirm" value={resetText} onChange={event=>setResetText(event.target.value)} autoComplete="off" spellCheck={false} disabled={!!busy}/></label><div className="button-row"><button className="button danger" disabled={resetText!=='RESET'||!!busy||!host} onClick={()=>void resetEntireGame()}>Erase game data</button><button className="button" disabled={!!busy} onClick={()=>{setConfirmReset(false);setResetText('');}}>Cancel</button></div></>:<button className="button danger" disabled={!host||!!busy} onClick={()=>setConfirmReset(true)}>Reset entire game…</button>}
        {busy?<p role="status">{busy}…</p>:null}
      </section>
    </Modal>:null}
    {mode==='multiplayer'||mode==='join'?<Modal title={mode==='join'?'Join session':'Multiplayer'} onClose={()=>{setMode('welcome');setAutoEnter(false);setAutoGuest(false);}}>
      {mode==='multiplayer'?<div className="mode-menu"><button className="button primary" onClick={()=>beginLocal('multiplayer')}>Host session</button><button className="button" onClick={()=>setMode('join')}>Join session</button></div>:null}
      {mode==='join'?<form onSubmit={e=>{e.preventDefault();void join();}}>
        <label className="field">Server address<input value={address} onChange={e=>setAddress(e.target.value)} placeholder={info?.hostAvailable?'127.0.0.1:'+info.gamePort:location.host} autoComplete="off"/></label>
        <p className="small-copy muted">Enter your host’s IP or URL, or leave this blank to join this server.</p>
        <details className="server-details"><summary>Choose a trainer nickname</summary><label className="field">Trainer nickname (optional)<input value={name} onChange={e=>setName(e.target.value)} maxLength={18} placeholder="Trainer" autoComplete="off"/></label></details>
        {!address.trim()&&info&&!info.hostAvailable&&(!info.ready||info.sessionMode!=='multiplayer')?<p className="progress-message">This host hasn’t opened multiplayer yet.</p>:null}
        <button className="button primary join-session-button" disabled={!!busy||(!address.trim()&&!info?.hostAvailable&&(!info?.ready||info.sessionMode!=='multiplayer'))} type="submit">Join session</button>
        {busy?<p className="progress-message" role="status">{busy}…</p>:null}
      </form>:null}
    </Modal>:null}
    {connectionErrorDialog}{dialogue}{errorToast}{savesDialog}
    <div className="console-caption">A Pokémon-style adventure that grows as you play</div>
  </div>;

  const me=state.me,lesson=TUTORIALS[me.tutorial],battle=me.battle,lead=me.party[me.active];
  const openTab=(next:typeof tab)=>{setMenuOpen(false);setTab(next);};
  return <div className="console-shell">
    <div className="game-topline"><span>INFINITE POKÉMON</span><span className="link-status"><i className={'signal '+(connected?'live':'')}/>{connected?(isPreview?'TUTORIAL PREVIEW':host?.sessionMode==='singleplayer'?'SINGLE PLAYER':'LINK CONNECTED'):'RECONNECTING'}</span></div>
    <main className="game-screen">
      <div className="viewport">
        <GenerationIndicator background={state.streaming?.background} connected={connected} battle={!!battle} onOpen={openAgent}/>
        <Suspense fallback={<div className="canvas-loading">Opening your map…</div>}><GameCanvas key={connectionEpoch} state={state} blocked={blocked} onMove={(direction,seq)=>act({kind:'move',direction,seq})} onInteract={()=>act({kind:'interact'})} movementFeedback={movementFeedback} moveRequest={moveRequest} interactRequest={interactRequest} heldDirection={heldDirection}/></Suspense>
        {!battle?<><div className="location-sign"><h1>{state.region.name}</h1></div><button className="start-button" onClick={()=>{setTab(null);setMenuOpen(!menuOpen);}} aria-label="Open game menu" aria-keyshortcuts="Escape">START</button></>:null}
        {menuOpen?<nav className="start-menu pixel-window" aria-label="Game menu">
          <button aria-label="Your team" onClick={()=>openTab('party')}>POKÉMON</button>
          <button onClick={()=>openTab('codex')}>CODEX</button>
          <button onClick={()=>openTab('bag')}>BAG</button>
          <button aria-label="Trainer profile" onClick={()=>openTab('trainer')}>{me.name.toUpperCase()}</button>
          <button aria-label="Field journal" onClick={()=>openTab('journal')}>JOURNAL</button>
          <button aria-label="World map" onClick={()=>openTab('map')}>TOWN MAP</button>
          <button onClick={()=>openTab('nursery')}>NURSERY</button>
          <button onClick={()=>openTab('rides')}>RIDES</button>
          <button onClick={()=>openTab('records')}>RECORDS</button>
          <button onClick={openAgent}>AGENT</button>
          <button onClick={()=>{setMenuOpen(false);act({kind:'save'});}}>SAVE</button>
          {host?<button onClick={()=>{setMenuOpen(false);setSavesOpen(true);}}>SAVES</button>:null}
          {host?<button onClick={()=>{setMenuOpen(false);setHostOpen(true);}}>SESSION</button>:null}
          <button onClick={()=>setMenuOpen(false)}>EXIT</button>
        </nav>:null}
        {battle&&lead?<EncounterBattle key={battle.id} animate={encounterId===battle.id&&!battle.finished} state={state} notices={battleNotices} onAction={act} errorVersion={battleErrorVersion} connected={connected} overlayBlocked={!!dialog||hostOpen||agentOpen}/>:null}      </div>
      {!battle?<ObjectivePanel key={me.id+':'+(me.tutorial<5?me.tutorial:me.regionId)} playerId={me.id} objectiveId={me.tutorial<5?'lesson:'+me.tutorial:'story:'+me.regionId} blocked={blocked}>{me.tutorial<5?<><strong>{lesson.title}.</strong> {me.lessonRegion!==me.regionId?'Take any exit from this area. Your next guide is waiting.':lesson.description}</>:isPreview?'You have finished the tutorial! Explore the five prepared areas, or connect Codex to continue your adventure.':state.region.hook}</ObjectivePanel>:null}
    </main>
    <div className="game-controls">
      <MusicControls music={music}/>
      {me.egg?<p className="egg-progress">Egg: {Math.max(0,me.egg.hatchAtStep-me.steps)} steps until hatching</p>:null}
      <div className="action-strip contextual"><button aria-label="Interact" onClick={()=>setInteractRequest({id:commandId()})} disabled={blocked||!target}>{interactLabel} <kbd>E</kbd></button><span>Stand beside an object and face it.</span></div>
      <div className="touch-controls" aria-label="Touch controls">{(['north','west','south','east'] as Direction[]).map(direction=><button key={direction} data-direction={direction} disabled={blocked} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setMoveRequest({direction,id:commandId()});setHeldDirection(direction);}} onPointerUp={()=>setHeldDirection(undefined)} onPointerCancel={()=>setHeldDirection(undefined)} onPointerLeave={()=>setHeldDirection(undefined)} onLostPointerCapture={()=>setHeldDirection(undefined)} onClick={event=>{if(event.detail===0)setMoveRequest({direction,id:commandId()});}}>{{north:'↑',west:'←',south:'↓',east:'→'}[direction]}</button>)}</div>
      <div className="control-legend"><span><kbd>W A S D</kbd> MOVE <kbd>E</kbd> INTERACT <kbd>ESC</kbd> MENU</span><span className="world-window-top">{state.players.length} trainer{state.players.length===1?'':'s'} nearby{state.generation.mode==='test'?' · Test harness':''}</span></div>
    </div>
    {isPreview?<div className="preview-notice"><span>Tutorial preview · 5 prepared areas</span><button className="button" onClick={connectPreview}>Connect to Codex</button></div>:null}
    {tab?<Modal title={{party:'Your Pokémon',bag:'Your bag',trainer:'Trainer card',journal:'Adventure journal',map:'Town map',shop:'Trail shop',nursery:'Companion nursery',records:'Run leaderboards',rides:'Your rides',items:'Items & supplies',codex:'Companion codex'}[tab]} onClose={()=>setTab(null)}>
      {(['shop','nursery','records','rides','items','codex'] as string[]).includes(tab)?<VarietyPanels tab={tab as VarietyTab} state={state} onAction={act}/>:null}
      {tab==='party'?<><div className="party-list">{me.party.map((creature,index)=><button className={'companion-card '+(index===me.active?'active':'')} key={creature.id} onClick={()=>{if(index!==me.active){setTab(null);act({kind:'switch',index});}}}><CreatureArt creature={creature} size={80}/><div><strong>{creatureInfo(creature).name}</strong><span>Lv{creature.level}{index===me.active?' · LEADER':''}</span><Health creature={creature}/><small className="creature-traits">{creature.traits?.join(" · ")}</small></div><Ball small/></button>)}</div><p className="menu-help">Choose a Pokémon to lead your party.</p><p>{me.storage.length} Pokémon are resting in storage.</p><div className="storage-list">{me.storage.map(c=><div className="catalog-row" key={c.id}><CreatureArt creature={c} size={48}/><div><strong>{creatureInfo(c).name}</strong><small>Lv{c.level} · {c.hp}/{c.maxHp} HP</small></div><button className="button" onClick={()=>act({kind:"swapStorage",storageId:c.id,partyIndex:me.party.length<6?me.party.length:me.active})}>{me.party.length<6?"Add to team":"Swap with leader"}</button></div>)}</div></>:null}
      {tab==='bag'?<><button className="button" onClick={()=>setTab('items')}>All items &amp; supplies</button><div className="bag-items"><div><Ball small/><span>POKé BALL</span><strong>× {me.balls}</strong></div><div><span>POTION</span><strong>× {me.potions}</strong></div><div><span>MONEY</span><strong>₽ {me.coins}</strong></div></div><div className="button-row"><button className="button" onClick={()=>{setTab(null);act({kind:'potion'});}}>Use a potion on your leader</button></div><p className="menu-help">Enter a healing house and speak to the nurse to rest.</p></>:null}
      {tab==='trainer'?<div className="trainer-profile"><div className="trainer-card-name"><Ball/><strong>{me.name}</strong></div><dl><div><dt>STATUS</dt><dd>{me.tutorial===5?'Valley explorer':'New trainer'}</dd></div><div><dt>POKéMON</dt><dd>{me.party.length+me.storage.length}</dd></div><div><dt>PLACES</dt><dd>{me.visited.length}</dd></div><div><dt>MONEY</dt><dd>₽ {me.coins}</dd></div></dl><button className="button" aria-label="Leave world" onClick={leave}>Leave world</button></div>:null}
      {tab==='journal'?<><section className="quest-card"><span>LESSON {Math.min(me.tutorial+1,5)} / 5</span><h3>{lesson.title}</h3><p>{me.lessonRegion!==me.regionId&&me.tutorial<5?'Follow any exit. Your next guide meets you along the path you choose.':lesson.description}</p>{me.tutorial===4&&me.tutorialFlags.includes('trainerWon')?<div className="button-row"><button className="button" onClick={()=>act({kind:'choice',choice:'protect'})}>Protect the Waystone</button><button className="button" onClick={()=>act({kind:'choice',choice:'explore'})}>Explore beyond it</button></div>:null}</section><div className="travel-log">{me.journal.slice(0,8).map((entry,i)=><p key={i}>{entry}</p>)}</div></>:null}
      {tab==='map'?<><p>{state.regions.length} places discovered together.</p><div className="world-atlas">{state.regions.map(region=><div key={region.id} className={region.id===me.regionId?'here':''}><span>{region.id===me.regionId?'▶':'·'}</span><div><strong>{region.name}</strong><small>{region.gx}, {region.gy}{region.id===me.regionId?' · YOU ARE HERE':''}</small></div></div>)}</div></>:null}
    </Modal>:null}
    {!me.introDone?<Modal title="The valley beyond the map"><div className="intro-illustration"><Landscape/></div><p className="dialogue-text" key={intro}>{["For years, the maps of Willow Valley ended at the same four paths. Then, one morning, the Waystone began to glow.","Beyond the trees, new trails appeared. Travelers brought unfamiliar stories. The valley seemed to remember everyone who passed through.",state.worldChoice?"Other travelers have already shaped the valley. Now your own story joins theirs.":"Today, you set out with a small satchel and a little courage. A first companion is waiting. What will the valley remember about you?"][intro]}</p><div className="intro-controls">{host?<button className="button quiet" onClick={()=>setSavesOpen(true)}>Saves &amp; runs</button>:null}<button className="button quiet" onClick={()=>act({kind:'intro'})}>Skip introduction</button><span>{intro+1} / 3</span><button className="button primary" onClick={()=>{if(intro<2)setIntro(intro+1);else act({kind:'intro'});}}>{intro<2?'Continue':'Step into Willowbrook'}</button></div></Modal>:!me.party.length?<Modal title="Choose your first companion">{host?<button className="button quiet" onClick={()=>setSavesOpen(true)}>Saves &amp; runs</button>:null}<p>Choose the Pokémon that will travel with you.</p><div className="starter-choices">{STARTERS.map(s=><button key={s} onClick={()=>act({kind:'starter',species:s as 'bulbasaur'|'charmander'|'squirtle'})}><CreatureArt species={s} size={128}/><strong>{SPECIES[s].name}</strong><span>{SPECIES[s].type.toUpperCase()}</span></button>)}</div></Modal>:null}
    {dialogue}
    {agentOpen&&token?<Modal title="Agent activity" onClose={()=>setAgentOpen(false)}><AgentPanel token={token}/><button className="button" onClick={()=>setAgentOpen(false)}>Back to game</button></Modal>:null}
    {connectionErrorDialog}
    {hostOpen&&!connectionError?<Modal title="Session" onClose={()=>setHostOpen(false)}>{hostControls}</Modal>:null}
    {savesDialog}
    {(mapWaiting||state.streaming?.travel)&&!hostOpen&&!savesOpen&&!agentOpen?<Modal title="Preparing the next map" onClose={()=>{act({kind:'cancelTravel'});setMapWaiting(false);}}><div className="map-loading" data-phase={state.streaming?.travel?.phase??'queued'}><p>{state.streaming?.travel?.message??'Waiting for the map generation queue…'}</p><p className="small-copy">Destination: {state.streaming?.travel?.name??'Next map'}</p>{['queued','generating'].includes(state.streaming?.travel?.phase??'queued')?<progress aria-label="Map generation in progress"/>:null}{state.streaming?.travel?.queuePosition?<p>Queue position: {state.streaming.travel.queuePosition}</p>:null}{state.streaming?.travel?.phase==='generating'?<p>Generating for {Math.floor(state.streaming.travel.elapsedMs/1000)} seconds…</p>:null}<p className="small-copy">You will enter automatically when this map is ready.</p><div className="button-row"><button className="button" onClick={openAgent}>View agent activity</button>{state.streaming?.travel?.phase==='failed'?<button className="button primary" disabled={!connected} onClick={()=>act({kind:'retryTravel'})}>Retry generation</button>:null}{host?<button className="button" onClick={()=>setHostOpen(true)}>Generation settings</button>:null}<button className="button" onClick={()=>{act({kind:'cancelTravel'});setMapWaiting(false);}}>Cancel travel</button></div></div></Modal>:null}
    {!connected?<div className="reconnecting" role="status">Reconnecting to the world server… Your progress is saved.</div>:null}
    {errorToast}
  </div>;
}
