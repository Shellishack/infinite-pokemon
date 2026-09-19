import type {Metadata} from 'next';
import {en} from '../content';
import {SiteFooter, SiteHeader} from '../components/chrome';
import {AnalyticsGate} from '../components/analytics-gate';
import '../globals.css';

export const metadata:Metadata={
  metadataBase:new URL(process.env.SITE_URL||'https://infinite-pokemon-blond.vercel.app'),
  title:{default:en.meta.home.title,template:'%s — Infinite Pokémon'},
  description:en.meta.home.description,
  icons:{icon:'/branding/app-icon.svg'},
};

export default function EnLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteHeader copy={en}/>
        <div id="main">{children}</div>
        <SiteFooter copy={en}/>
        <AnalyticsGate/>
      </body>
    </html>
  );
}
