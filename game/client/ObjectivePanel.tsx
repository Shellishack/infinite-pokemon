import { useState, type ReactNode } from 'react';

export default function ObjectivePanel({playerId,objectiveId,blocked,children}:{playerId:string;objectiveId:string;blocked:boolean;children:ReactNode}){
  // Preserve dismissed objectives across the branding change.
  const storageKey='infinite-pokemon-hidden-objective:'+playerId;
  const [hidden,setHidden]=useState(()=>{try{return sessionStorage.getItem(storageKey)===objectiveId;}catch{return false;}});
  const close=()=>{
    setHidden(true);try{sessionStorage.setItem(storageKey,objectiveId);}catch{/* Hiding still works without browser storage. */}
    document.querySelector<HTMLElement>('.game-canvas')?.focus({preventScroll:true});
  };
  if(hidden)return <div className="objective-toggle"><button disabled={blocked} onClick={()=>{setHidden(false);try{sessionStorage.removeItem(storageKey);}catch{/* Optional persistence. */}}}>Show objective</button></div>;
  return <section className="game-textbox objective-panel" aria-label="Current objective"><p>{children}</p><div className="objective-actions"><button disabled={blocked} aria-label="Close objective" onClick={close}>Close <span aria-hidden="true">×</span></button></div></section>;
}
