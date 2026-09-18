import type {Metadata} from 'next';
import {zhCN} from '../content';
import {SiteFooter, SiteHeader} from '../components/chrome';
import {AnalyticsGate} from '../components/analytics-gate';
import '../globals.css';

export const metadata:Metadata={
  metadataBase:new URL(process.env.SITE_URL||'https://infinite-pokemon.vercel.app'),
  title:{default:zhCN.meta.home.title,template:'%s — Infinite Pokémon'},
  description:zhCN.meta.home.description,
  icons:{icon:'/branding/app-icon.svg'},
};

export default function ZhLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main">跳到主要内容</a>
        <SiteHeader copy={zhCN}/>
        <div id="main">{children}</div>
        <SiteFooter copy={zhCN}/>
        <AnalyticsGate/>
      </body>
    </html>
  );
}
