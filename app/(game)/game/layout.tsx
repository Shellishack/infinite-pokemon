import type {Metadata} from 'next';
import '../../globals.css';

export const metadata:Metadata={
  metadataBase:new URL(process.env.SITE_URL||'https://infinite-pokemon-blond.vercel.app'),
  title:'Play — Infinite Pokémon',
  icons:{icon:'/branding/app-icon.svg'},
};

export default function GameLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="en">
      <head><meta name="infinite-pokemon-site" content="static-export"/></head>
      <body>{children}</body>
    </html>
  );
}
