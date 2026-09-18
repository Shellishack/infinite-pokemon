'use client';

import {useEffect, useState} from 'react';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import '../../../game/client/styles.css';
import '../../../game/client/desktop-fit.css';
import {installDesktopFit} from '../../../game/client/desktop-fit';
import type {Locale} from '../../content';

// The game runtime (Phaser + React app) is loaded only on this route, client-side.
export default function GameShell({locale}:{locale:Locale}){
  const [App,setApp]=useState<null|typeof import('../../../game/client/App').default>(null);
  useEffect(()=>{
    installDesktopFit(document.getElementById('root')!);
    import('../../../game/client/App').then(mod=>setApp(()=>mod.default));
  },[]);
  return <div id="root">{App?<App siteLocale={locale}/>:null}</div>;
}
