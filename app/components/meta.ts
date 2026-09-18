import type {Metadata} from 'next';
import {copyFor, localePath, type Locale} from '../content';

const siteUrl=()=>process.env.SITE_URL||'https://infinite-pokemon.vercel.app';

export function pageMetadata(locale:Locale,path:string,title:string,description:string):Metadata{
  const en=`${siteUrl()}${localePath('en',path)}`;
  const zh=`${siteUrl()}${localePath('zh-CN',path)}`;
  return {
    title,
    description,
    alternates:{
      canonical:locale==='en'?en:zh,
      languages:{en, 'zh-CN':zh, 'x-default':en},
    },
    openGraph:{title,description,locale:locale==='en'?'en_US':'zh_CN',type:'website',siteName:'Infinite Pokémon'},
  };
}

export {siteUrl};
export {copyFor};
