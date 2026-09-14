import { useEffect, useState, type ComponentProps, type CSSProperties } from 'react';
import BattleScene from './BattleScene';

type Phase = 'closing' | 'revealing' | 'done';

/** Keep the world visible until the shutters close, then reveal the battle. */
export default function EncounterBattle({animate,...battleProps}:ComponentProps<typeof BattleScene>&{animate:boolean}){
  const [phase,setPhase]=useState<Phase>(()=>animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'closing':'done');
  useEffect(()=>{
    if(!animate){setPhase('done');return;}
    if(phase==='done')return;
    const timer=setTimeout(()=>setPhase(phase==='closing'?'revealing':'done'),phase==='closing'?900:320);
    return()=>clearTimeout(timer);
  },[animate,phase]);
  const transitioning=phase!=='done';
  return <>
    {phase!=='closing'?<div className="encounter-battle-stage" inert={transitioning} aria-hidden={transitioning||undefined}>
      <BattleScene {...battleProps} introPaused={transitioning}/>
    </div>:null}
    {transitioning?<div className={'encounter-transition '+phase} data-encounter-phase={phase} role="status" aria-label="A Pokémon encounter is starting">
      {phase==='closing'?<><div className="encounter-flash"/>{Array.from({length:10},(_,index)=><i key={index} className="encounter-shutter" style={{'--band':index} as CSSProperties}/>)}</>:<><i className="encounter-curtain top"/><i className="encounter-curtain bottom"/></>}
    </div>:null}
  </>;
}
