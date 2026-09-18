import type {Metadata} from 'next';
import {GUIDE_SLUGS, en, type GuideSlug} from '../../../content';
import {GuidePage} from '../../../components/pages';
import {pageMetadata} from '../../../components/meta';

export function generateStaticParams(){
  return GUIDE_SLUGS.map(slug=>({slug}));
}

export async function generateMetadata({params}:{params:Promise<{slug:GuideSlug}>}):Promise<Metadata>{
  const {slug}=await params;
  const guide=en.guides[slug];
  return pageMetadata('en',`/guides/${slug}/`,guide.title,guide.description);
}

export default async function Page({params}:{params:Promise<{slug:GuideSlug}>}){
  const {slug}=await params;
  return <GuidePage copy={en} slug={slug}/>;
}
