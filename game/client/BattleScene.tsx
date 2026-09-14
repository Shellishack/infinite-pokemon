import {playSfx} from './sfx';
import type {SfxCue} from '../shared/sfx';
import { useEffect, useRef, useState } from 'react';
import {creatureImage} from './content-art';
import {ITEMS} from '../shared/content';
import { ATTACK_PP, SPECIES, creatureInfo, type Action, type Battle, type Creature, type GameState } from '../shared/model';

export interface BattleNotice { id:string; battleId:string; text:string }
interface Snapshot { battle:Battle; party:Creature[]; active:number; balls:number; potions:number; name:string }
interface Display { player:Creature; enemy:Creature }
type Motion = 'none'|'player-attack'|'enemy-attack'|'enemy-hit'|'player-hit'|'capture'|'switch'|'heal';
interface Frame { sound?:SfxCue;text:string; motion:Motion; enemy?:Creature; player?:Creature; hideEnemy?:boolean }
type Menu = 'main'|'moves'|'bag'|'party';
const copy=<T,>(value:T):T=>structuredClone(value);
const lead=(snapshot:Snapshot)=>snapshot.party[snapshot.active];
function pageFrame(frame:Frame):Frame[]{
  if(frame.text.length<=78)return [frame];
  const pages:string[]=[];let page='';
  for(const word of frame.text.split(/\s+/)){if(page.length+word.length+1>78){pages.push(page);page=word;}else page+=(page?' ':'')+word;}
  if(page)pages.push(page);
  return pages.map((text,index)=>index?{text,motion:'none'}:{...frame,text});
}

function appended(previous:string[],next:string[]){
  for(let count=Math.min(previous.length,next.length);count>0;count--){
    if(previous.slice(-count).every((value,index)=>value===next[index]))return next.slice(count);
  }
  return next;
}

// These are presentation frames only. Endpoints are server snapshots; damage
// stages come from the server's own log, never a client-side combat roll.
function turnFrames(before:Snapshot,after:Snapshot,action?:Action):Frame[]{
  let lines=appended(before.battle.log,after.battle.log);
  if(!lines.length&&(after.battle.round>before.battle.round||action?.kind==='potion'||action?.kind==='switch'))lines=after.battle.log.slice(action?.kind==='battle'&&action.action==='capture'&&!after.battle.finished?-3:-2);
  const frames:Frame[]=[];
  let player=copy(lead(before)),enemy=copy(before.battle.enemy);
  for(const text of lines){
    const enemyDamage=text.match(/fought back for (\d+) damage/i);
    const recoil=text.match(/took (\d+) recoil damage/i);
    const playerDamage=text.match(/(?:! (\d+) damage\.|dealt (\d+) damage\.)/i);
    if(recoil){player={...player,hp:Math.max(0,player.hp-Number(recoil[1]))};frames.push({text,motion:'player-hit',player:copy(player)});}
    else if(enemyDamage){
      player={...player,hp:Math.max(0,player.hp-Number(enemyDamage[1]))};
      frames.push({text,motion:'enemy-attack',player:copy(player)});
    }else if(playerDamage){
      enemy={...enemy,hp:Math.max(after.battle.enemy.hp,enemy.hp-Number(playerDamage[1]??playerDamage[2]))};
      frames.push({text,motion:!text.includes(' dealt ')||text.startsWith(before.name+' dealt ')?'player-attack':'enemy-hit',enemy:copy(enemy)});
    }else if(/recovered (\d+) HP/i.test(text)){
      const restored=Number(text.match(/recovered (\d+) HP/i)![1]);
      player={...player,hp:Math.min(player.maxHp,player.hp+restored)};
      frames.push({text,motion:'heal',player:copy(player)});
    }else if(/grew to level/i.test(text)){
      player=copy(lead(after));frames.push({text,motion:'heal',player,sound:'level-up'});
    }else if(/steps in|sent out|switched/i.test(text)){
      const selected=/sent out/i.test(text)&&action?.kind==='switch'?before.party[action.index]:before.party.find(c=>text.includes(creatureInfo(c).name))??lead(after);
      player=copy(selected);frames.push({text,motion:'switch',player});
    }else if(/Gotcha!|broke free|threw /i.test(text)){
      frames.push({text,motion:/threw /i.test(text)?'capture':'none',sound:/Gotcha!/i.test(text)&&after.battle.finished&&after.battle.won?'capture-success':undefined,hideEnemy:/Gotcha!/i.test(text)&&after.battle.finished&&after.battle.won});
    }else frames.push({text,motion:'none'});
  }
  // Reconcile authoritative rewards, switches, and co-op changes even when a
  // compact/truncated server log cannot describe every intermediate update.
  frames.push({text:'',motion:lead(after).id!==player.id?'switch':lead(after).hp<player.hp?'player-hit':lead(after).hp>player.hp?'heal':'none',player:copy(lead(after)),enemy:copy(after.battle.enemy)});
  if(action?.kind==='battle'&&action.action==='run'&&after.battle.finished&&!after.battle.won)frames.push({text:'',motion:'none',sound:'escape'});
  return frames.flatMap(pageFrame);
}

export default function BattleScene({state,notices,onAction,errorVersion,connected,overlayBlocked=false,introPaused=false}:{state:GameState;notices:BattleNotice[];onAction:(action:Action)=>void;errorVersion:number;connected:boolean;overlayBlocked?:boolean;introPaused?:boolean}){
  const battle=state.me.battle!;
  const root=useRef<HTMLDivElement>(null);
  const current=useRef<Snapshot>({battle:copy(battle),party:copy(state.me.party),active:state.me.active,balls:state.me.balls,potions:state.me.potions,name:state.me.name});
  const displayRef=useRef<Display>({player:copy(lead(current.current)),enemy:copy(battle.enemy)});
  const [display,setDisplay]=useState(displayRef.current),[text,setText]=useState(battle.log[0]??''),[menu,setMenu]=useState<Menu>('main');
  const [playing,setPlaying]=useState(true),[waiting,setWaiting]=useState(false),[motion,setMotion]=useState<Motion>('none'),[motionKey,setMotionKey]=useState(0),[enemyHidden,setEnemyHidden]=useState(false),[selectedMove,setSelectedMove]=useState<'attack'|'special'>('attack');
  const pending=useRef<Frame[]>(battle.log.flatMap(text=>pageFrame({text,motion:'none'}))),running=useRef(false),mounted=useRef(false),waitingRef=useRef(false),seenNotices=useRef(new Set<string>()),pendingNotices=useRef<BattleNotice[]>([]),abort=useRef(new AbortController());
  const fingerprint=useRef(JSON.stringify(current.current)),pendingAction=useRef<Action|undefined>(undefined);
  const reduced=useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const disabled=introPaused||playing||waiting||overlayBlocked||!connected||!!battle.actions?.[state.me.id];
  const wait=(ms:number)=>new Promise<void>(done=>{if(abort.current.signal.aborted){done();return;}const finish=()=>{clearTimeout(timer);abort.current.signal.removeEventListener('abort',finish);done();};const timer=setTimeout(finish,ms);abort.current.signal.addEventListener('abort',finish,{once:true});});
  const update=(next:Display)=>{displayRef.current=next;setDisplay(next);};
  const animateHP=async(side:'player'|'enemy',target:Creature)=>{
    const from=displayRef.current[side];
    if(from.id!==target.id||from.hp===target.hp||reduced.current){update({...displayRef.current,[side]:copy(target)});return;}
    const started=performance.now(),duration=420;
    while(!abort.current.signal.aborted){
      const progress=Math.min(1,(performance.now()-started)/duration);
      update({...displayRef.current,[side]:{...target,hp:Math.round(from.hp+(target.hp-from.hp)*progress)}});
      if(progress===1)break;
      await wait(16);
    }
  };
  const pump=async()=>{
    if(introPaused||running.current)return;running.current=true;setPlaying(true);
    while(pending.current.length&&!abort.current.signal.aborted){
      const frame=pending.current.shift()!;
      if(frame.text)setText(frame.text);
      setMotion(frame.motion);const sound=frame.sound??({'player-attack':'attack','enemy-attack':'attack','enemy-hit':'hit','player-hit':'hit',capture:'capture-throw',switch:'send-out',heal:'heal'} as Partial<Record<Motion,SfxCue>>)[frame.motion];if(sound)playSfx(sound);setMotionKey(key=>key+1);
      if(frame.motion==='player-attack'||frame.motion==='enemy-attack'){
        await wait(reduced.current?0:180);
        setMotion(frame.motion==='player-attack'?'enemy-hit':'player-hit');if(!abort.current.signal.aborted)playSfx('hit');
      }else if(frame.motion==='capture')await wait(reduced.current?0:360);
      if(abort.current.signal.aborted)break;
      if(frame.enemy)await animateHP('enemy',frame.enemy);
      if(frame.player)await animateHP('player',frame.player);
      if(frame.hideEnemy)setEnemyHidden(true);
      await wait(frame.text?(reduced.current?110:390):0);
      if(!abort.current.signal.aborted)setMotion('none');
    }
    running.current=false;
    if(!abort.current.signal.aborted){setPlaying(false);setMenu('main');}
  };
  useEffect(()=>{abort.current=new AbortController();const start=setTimeout(()=>{mounted.current=true;void pump();},0);return()=>{clearTimeout(start);mounted.current=false;abort.current.abort();};},[introPaused]);
  useEffect(()=>{
    const next:Snapshot={battle:copy(battle),party:copy(state.me.party),active:state.me.active,balls:state.me.balls,potions:state.me.potions,name:state.me.name};
    const key=JSON.stringify(next);
    if(key!==fingerprint.current){
      pending.current.push(...turnFrames(current.current,next,pendingAction.current));pendingAction.current=undefined;
      current.current=next;fingerprint.current=key;waitingRef.current=false;setWaiting(false);
    }
    for(const notice of notices)if(notice.battleId===battle.id&&!seenNotices.current.has(notice.id)){seenNotices.current.add(notice.id);pendingNotices.current.push(notice);}
    if(!waitingRef.current&&pendingNotices.current.length){pending.current.push(...pendingNotices.current.splice(0).flatMap(n=>pageFrame({text:n.text,motion:'none'})));}
    if(mounted.current&&pending.current.length)void pump();
  },[state.me.battle,state.me.party,state.me.active,state.me.balls,state.me.potions,notices]);
  useEffect(()=>{waitingRef.current=false;pendingAction.current=undefined;setWaiting(false);},[errorVersion,connected]);
  useEffect(()=>{if(!disabled)root.current?.querySelector<HTMLButtonElement>('button[data-command]:not(:disabled)')?.focus();},[menu,disabled]);
  const send=(action:Action)=>{if(disabled)return;waitingRef.current=true;pendingAction.current=action;setWaiting(true);setMenu('main');onAction(action);};
  const hp=(creature:Creature,side:'player'|'enemy')=><div className="gba-health" data-side={side} data-displayed-hp={creature.hp} data-target-hp={side==='enemy'?battle.enemy.hp:state.me.party.find(c=>c.id===creature.id)?.hp}><span>HP</span><div><i style={{width:Math.max(0,creature.hp/creature.maxHp*100)+'%',background:creature.hp<creature.maxHp/4?'#e05848':creature.hp<creature.maxHp/2?'#e8c840':'#58b888'}}/></div>{side==='player'?<small>{creature.hp}/{creature.maxHp}</small>:null}</div>;
  const captureAllowed=battle.kind==='wild'||battle.kind==='training';
  const bagItems=(state.variety?.inventoryItems??ITEMS.filter(item=>['poke-ball','potion'].includes(item.id))).filter(item=>item.effect!=='repel');
  const itemCount=(id:string)=>id==='poke-ball'?state.me.balls:id==='potion'?state.me.potions:state.me.items?.[id]??0;
  const pp=display.player.pp,struggle=!!pp&&pp.attack===0&&pp.special===0;
  const prompt=waiting?'Waiting for the turn…':battle.actions?.[state.me.id]?'Waiting for the other trainers…':'What will '+creatureInfo(display.player).name+' do?';
  const moveName=struggle?'Struggle':selectedMove==='attack'?'Tackle':creatureInfo(display.player).move;
  return <div ref={root} className="gba-battle" data-playback={playing?'playing':waiting?'waiting':'ready'} data-battle-phase={motion} data-round={battle.round} onKeyDown={event=>{
    if(disabled)return;
    const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('button[data-command]:not(:disabled)')];
    const index=Math.max(0,buttons.indexOf(document.activeElement as HTMLButtonElement));
    const delta=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:event.key==='ArrowDown'?2:event.key==='ArrowUp'?-2:0;
    if(delta){event.preventDefault();buttons[(index+delta+buttons.length)%buttons.length]?.focus();}
    else if(event.key==='Escape'&&menu!=='main'){event.preventDefault();setMenu('main');}
    else if(event.key.toLowerCase()==='e'||event.key.toLowerCase()==='z'){event.preventDefault();buttons[index]?.click();}
  }}>
    <div className="gba-field"/>
    <div className="gba-platform enemy"/><div className="gba-platform player"/>
    <div className="gba-status enemy"><div><strong>{creatureInfo(display.enemy).name.toUpperCase()}</strong><span>Lv{display.enemy.level}</span></div>{hp(display.enemy,'enemy')}</div>
    <div key={'enemy-'+motionKey} className={'gba-creature enemy '+(motion==='enemy-attack'?'lunge':motion==='enemy-hit'?'hit':'')} style={{opacity:enemyHidden||display.enemy.hp===0?0:1}}><img src={creatureImage(display.enemy)} alt={creatureInfo(display.enemy).name} width={64} height={64}/></div>
    <div key={'player-'+motionKey} className={'gba-creature player '+(motion==='player-attack'?'lunge':motion==='player-hit'?'hit':motion==='switch'?'switching':'')}><img src={creatureImage(display.player,true)} alt={creatureInfo(display.player).name+' back sprite'} width={64} height={64}/></div>
    {motion==='capture'?<div key={motionKey} className="gba-thrown-ball" aria-hidden="true"/>:null}
    <div className="gba-status player"><div><strong>{creatureInfo(display.player).name.toUpperCase()}</strong><span>Lv{display.player.level}</span></div>{hp(display.player,'player')}<div className="gba-xp"><i style={{width:Math.min(100,display.player.xp/20*100)+'%'}}/></div></div>
    <div className={'gba-bottom '+(menu==='main'?'':'selection')}>
      {menu==='main'?<>
        <div className="gba-message" role="status" aria-live="polite">{playing||battle.finished?text:prompt}</div>
        <div className="gba-commands">
          {battle.finished&&!playing?<button data-command aria-label="Back to the adventure" disabled={waiting||overlayBlocked} onClick={()=>send({kind:'battle',action:'close'})}>CONTINUE <span>▼</span></button>:<>
            <button data-command disabled={disabled} onClick={()=>setMenu('moves')}>FIGHT</button>
            <button data-command disabled={disabled} onClick={()=>setMenu('bag')}>BAG</button>
            <button data-command disabled={disabled} onClick={()=>setMenu('party')}>POKéMON</button>
            <button data-command disabled={disabled||battle.kind==='trainer'} onClick={()=>send({kind:'battle',action:'run'})}>{battle.kind==='coop'?'LEAVE':'RUN'}</button>
          </>}
        </div>
      </>:null}
      {menu==='moves'?<><div className="gba-moves"><button data-command disabled={disabled||!!pp&&pp.attack===0&&!struggle} onFocus={()=>setSelectedMove('attack')} onMouseEnter={()=>setSelectedMove('attack')} onClick={()=>send({kind:'battle',action:'attack'})}>{struggle?'Struggle':'Tackle'}</button>{!struggle?<button data-command disabled={disabled||!!pp&&pp.special===0} onFocus={()=>setSelectedMove('special')} onMouseEnter={()=>setSelectedMove('special')} onClick={()=>send({kind:'battle',action:'special'})}>{creatureInfo(display.player).move}</button>:<span>—</span>}<span>—</span><button data-command className="gba-back" onClick={()=>setMenu('main')}>CANCEL</button></div><div className="gba-move-info">{pp&&!struggle?<strong className="gba-pp">PP {selectedMove==='attack'?pp.attack:pp.special}/{selectedMove==='attack'?ATTACK_PP:creatureInfo(display.player).specialPp}</strong>:null}<span>TYPE/{struggle||selectedMove==='attack'?'NORMAL':creatureInfo(display.player).type.toUpperCase()}</span><small>{struggle?'No PP left':moveName}</small></div></>:null}
      {menu==='bag'?<div className="gba-item-menu">{bagItems.filter(item=>itemCount(item.id)>0).map(item=><button data-command key={item.id} disabled={disabled||(item.effect==='capture'&&!captureAllowed)||(item.effect==='heal'&&display.player.hp>=display.player.maxHp)||(item.effect==='revive'&&!state.me.party.some(c=>c.hp===0))} onClick={()=>send(item.effect==='capture'?{kind:'battle',action:'capture',ball:item.id}:item.id==='potion'?{kind:'potion'}:{kind:'useItem',itemId:item.id,index:item.effect==='revive'?state.me.party.findIndex(c=>c.hp===0):state.me.active})}>{item.id==='poke-ball'?'POKé BALL':item.name.toUpperCase()} <span>×{itemCount(item.id)}</span></button>)}<button data-command className="gba-back" onClick={()=>setMenu('main')}>CANCEL</button></div>:null}
      {menu==='party'?<div className="gba-party-menu">{state.me.party.map((creature,index)=><button data-command key={creature.id} disabled={index===state.me.active||creature.hp===0} onClick={()=>send({kind:'switch',index})}><img src={creatureImage(creature)} alt=""/><span>{creatureInfo(creature).name}<small>Lv{creature.level} · {creature.hp}/{creature.maxHp}</small></span></button>)}<button data-command className="gba-back" onClick={()=>setMenu('main')}>CANCEL</button></div>:null}
    </div>
  </div>;
}
