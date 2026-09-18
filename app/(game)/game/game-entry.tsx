'use client';

import {useEffect, useState} from 'react';
import {copyFor, localePath, type Locale} from '../../content';
import GameShell from './game-shell';

// Locale is resolved client-side (?lang=zh-CN) because the static export cannot
// read searchParams at build time. English instructions are prerendered for
// no-JS crawlers; the shell swaps localized copy on mount when requested.
export default function GameEntry(){
  const [locale,setLocale]=useState<Locale>('en');
  const [embed,setEmbed]=useState(false);
  useEffect(()=>{
    const requested=new URLSearchParams(location.search).get('lang');
    setLocale(requested==='zh-CN'?'zh-CN':'en');
    setEmbed(new URLSearchParams(location.search).has('embed'));
  },[]);
  const copy=copyFor(locale);
  const other:Locale=locale==='en'?'zh-CN':'en';
  if(embed)return <GameShell locale={locale}/>; // Electron shell: bare game, no site chrome
  return (
    <>
      <p className="breadcrumb">
        <a href={localePath(locale,'/')}>{copy.siteName}</a>
        {' · '}
        <a href={`/game/?lang=${other}`} hrefLang={other}>{copy.game.lang}</a>
      </p>
      <h1>{copy.game.heading}</h1>
      <ul className="clean">
        {copy.game.instructions.map(line=><li key={line}>{line}</li>)}
      </ul>
      <GameShell locale={locale}/>
    </>
  );
}
