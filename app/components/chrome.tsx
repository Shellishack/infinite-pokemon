import Link from 'next/link';
import {LINKS, localePath, type Copy, type Locale} from '../content';
import {TrackLink} from './track';

export function SiteHeader({copy}:{copy:Copy}){
  const other:Locale=copy.locale==='en'?'zh-CN':'en';
  return (
    <header className="site-header">
      <Link className="brand" href={localePath(copy.locale,'/')}>
        <img src="/branding/app-icon.svg" width={28} height={28} alt=""/>
        {copy.siteName}
      </Link>
      <nav aria-label="Main">
        <TrackLink href={localePath(copy.locale,'/game/')} event="demo_start_click">{copy.nav.playDemo}</TrackLink>
        <Link href={localePath(copy.locale,'/guides/')}>{copy.nav.guides}</Link>
        <TrackLink href={LINKS.skillsRelease} event="download_click">{copy.nav.download}</TrackLink>
        <TrackLink href={LINKS.github} event="github_click">GitHub</TrackLink>
        <TrackLink href={LINKS.discord} event="discord_click">Discord</TrackLink>
        <Link href={localePath(other,'/')} hrefLang={other==='en'?'en':'zh-CN'}>{copy.nav.switchTo}</Link>
      </nav>
    </header>
  );
}

export function SiteFooter({copy}:{copy:Copy}){
  return (
    <footer className="site-footer">
      <div className="container">
        <p>{copy.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
