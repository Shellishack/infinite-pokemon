'use client';

import Link from 'next/link';
import type {ReactNode} from 'react';
import {track} from '@vercel/analytics';

// Records a Vercel Analytics custom event for outbound/CTA clicks.
// No save contents or trainer text are ever sent — only the event name.
export function TrackLink({href,event,children,className}:{href:string;event:string;children:ReactNode;className?:string}){
  const external=/^https?:\/\//.test(href);
  const onClick=()=>{try{track(event);}catch{/* analytics unavailable */}};
  if(external) return <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>{children}</a>;
  return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
}
