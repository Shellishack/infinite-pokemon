import type {Metadata} from 'next';
import {en} from '../../content';
import {GuidesIndexPage} from '../../components/pages';
import {pageMetadata} from '../../components/meta';

export function generateMetadata():Metadata{
  return pageMetadata('en','/guides/',en.meta.guides.title,en.meta.guides.description);
}

export default function Page(){
  return <GuidesIndexPage copy={en}/>;
}
