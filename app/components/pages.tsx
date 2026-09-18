import Link from 'next/link';
import {GUIDE_SLUGS, LINKS, localePath, type Copy} from '../content';
import {TrackLink} from './track';

export function HomePage({copy}:{copy:Copy}){
  const lp=(p:string)=>localePath(copy.locale,p);
  return (
    <main className="container">
      <section className="hero">
        <img className="logo" src="/branding/infinite-pokemon-logo.svg" width={800} height={260} alt={copy.siteName}/>
        <h1>{copy.hero.title}</h1>
        <p>{copy.hero.subtitle}</p>
        <div className="cta-row">
          <TrackLink className="btn" href={lp('/game/')} event="demo_start_click">{copy.hero.primary}</TrackLink>
          <TrackLink className="btn secondary" href={LINKS.skillsRelease} event="download_click">{copy.hero.download}</TrackLink>
          <TrackLink className="btn secondary" href={LINKS.github} event="github_click">{copy.hero.github}</TrackLink>
        </div>
      </section>

      <section aria-labelledby="showcase">
        <h2 id="showcase">{copy.showcase.heading}</h2>
        <p>{copy.showcase.intro}</p>
        <div className="grid two">
          {copy.showcase.items.map(item=>(
            <figure className="card" key={item.title} style={{margin:0}}>
              <img src={item.image} alt={item.alt} width={640} height={360} loading="lazy"/>
              <figcaption>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="note">{copy.showcase.demoNote}</p>
      </section>

      <section aria-labelledby="guides">
        <h2 id="guides">{copy.guidesPreview.heading}</h2>
        <p>{copy.guidesPreview.intro}</p>
        <div className="grid two">
          {GUIDE_SLUGS.map(slug=>(
            <div className="card" key={slug}>
              <h3><Link href={lp(`/guides/${slug}/`)}>{copy.guides[slug].title}</Link></h3>
              <p>{copy.guides[slug].question}</p>
              <p><Link href={lp(`/guides/${slug}/`)}>{copy.guidesPreview.readGuide} →</Link></p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="downloads">
        <h2 id="downloads">{copy.downloads.heading}</h2>
        <p>{copy.downloads.intro}</p>
        <div className="cta-row">
          <TrackLink className="btn secondary" href={LINKS.github} event="github_click">GitHub</TrackLink>
          <TrackLink className="btn secondary" href={LINKS.skillsRelease} event="download_click">{copy.nav.download}</TrackLink>
        </div>
        <h3>{copy.downloads.skillsHeading}</h3>
        <p>{copy.downloads.skillsIntro}</p>
        <ul className="clean">
          {copy.downloads.skills.map(skill=>(
            <li key={skill.name}><a href={skill.url} target="_blank" rel="noopener noreferrer">{skill.name}</a> — {skill.description}</li>
          ))}
        </ul>
        <p><a href={LINKS.skillsRelease} target="_blank" rel="noopener noreferrer">{copy.downloads.releaseNote}</a></p>
      </section>

      <section aria-labelledby="docs">
        <h2 id="docs">{copy.docs.heading}</h2>
        <ul className="clean">
          {copy.docs.items.map(doc=>(
            <li key={doc.name}><a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.name}</a> — {doc.description}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="community">
        <h2 id="community">{copy.community.heading}</h2>
        <p>{copy.community.body}</p>
        <div className="cta-row">
          <TrackLink className="btn secondary" href={LINKS.discord} event="discord_click">{copy.community.discord}</TrackLink>
          <TrackLink className="btn secondary" href={LINKS.github} event="github_click">{copy.community.github}</TrackLink>
        </div>
        <p><small>{copy.community.disclaimer}</small></p>
        <p><small>{copy.community.credits}</small></p>
      </section>
    </main>
  );
}

export function GuidesIndexPage({copy}:{copy:Copy}){
  const lp=(p:string)=>localePath(copy.locale,p);
  return (
    <main className="container">
      <h1>{copy.guidesIndex.heading}</h1>
      <p>{copy.guidesIndex.intro}</p>
      <div className="grid two">
        {GUIDE_SLUGS.map(slug=>(
          <div className="card" key={slug}>
            <h3><Link href={lp(`/guides/${slug}/`)}>{copy.guides[slug].title}</Link></h3>
            <p>{copy.guides[slug].description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export function GuidePage({copy,slug}:{copy:Copy;slug:(typeof GUIDE_SLUGS)[number]}){
  const guide=copy.guides[slug];
  const lp=(p:string)=>localePath(copy.locale,p);
  const jsonLd={
    '@context':'https://schema.org',
    '@type':'Article',
    headline:guide.title,
    description:guide.description,
    inLanguage:copy.htmlLang,
  };
  const breadcrumbLd={
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement:[
      {'@type':'ListItem',position:1,name:copy.siteName,item:`${process.env.SITE_URL}${lp('/')}`},
      {'@type':'ListItem',position:2,name:copy.meta.guides.title,item:`${process.env.SITE_URL}${lp('/guides/')}`},
      {'@type':'ListItem',position:3,name:guide.title,item:`${process.env.SITE_URL}${lp(`/guides/${slug}/`)}`},
    ],
  };
  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(breadcrumbLd)}}/>
      <p className="breadcrumb"><Link href={lp('/guides/')}>{copy.backToGuides}</Link></p>
      <article className="guide">
        <h1>{guide.title}</h1>
        <p><em>{guide.question}</em></p>
        {guide.sections.map(section=>(
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((p,i)=><p key={i}>{p}</p>)}
            {section.list&&<ul className="clean">{section.list.map(item=><li key={item}>{item}</li>)}</ul>}
          </section>
        ))}
        <section className="stumbling">
          <h2>{copy.stumblingHeading}</h2>
          <ul className="clean">{guide.stumbling.map(item=><li key={item}>{item}</li>)}</ul>
        </section>
        <section>
          <h2>{copy.relatedHeading}</h2>
          <ul className="clean">
            {guide.related.map(rel=>(
              <li key={rel}><Link href={lp(`/guides/${rel}/`)}>{copy.guides[rel].title}</Link></li>
            ))}
          </ul>
          <div className="cta-row">
            <TrackLink className="btn" href={lp('/game/')} event="demo_start_click">{copy.nav.playDemo}</TrackLink>
            <TrackLink className="btn secondary" href={LINKS.skillsRelease} event="download_click">{copy.nav.download}</TrackLink>
          </div>
        </section>
      </article>
    </main>
  );
}
