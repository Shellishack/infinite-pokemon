import type {MetadataRoute} from 'next';

export const dynamic='force-static';

export default function robots():MetadataRoute.Robots{
  const base=process.env.SITE_URL||'https://infinite-pokemon.vercel.app';
  return {
    rules:{userAgent:'*',allow:'/'},
    sitemap:`${base}/sitemap.xml`,
  };
}
