import type {MetadataRoute} from 'next';
import {GUIDE_SLUGS, localePath} from './content';

export const dynamic='force-static';

export default function sitemap():MetadataRoute.Sitemap{
  const base=process.env.SITE_URL||'https://infinite-pokemon-blond.vercel.app';
  const paths=['/','/game/','/guides/',...GUIDE_SLUGS.map(s=>`/guides/${s}/`)];
  return paths.flatMap(path=>(['en','zh-CN'] as const).map(locale=>{
    const url=`${base}${localePath(locale,path)}`;
    return {
      url,
      alternates:{languages:{en:`${base}${localePath('en',path)}`,'zh-CN':`${base}${localePath('zh-CN',path)}`}},
    };
  }));
}
